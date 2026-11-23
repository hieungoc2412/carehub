import { Fragment, useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ReloadOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../shared/auth/jwt.js'
import '../styles/EvaluationDashboardPage.css'
import PassFailBadge from '../../../shared/components/PassFailBadge.jsx'
import SortableTableHeader from '../../../shared/components/SortableTableHeader.jsx'
import { sortTableRows, useTableSort } from '../../../shared/utils/tableSort.js'

const TECHNIQUE_SORT_COLUMNS = {
  formName: item => item.formName,
  evaluationCount: { getValue: item => item.evaluationCount, type: 'number' },
  averageScore: { getValue: item => item.averageScore, type: 'number' },
  passRate: { getValue: item => item.passRate, type: 'number' },
  isPassed: { getValue: item => item.isPassed, type: 'boolean' },
}
const ATTEMPT_SORT_COLUMNS = {
  evaluatedAt: { getValue: item => item.evaluatedAt, type: 'date' },
  formName: item => item.formName,
  score: { getValue: item => item.score, type: 'number' },
  passed: { getValue: item => item.passed, type: 'boolean' },
}

function ComplianceEmployeeTechniqueDetailPage() {
  const { employeeId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedRow, setExpandedRow] = useState(null)
  const { sort, toggleSort } = useTableSort()
  const { sort: attemptSort, toggleSort: toggleAttemptSort } = useTableSort()

  const fromDate = searchParams.get('from') || `${new Date().getFullYear()}-01-01`
  const toDate = searchParams.get('to') || new Date().toISOString().slice(0, 10)

  const dashboardPath = isAdmin ? '/admin/dashboard' : '/manager/dashboard'
  const backPath = isAdmin ? '/admin/evaluation/compliance-by-technique' : '/manager/compliance-by-technique'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await competencyApi.getEmployeeByTechnique(employeeId, { fromDate, toDate })
      setData(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [employeeId, fromDate, toDate, showToast])

  useEffect(() => { loadData() }, [loadData])

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Tuân thủ chung', link: backPath },
    { label: data?.employeeName || 'Chi tiết' },
  ]

  const toggleExpand = (idx) => {
    setExpandedRow(expandedRow === idx ? null : idx)
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('vi-VN')
  }

  const handleBack = () => {
    const params = new URLSearchParams()
    params.set('from', fromDate)
    params.set('to', toDate)
    navigate(`${backPath}?${params.toString()}`)
  }

  const avatarLetter = data?.employeeName
    ? data.employeeName.trim().split(' ').pop().charAt(0).toUpperCase()
    : '?'

  const overallAvg = data?.overallAverageScore ?? null

  const hasData = data && data.items && data.items.length > 0
  const displayedItems = useMemo(
    () => sortTableRows(data?.items || [], sort, TECHNIQUE_SORT_COLUMNS, item => item.formId),
    [data?.items, sort],
  )

  return (
    <AppShell
      back={{ onClick: handleBack, label: 'Quay lại' }}
      breadcrumbs={isAdmin ? breadcrumbs : undefined}
      title={!isAdmin ? `Tuân thủ chung: ${data?.employeeName || '...'}` : undefined}
    >
            <div className="evd-page">

              {!loading && data && (
                <section className="evd-detail-summary">
                  <div className="evd-detail-summary__avatar">
                    {avatarLetter}
                  </div>
                  <div className="evd-detail-summary__identity">
                    <strong>{data.employeeName || '—'}</strong>
                    <span>
                      Mã NV: {data.employeeCode || '—'}
                      {data.departmentName ? ` · ${data.departmentName}` : ''}
                    </span>
                  </div>
                  <div className="evd-detail-summary__metrics">
                    <span>Điểm TB kỹ năng <strong>{overallAvg != null ? formatNumber(overallAvg) : '—'}</strong></span>
                  </div>
                  <button className="evd-btn" onClick={loadData} disabled={loading}>
                    <ReloadOutlined /> Tải lại
                  </button>
                </section>
              )}

              <div className="evd-card evd-x-table-card" style={{ marginTop: 16 }}>
                <table className="evd-table admin-table-uppercase">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <SortableTableHeader sortKey="formName" sort={sort} onSort={toggleSort}>Kỹ thuật</SortableTableHeader>
                      <SortableTableHeader sortKey="evaluationCount" sort={sort} onSort={toggleSort}>Số lần ĐG</SortableTableHeader>
                      <SortableTableHeader sortKey="averageScore" sort={sort} onSort={toggleSort}>Điểm TB</SortableTableHeader>
                      <th>Đạt/Không đạt</th>
                      <SortableTableHeader sortKey="passRate" sort={sort} onSort={toggleSort}>Tỷ lệ</SortableTableHeader>
                      <SortableTableHeader sortKey="isPassed" sort={sort} onSort={toggleSort}>Kết quả</SortableTableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="ch-empty">
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : !hasData ? (
                      <tr>
                        <td colSpan={7} className="ch-empty">
                          Chưa có dữ liệu giám sát kỹ năng thực hành
                        </td>
                      </tr>
                    ) : (
                      displayedItems.map((item, idx) => (
                        <Fragment key={item.formId || item.formName || idx}>
                          <tr
                            className={item.belowTarget ? 'evd-row--danger' : (!item.isPassed ? 'evd-row--warning' : '')}
                            style={{ cursor: (item.attempts && item.attempts.length > 0) ? 'pointer' : 'default' }}
                            onClick={() => (item.attempts && item.attempts.length > 0) && toggleExpand(idx)}
                          >
                            <td style={{ textAlign: 'center' }}>
                              {item.attempts && item.attempts.length > 0 && (
                                <span style={{
                                  display: 'inline-block',
                                  transition: 'transform 0.2s',
                                  transform: expandedRow === idx ? 'rotate(90deg)' : 'rotate(0deg)',
                                  fontSize: 12,
                                  color: '#6b7280',
                                }}>▶</span>
                              )}
                            </td>
                            <td style={{ fontWeight: 500 }}>{item.formName || '—'}</td>
                            <td>{item.evaluationCount}</td>
                            <td>{formatNumber(item.averageScore)}</td>
                            <td>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>
                                {item.passCount ?? 0}/{item.evaluationCount ?? 0}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                color: item.belowTarget ? '#dc2626' : '#16a34a',
                                fontWeight: 600,
                              }}>
                                {item.passRate != null ? `${item.passRate}%` : '—'}
                              </span>
                            </td>
                            <td>
                              <PassFailBadge passed={item.isPassed} />
                            </td>
                          </tr>
                          {expandedRow === idx && item.attempts && item.attempts.length > 0 && (
                            <tr key={`exp-${idx}`} className="evd-expand-row">
                              <td colSpan={7} style={{ padding: 0, background: '#f9fafb' }}>
                                <div style={{ padding: '12px 24px 12px 60px' }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                                    Lịch sử giám sát — {item.formName}
                                  </div>
                                  <table className="evd-detail-table admin-table-uppercase">
                                    <thead>
                                      <tr>
                                        <SortableTableHeader sortKey="evaluatedAt" sort={attemptSort} onSort={toggleAttemptSort}>Ngày ĐG</SortableTableHeader>
                                        <th>Người ĐG</th>
                                        <SortableTableHeader sortKey="formName" sort={attemptSort} onSort={toggleAttemptSort}>Quy trình</SortableTableHeader>
                                        <SortableTableHeader sortKey="score" sort={attemptSort} onSort={toggleAttemptSort}>Điểm</SortableTableHeader>
                                        <SortableTableHeader sortKey="passed" sort={attemptSort} onSort={toggleAttemptSort}>Kết quả</SortableTableHeader>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortTableRows(item.attempts, attemptSort, ATTEMPT_SORT_COLUMNS).map((att, aIdx) => (
                                        <tr key={aIdx}>
                                          <td>{formatDate(att.evaluatedAt)}</td>
                                          <td>{att.evaluatedBy || '—'}</td>
                                          <td className="evd-detail-table__muted">{att.formName || '—'}</td>
                                          <td className="evd-detail-table__score">{att.score != null ? String(att.score) : '—'}</td>
                                          <td>
                                            <span style={{
                                              color: att.passed ? '#16a34a' : '#dc2626',
                                              fontWeight: 600,
                                              fontSize: 12,
                                            }}>
                                              {att.passed ? 'Đạt' : 'Không đạt'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
    </AppShell>
  )
}

export default ComplianceEmployeeTechniqueDetailPage
