import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ManagerEvaluationHistoryPage from './ManagerEvaluationHistoryPage.jsx'
import { adminApi } from '../../../admin/api/adminApi.js'

vi.mock('../../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <main>{children}</main>,
}))

vi.mock('../../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ ariaLabel, id, onChange, options, placeholder, value, disabled }) => (
    <select
      id={id}
      aria-label={ariaLabel || placeholder}
      disabled={disabled}
      onChange={(event) => onChange && onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

vi.mock('../../../admin/api/adminApi.js', () => ({
  adminApi: {
    getDepartments: vi.fn(),
    getQualityChecklistFilterOptions: vi.fn(),
    getEvaluationHistory: vi.fn(),
    getEvaluationHistorySummary: vi.fn(),
  },
}))

const mockSubmission = {
  id: 101,
  formTitle: 'Rửa tay ngoại khoa',
  formCode: 'RUA_TAY_NGOAI_KHOA',
  formVersionId: 14,
  versionNumber: 1,
  subjectContext: {
    fullName: 'NamHaiPham',
    employeeCode: 'hainam',
    subjectUser: {
      department: {
        id: 3,
        name: 'Phòng Hành chính',
      },
    },
  },
  submittedBy: {
    name: 'Ng hieu 24',
    username: 'nghieu2412',
  },
  submittedAt: '2026-08-23T23:38:00Z',
  convertedScore: 8.0,
  result: 'PASSED',
}

describe('ManagerEvaluationHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.getDepartments.mockResolvedValue({
      data: {
        data: [
          { id: 3, name: 'Phòng Hành chính', code: 'HC' },
          { id: 7, name: 'Khoa Điều dưỡng', code: 'DD' },
        ],
      },
    })
    adminApi.getQualityChecklistFilterOptions.mockResolvedValue({
      data: {
        data: {
          forms: [{ id: 14, title: 'Rửa tay ngoại khoa', code: 'RTNK' }],
        },
      },
    })
    adminApi.getEvaluationHistory.mockResolvedValue({
      data: {
        data: {
          content: [mockSubmission],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
        },
      },
    })
    adminApi.getEvaluationHistorySummary.mockResolvedValue({
      data: {
        data: {
          total: 1,
          passed: 1,
          failed: 0,
          averageConvertedScore: 8.0,
        },
      },
    })
  })

  it('renders summary KPI cards and submission table correctly', async () => {
    render(
      <MemoryRouter>
        <ManagerEvaluationHistoryPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('Lịch sử đánh giá')).toBeInTheDocument()
    expect(screen.getByText('Tổng lượt')).toBeInTheDocument()
    expect(screen.getAllByText('Đạt').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Điểm trung bình')).toBeInTheDocument()

    expect(await screen.findByText('NamHaiPham')).toBeInTheDocument()
    expect(screen.getByText('Phòng Hành chính')).toBeInTheDocument()
    expect(screen.getByText('8,00/10')).toBeInTheDocument()
  })

  it('searches list and summary while typing, keeps applied filters and resets the page', async () => {
    render(<MemoryRouter initialEntries={['/admin/quality/history?page=3&departmentId=3']}>
      <ManagerEvaluationHistoryPage historyPath="/admin/quality/history" />
    </MemoryRouter>)
    await screen.findByText('NamHaiPham')
    adminApi.getEvaluationHistory.mockClear()
    adminApi.getEvaluationHistorySummary.mockClear()

    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc mã nhân viên...'), {
      target: { value: '  duong  ' },
    })
    expect(adminApi.getEvaluationHistory).not.toHaveBeenCalled()

    await waitFor(() => expect(adminApi.getEvaluationHistory).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'duong', page: 0, departmentId: '3' }),
    ))
    expect(adminApi.getEvaluationHistorySummary).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'duong', departmentId: '3' }),
    )
  })

  it('keeps draft filters while searching and clears the keyword when reset', async () => {
    render(<MemoryRouter><ManagerEvaluationHistoryPage /></MemoryRouter>)
    await screen.findByText('NamHaiPham')
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/i }))
    await screen.findByRole('option', { name: 'Khoa Điều dưỡng' })
    fireEvent.change(screen.getByLabelText('Lọc theo khoa phòng'), { target: { value: '7' } })
    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc mã nhân viên...'), { target: { value: 'duong' } })

    await waitFor(() => expect(adminApi.getEvaluationHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'duong', departmentId: undefined }),
    ))
    expect(screen.getByLabelText('Lọc theo khoa phòng')).toHaveValue('7')
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(adminApi.getEvaluationHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'duong', departmentId: '7' }),
    ))

    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc mã nhân viên...'), { target: { value: '' } })
    await waitFor(() => expect(adminApi.getEvaluationHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: undefined, departmentId: '7' }),
    ))
    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc mã nhân viên...'), { target: { value: 'pending' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(screen.getByPlaceholderText('Tìm theo tên hoặc mã nhân viên...')).toHaveValue('')
    await waitFor(() => expect(adminApi.getEvaluationHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: undefined, departmentId: undefined }),
    ))
  })

  it('does not get stuck loading when Enter repeats the current search', async () => {
    render(<MemoryRouter><ManagerEvaluationHistoryPage /></MemoryRouter>)
    await screen.findByText('NamHaiPham')
    const search = screen.getByPlaceholderText('Tìm theo tên hoặc mã nhân viên...')
    fireEvent.change(search, { target: { value: 'duong' } })
    await waitFor(() => expect(adminApi.getEvaluationHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'duong' }),
    ))
    await screen.findByText('NamHaiPham')

    fireEvent.keyDown(search, { key: 'Enter' })

    expect(screen.queryByText('Đang tải kết quả...')).not.toBeInTheDocument()
    expect(screen.getByText('NamHaiPham')).toBeInTheDocument()
  })

  it('allows filtering by department across all departments', async () => {
    render(
      <MemoryRouter>
        <ManagerEvaluationHistoryPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('NamHaiPham')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/i }))

    await screen.findByRole('option', { name: 'Phòng Hành chính' })

    const deptSelect = screen.getByLabelText('Lọc theo khoa phòng')
    expect(deptSelect).toBeInTheDocument()
    expect(deptSelect).not.toBeDisabled()

    fireEvent.change(deptSelect, { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => {
      expect(adminApi.getEvaluationHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: '3',
        })
      )
    })
  })
})
