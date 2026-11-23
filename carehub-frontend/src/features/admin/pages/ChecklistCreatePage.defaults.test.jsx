import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../shared/context/ToastContext.jsx'
import ChecklistCreatePage from './ChecklistCreatePage.jsx'

const api = vi.hoisted(() => ({ createForm: vi.fn(), createFormVersion: vi.fn() }))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))

const labels = ['Không thực hiện', 'Thực hiện nhưng không đạt', 'Đạt', 'Tốt', 'Rất tốt']
const card = (index) => screen.getByLabelText(`Câu hỏi ${index}`).closest('article')
const optionInputs = (index) => within(card(index)).getAllByRole('textbox', { name: /^Tùy chọn \d+$/ })
const renderPage = () => render(<MemoryRouter><ToastProvider><ChecklistCreatePage /></ToastProvider></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  api.createForm.mockResolvedValue({ data: { data: { id: 7 } } })
  api.createFormVersion.mockResolvedValue({ data: { data: { id: 20 } } })
})

describe('ChecklistCreatePage default choices', () => {
  it('starts with five choices and adds the same choices through the plus button', () => {
    renderPage()
    expect(optionInputs(1).map((input) => input.value)).toEqual(labels)
    fireEvent.change(within(card(1)).getByLabelText('Tùy chọn 1'), { target: { value: 'Nhãn đã sửa' } })

    fireEvent.click(screen.getByRole('button', { name: 'Thêm câu hỏi' }))

    expect(optionInputs(2).map((input) => input.value)).toEqual(labels)
    expect(optionInputs(1)[0]).toHaveValue('Nhãn đã sửa')
    expect(api.createForm).not.toHaveBeenCalled()
    expect(api.createFormVersion).not.toHaveBeenCalled()
  })

  it('fills five choices when changing an empty text question to a choice question', () => {
    sessionStorage.setItem('carehub.pendingChecklistDraft', JSON.stringify({
      formId: 7,
      editor: { title: 'Bản nháp', questions: [{ id: 'q1', title: 'Câu văn bản', fieldType: 'SHORT_TEXT', options: [] }] },
    }))
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Trả lời ngắn/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Trắc nghiệm' }))

    expect(optionInputs(1).map((input) => input.value)).toEqual(labels)
  })

  it('saves the five standard values with distinct option keys and display order', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Tiêu đề checklist'), { target: { value: 'Bảng kiểm mẫu' } })
    fireEvent.change(screen.getByLabelText('Câu hỏi 1'), { target: { value: 'Thực hiện đúng quy trình?' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu bản nháp/ }))

    await waitFor(() => expect(api.createFormVersion).toHaveBeenCalled())
    const options = api.createFormVersion.mock.calls[0][1].sections[0].items[0].question.options
    expect(options.map((option) => option.label)).toEqual(labels)
    expect(options.map((option) => option.value)).toEqual(['NOT_PERFORMED', 'PERFORMED_NOT_ACHIEVED', 'ACHIEVED', 'GOOD', 'VERY_GOOD'])
    expect(options.map((option) => option.displayOrder)).toEqual([0, 1, 2, 3, 4])
    expect(new Set(options.map((option) => option.optionKey)).size).toBe(5)
  })
})
