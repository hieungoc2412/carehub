import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { examAssignmentApi } from '../../../../features/evaluation/api/examAssignmentApi'
import '../../styles/ManagerPages.css'
import SortableTableHeader from '../../../../shared/components/SortableTableHeader.jsx'
import { sortTableRows, useTableSort } from '../../../../shared/utils/tableSort.js'

const EXAM_SORT_COLUMNS = {
  name: item => item.name || item.title || item.examTitle,
  createdAt: { getValue: item => item.createdAt, type: 'date' },
  status: item => item.status,
  dueAt: { getValue: item => item.dueAt, type: 'date' },
}

function ManagerExamResultsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const { sort, toggleSort } = useTableSort()
  const displayedAssignments = useMemo(
    () => sortTableRows(assignments, sort, EXAM_SORT_COLUMNS),
    [assignments, sort],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      examAssignmentApi.listManagerAssignments({ q: debouncedSearch || undefined })
        .then((res) => {
          const data = res.data?.data?.content || res.data?.data || []
          setAssignments(Array.isArray(data) ? data : [])
        })
        .catch(err => {
          console.error("Error fetching exam assignments", err)
        })
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [debouncedSearch])

  return (
    <AppShell title="Kết quả thi nhân sự">
      <div className="mgr-toolbar mgr-toolbar--standard">
        <div className="mgr-search-box">
          <input
            type="text"
            placeholder="Tìm theo tên kỳ thi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <SearchOutlined />
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="mgr-card" style={{ textAlign: 'center', padding: 40 }}>
          <LoadingOutlined style={{ fontSize: 24, color: '#6b7280' }} />
          <p style={{ marginTop: 12, color: '#6b7280' }}>Đang tải dữ liệu...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="mgr-card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#6b7280' }}>Không có kỳ thi nào.</p>
        </div>
      ) : (
      <div className="mgr-card mgr-table-wrap" style={{ padding: 0 }}>
        <table className="mgr-table mgr-table--cards">
          <thead>
            <tr>
              <SortableTableHeader sortKey="name" sort={sort} onSort={toggleSort}>Tên kỳ thi</SortableTableHeader>
              <SortableTableHeader sortKey="createdAt" sort={sort} onSort={toggleSort}>Ngày tạo</SortableTableHeader>
              <SortableTableHeader sortKey="status" sort={sort} onSort={toggleSort}>Trạng thái</SortableTableHeader>
              <SortableTableHeader sortKey="dueAt" sort={sort} onSort={toggleSort}>Hạn nộp</SortableTableHeader>
              <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {displayedAssignments.map((item) => (
              <tr key={item.id}>
                <td data-label="Tên kỳ thi" style={{ fontWeight: 600, color: '#0f172a' }}>{item.name || item.title || item.examTitle || `Kỳ thi #${item.id}`}</td>
                <td data-label="Ngày tạo" style={{ color: '#475569' }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '--'}
                </td>
                <td data-label="Trạng thái">
                  <span className={`mgr-badge mgr-badge--${item.status === 'OPEN' ? 'green' : item.status === 'CLOSED' ? 'red' : 'amber'}`}>
                    {item.status === 'OPEN' ? 'Đang mở' : item.status === 'CLOSED' ? 'Đã đóng' : item.status || '--'}
                  </span>
                </td>
                <td data-label="Hạn nộp" style={{ color: '#475569' }}>
                  {item.dueAt ? new Date(item.dueAt).toLocaleDateString('vi-VN') : '--'}
                </td>
                <td className="mgr-table-action-cell">
                  <button
                    onClick={() => navigate(`/manager/exam-results/detail/${item.id}`)}
                    title="Xem kết quả"
                    className="mgr-view-btn admin-table-action admin-table-action--icon admin-table-action--primary"
                  >
                    <EyeOutlined />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </AppShell>
  )
}

export default ManagerExamResultsPage
