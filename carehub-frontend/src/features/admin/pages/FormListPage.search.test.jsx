import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../shared/context/ToastContext.jsx'
import FormListPage from './FormListPage.jsx'

const api = vi.hoisted(() => ({ getForms: vi.fn(), getDepartments: vi.fn() }))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/FilterSelectField.jsx', () => ({
  default: ({ label, value, onChange, options }) => <label>{label}
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>,
}))

const form = { id: 1, code: 'QT-11', title: 'Bảng kiểm điều dưỡng', status: 'DRAFT' }
const otherForm = { id: 2, code: 'QT-12', title: 'Bảng kiểm vệ sinh', status: 'DRAFT' }
const response = (content = [form, otherForm], extra = {}) => ({
  data: { data: { content, totalElements: content.length, totalPages: 1, ...extra } },
})
const searchBox = () => screen.getByRole('textbox', { name: 'Tìm kiếm checklist' })
const renderPage = async () => {
  render(<MemoryRouter><ToastProvider><FormListPage /></ToastProvider></MemoryRouter>)
  await screen.findByText(form.title)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  api.getForms.mockImplementation(({ keyword }) => Promise.resolve(response(keyword ? [form] : [form, otherForm])))
  api.getDepartments.mockResolvedValue({ data: { data: [] } })
})

describe('FormListPage live search', () => {
  it('debounces typing and reloads the list when cleared without applying filters', async () => {
    await renderPage()
    api.getForms.mockClear()
    fireEvent.change(searchBox(), { target: { value: 'QT' } })
    fireEvent.change(searchBox(), { target: { value: '  QT 11  ' } })
    expect(api.getForms).not.toHaveBeenCalled()

    await waitFor(() => expect(api.getForms).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'QT 11', page: 0 })))
    expect(api.getForms).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(otherForm.title)).not.toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: '' } })
    await screen.findByText(otherForm.title)
    expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: undefined, page: 0 }))
  })

  it('preserves the legacy checklist keyword mapping', async () => {
    await renderPage()
    fireEvent.change(searchBox(), { target: { value: 'Rửa tay ngoại khoa' } })

    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: 'SURGICAL_HAND_SCRUB' })))
  })

  it('resets pagination before searching', async () => {
    api.getForms.mockResolvedValue(response([form], { totalElements: 40, totalPages: 4 }))
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Sau', exact: true }))
    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))
    api.getForms.mockClear()

    fireEvent.change(searchBox(), { target: { value: 'QT 11' } })

    await waitFor(() => expect(api.getForms).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'QT 11', page: 0 })))
    expect(api.getForms).toHaveBeenCalledTimes(1)
  })

  it('keeps draft filters separate and retains applied filters when clearing the keyword', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'DRAFT' } })
    fireEvent.change(searchBox(), { target: { value: 'QT 11' } })

    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: 'QT 11', status: undefined })))
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('DRAFT')
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'DRAFT' })))

    fireEvent.change(searchBox(), { target: { value: '' } })
    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: undefined, status: 'DRAFT' })))
  })

  it('ignores a previous query response arriving after the latest result', async () => {
    let finishOldRequest
    api.getForms.mockImplementation(({ keyword }) => keyword === 'old'
      ? new Promise((resolve) => { finishOldRequest = () => resolve(response([otherForm])) })
      : Promise.resolve(response([form])))
    await renderPage()
    fireEvent.change(searchBox(), { target: { value: 'old' } })
    await waitFor(() => expect(finishOldRequest).toBeTypeOf('function'))
    fireEvent.change(searchBox(), { target: { value: 'new' } })
    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: 'new' })))
    await screen.findByText(form.title)

    await act(async () => finishOldRequest())

    expect(screen.queryByText(otherForm.title)).not.toBeInTheDocument()
    expect(screen.getByText(form.title)).toBeInTheDocument()
  })
})
