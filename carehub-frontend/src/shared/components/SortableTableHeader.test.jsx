import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SortableTableHeader from './SortableTableHeader.jsx'

describe('SortableTableHeader', () => {
  it('announces state and requests the next sort', () => {
    const onSort = vi.fn()
    const { rerender } = render(<table><thead><tr><SortableTableHeader field="count" label="Số lượng" sort={null} onSort={onSort} /></tr></thead></table>)
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'none')
    fireEvent.click(screen.getByRole('button', { name: /Sắp xếp Số lượng tăng dần/i }))
    expect(onSort).toHaveBeenCalledWith('count')

    rerender(<table><thead><tr><SortableTableHeader field="count" label="Số lượng" sort={{ key: 'count', direction: 'asc' }} onSort={onSort} /></tr></thead></table>)
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending')
  })
})
