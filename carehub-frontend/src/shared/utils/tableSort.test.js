import { describe, expect, it } from 'vitest'
import { apiSort, nextTableSort, sortTableRows } from './tableSort.js'

const columns = {
  name: { getValue: row => row.name },
  count: { getValue: row => row.count, type: 'number' },
  date: { getValue: row => row.date, type: 'date' },
}

describe('tableSort', () => {
  it('cycles ascending, descending, then default', () => {
    expect(nextTableSort(null, 'count')).toEqual({ key: 'count', direction: 'asc' })
    expect(nextTableSort({ key: 'count', direction: 'asc' }, 'count')).toEqual({ key: 'count', direction: 'desc' })
    expect(nextTableSort({ key: 'count', direction: 'desc' }, 'count')).toBeNull()
  })

  it('sorts Vietnamese text, numbers and dates while keeping empty values last', () => {
    const rows = [
      { id: 1, name: 'Điều dưỡng 10', count: 10, date: '2026-01-02' },
      { id: 2, name: 'Điều dưỡng 2', count: 2, date: '2025-12-31' },
      { id: 3, name: null, count: null, date: null },
    ]
    expect(sortTableRows(rows, { key: 'name', direction: 'asc' }, columns).map(row => row.id)).toEqual([2, 1, 3])
    expect(sortTableRows(rows, { key: 'count', direction: 'desc' }, columns).map(row => row.id)).toEqual([1, 2, 3])
    expect(sortTableRows(rows, { key: 'date', direction: 'asc' }, columns).map(row => row.id)).toEqual([2, 1, 3])
  })

  it('orders decimals numerically and uses the row key when values are equal', () => {
    const rows = [
      { id: 10, count: 2.5 },
      { id: 2, count: 2.5 },
      { id: 100, count: 10.25 },
      { id: 1, count: null },
    ]
    expect(sortTableRows(rows, { key: 'count', direction: 'asc' }, columns).map(row => row.id))
      .toEqual([2, 10, 100, 1])
    expect(sortTableRows(rows, { key: 'count', direction: 'desc' }, columns).map(row => row.id))
      .toEqual([100, 2, 10, 1])
  })

  it('serializes API sort and preserves a fallback', () => {
    expect(apiSort({ key: 'createdAt', direction: 'asc' }, 'id,desc')).toBe('createdAt,asc')
    expect(apiSort(null, 'id,desc')).toBe('id,desc')
  })
})
