import { CaretDownOutlined, CaretUpOutlined } from '@ant-design/icons'

export default function SortableTableHeader({
  children,
  sortKey,
  field,
  sort,
  onSort,
  className = '',
  style,
  label,
}) {
  const key = sortKey || field
  const active = sort?.key === key ? sort.direction : null
  const ariaSort = active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'
  const nextLabel = active === 'asc'
    ? 'giảm dần'
    : active === 'desc'
      ? 'thứ tự mặc định'
      : 'tăng dần'
  const accessibleLabel = label || (typeof children === 'string' ? children : 'cột')

  return (
    <th className={className} style={style} aria-sort={ariaSort} scope="col">
      <button
        type="button"
        className="sortable-table-header"
        onClick={() => onSort(key)}
        aria-label={`Sắp xếp ${accessibleLabel} ${nextLabel}`}
        title={`Sắp xếp ${nextLabel}`}
      >
        <span className="sortable-table-header__label">{children ?? label}</span>
        <span className="sortable-table-header__icons" aria-hidden="true">
          <CaretUpOutlined className={active === 'asc' ? 'is-active' : ''} />
          <CaretDownOutlined className={active === 'desc' ? 'is-active' : ''} />
        </span>
      </button>
    </th>
  )
}
