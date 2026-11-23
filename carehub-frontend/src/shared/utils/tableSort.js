import { useCallback, useMemo, useState } from 'react'

const collator = new Intl.Collator('vi', {
  numeric: true,
  sensitivity: 'base',
})

export function nextTableSort(current, key) {
  if (current?.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  if (current.direction === 'desc') return null
  return { key, direction: 'asc' }
}

export function useTableSort(initialSort = null, onChange) {
  const [sort, setSort] = useState(initialSort)
  const toggleSort = useCallback((key) => {
    setSort((current) => {
      const next = nextTableSort(current, key)
      onChange?.(next)
      return next
    })
  }, [onChange])
  const clearSort = useCallback(() => {
    setSort(null)
    onChange?.(null)
  }, [onChange])
  return { sort, setSort, toggleSort, clearSort }
}

function isEmpty(value) {
  return value == null || value === '' || (typeof value === 'number' && Number.isNaN(value))
}

function compareValue(left, right, type) {
  if (type === 'number') return Number(left) - Number(right)
  if (type === 'date') return new Date(left).getTime() - new Date(right).getTime()
  if (type === 'boolean') return Number(Boolean(left)) - Number(Boolean(right))
  return collator.compare(String(left), String(right))
}

export function sortTableRows(rows, sort, columns, getRowKey = (row, index) => row?.id ?? index) {
  if (!sort?.key || !columns?.[sort.key]) return rows
  const definition = columns[sort.key]
  const getValue = typeof definition === 'function' ? definition : definition.getValue
  const type = typeof definition === 'function' ? 'text' : definition.type || 'text'
  const direction = sort.direction === 'desc' ? -1 : 1

  return rows
    .map((row, index) => ({ row, index, value: getValue(row) }))
    .sort((left, right) => {
      const leftEmpty = isEmpty(left.value)
      const rightEmpty = isEmpty(right.value)
      if (leftEmpty || rightEmpty) {
        if (leftEmpty && rightEmpty) return left.index - right.index
        return leftEmpty ? 1 : -1
      }
      const compared = compareValue(left.value, right.value, type)
      if (compared !== 0) return compared * direction
      const keyCompared = collator.compare(String(getRowKey(left.row, left.index)), String(getRowKey(right.row, right.index)))
      return keyCompared || left.index - right.index
    })
    .map(({ row }) => row)
}

export function useSortedRows(rows, sort, columns, getRowKey) {
  return useMemo(
    () => sortTableRows(rows, sort, columns, getRowKey),
    [columns, getRowKey, rows, sort],
  )
}

export function apiSort(sort, fallback) {
  return sort?.key ? `${sort.key},${sort.direction}` : fallback
}
