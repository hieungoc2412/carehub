import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfessionalFieldManagementPage from './ProfessionalFieldManagementPage.jsx'
import { adminApi } from '../api/adminApi.js'

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }))

vi.mock('../api/adminApi.js', () => ({
  adminApi: {
    createProfessionalField: vi.fn(),
    getProfessionalFields: vi.fn(),
    rejectProfessionalField: vi.fn(),
    updateProfessionalField: vi.fn(),
  },
}))

vi.mock('../../../shared/context/ToastContext.jsx', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

const previousReact = globalThis.React

beforeAll(() => {
  globalThis.React = React
})

afterAll(() => {
  globalThis.React = previousReact
})

function renderPage(path = '/admin/training/professional-fields') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProfessionalFieldManagementPage />
    </MemoryRouter>,
  )
}

describe('ProfessionalFieldManagementPage create form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.getProfessionalFields.mockResolvedValue({
      data: { data: { content: [] } },
    })
    adminApi.createProfessionalField.mockResolvedValue({ data: { data: {} } })
    adminApi.rejectProfessionalField.mockResolvedValue({ data: { data: {} } })
  })

  it('shows proposer and creation date instead of code for a pending proposal', async () => {
    adminApi.getProfessionalFields.mockResolvedValue({ data: { data: { content: [{
      id: 7, code: 'CUSTOM_7', name: 'Điều dưỡng nhi', active: false, moderationStatus: 'PENDING',
      description: 'Tự đề xuất bởi nhân viên: Dương Ngọc Hiếu (Chờ duyệt)',
      proposerName: 'Dương Ngọc Hiếu', createdAt: '2026-10-23T10:27:00', updatedAt: '2026-11-23T15:00:00',
    }] } } })
    renderPage('/admin/training/professional-fields?tab=pending')

    const row = (await screen.findByText('Điều dưỡng nhi')).closest('tr')
    expect(screen.getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
      'Tên lĩnh vực', 'Người đề xuất', 'Ngày đề xuất', 'Trạng thái', 'Hành động',
    ])
    expect(within(row).getByText('Dương Ngọc Hiếu')).toBeInTheDocument()
    expect(within(row).getByText('23/10/2026 10:27')).toBeInTheDocument()
    expect(within(row).queryByText('CUSTOM_7')).not.toBeInTheDocument()
    expect(within(row).queryByText(/Tự đề xuất bởi/)).not.toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Phê duyệt lĩnh vực Điều dưỡng nhi' })).toBeInTheDocument()
  })

  it.each([undefined, 'invalid-date'])('does not invent proposer or proposal date when metadata is missing (%s)', async (createdAt) => {
    adminApi.getProfessionalFields.mockResolvedValue({ data: { data: { content: [{
      id: 8, code: 'CUSTOM_8', name: 'Lĩnh vực cũ', active: false, moderationStatus: 'REJECTED',
      createdAt, updatedAt: '2026-11-23T15:00:00', rejectionReason: 'Trùng lĩnh vực',
    }] } } })
    renderPage('/admin/training/professional-fields?tab=rejected')

    const row = (await screen.findByText('Lĩnh vực cũ')).closest('tr')
    expect(within(row).getAllByText('—')).toHaveLength(2)
    expect(within(row).getByText('Lý do: Trùng lĩnh vực')).toBeInTheDocument()
  })

  it('shows field-level validation in the create modal', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Tạo mới lĩnh vực/i }))

    expect(screen.getByRole('dialog', { name: 'Tạo mới lĩnh vực chuyên môn' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Mã lĩnh vực/i)).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: /Tạo lĩnh vực/i }))

    expect(await screen.findByText('Vui lòng nhập mã lĩnh vực.')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập tên lĩnh vực.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Mã lĩnh vực/i)).toHaveAttribute('aria-invalid', 'true')
    expect(adminApi.createProfessionalField).not.toHaveBeenCalled()
  })

  it('trims values before creating a professional field', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Tạo mới lĩnh vực/i }))
    fireEvent.change(screen.getByLabelText(/Mã lĩnh vực/i), { target: { value: '  CAP_CUU  ' } })
    fireEvent.change(screen.getByLabelText(/Tên lĩnh vực/i), { target: { value: '  Chăm sóc cấp cứu  ' } })
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: '  Chăm sóc người bệnh cấp cứu  ' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo lĩnh vực/i }))

    await waitFor(() => {
      expect(adminApi.createProfessionalField).toHaveBeenCalledWith({
        active: true,
        code: 'CAP_CUU',
        description: 'Chăm sóc người bệnh cấp cứu',
        name: 'Chăm sóc cấp cứu',
        version: null,
      })
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rejects a pending proposal without requiring a reason', async () => {
    adminApi.getProfessionalFields.mockResolvedValue({
      data: {
        data: {
          content: [{
            id: 7,
            code: 'CUSTOM_7',
            name: 'Điều dưỡng nhi',
            active: false,
            moderationStatus: 'PENDING',
            version: 0,
          }],
        },
      },
    })

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Chờ phê duyệt/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Từ chối lĩnh vực Điều dưỡng nhi' }))
    expect(screen.getByRole('dialog', { name: 'Từ chối lĩnh vực chuyên môn' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Từ chối đề xuất$/i }))

    await waitFor(() => expect(adminApi.rejectProfessionalField).toHaveBeenCalledWith(7))
    expect(showToastMock).toHaveBeenCalledWith('Đã từ chối đề xuất lĩnh vực chuyên môn', 'success')
  })
})
