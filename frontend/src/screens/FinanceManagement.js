'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './Dashboard.css';
import './ListPage.css';
import './FinanceManagement.css';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const niceMax = (values, fallback = 10) => Math.ceil(Math.max(fallback, ...(values || []).map((v) => Number(v) || 0)) * 1.2 / 5) * 5;

function BarChart({ labels = [], revenue = [], salary = [] }) {
  const safeLabels = labels.length ? labels : ['T1','T2','T3','T4','T5','T6'];
  const max = niceMax([...revenue, ...salary], 10);
  const ticks = [0, max*.25, max*.5, max*.75, max];
  return <svg className="chart-svg" viewBox="0 0 620 360">{[0,1,2,3,4].map(i=><line key={i} x1="70" x2="590" y1={50+i*58} y2={50+i*58} stroke="#d1d5db" strokeDasharray="4 4" />)}{safeLabels.map((_,i)=><line key={'v'+i} x1={70+i*104} x2={70+i*104} y1="50" y2="282" stroke="#d1d5db" strokeDasharray="4 4" />)}<line x1="70" x2="590" y1="282" y2="282" stroke="#6b7280"/><line x1="70" x2="70" y1="50" y2="282" stroke="#6b7280"/>{ticks.map((v,i)=><text key={v} x="58" y={288-i*58} textAnchor="end" fill="#64748b" fontSize="15">{Math.round(v)}</text>)}{safeLabels.map((_,i)=>{const r=Number(revenue[i]||0), s=Number(salary[i]||0);return <g key={i}><rect x={86+i*104} y={282-(r/max)*232} width="24" height={(r/max)*232} fill="#f59e0b"/><rect x={114+i*104} y={282-(s/max)*232} width="24" height={(s/max)*232} fill="#3b82f6"/></g>})}{safeLabels.map((m,i)=><text key={m} x={112+i*104} y="310" textAnchor="middle" fill="#64748b" fontSize="17">{m}</text>)}<text x="220" y="342" fill="#f59e0b" fontSize="16">● Doanh thu</text><text x="340" y="342" fill="#3b82f6" fontSize="16">● Lương gia sư</text></svg>;
}

function LineChart({ labels = [], values = [] }) {
  const safeLabels = labels.length ? labels : ['T1','T2','T3','T4','T5','T6'];
  const max = niceMax(values, 10);
  const ticks = [0, max*.25, max*.5, max*.75, max];
  const vals = safeLabels.map((_, i) => Number(values[i] || 0));
  const pts = vals.map((v,i)=>`${70+i*104},${282-(v/max)*232}`).join(' ');
  return <svg className="chart-svg" viewBox="0 0 620 340">{[0,1,2,3,4].map(i=><line key={i} x1="70" x2="590" y1={50+i*58} y2={50+i*58} stroke="#d1d5db" strokeDasharray="4 4" />)}{safeLabels.map((_,i)=><line key={'v'+i} x1={70+i*104} x2={70+i*104} y1="50" y2="282" stroke="#d1d5db" strokeDasharray="4 4" />)}<line x1="70" x2="590" y1="282" y2="282" stroke="#6b7280"/><line x1="70" x2="70" y1="50" y2="282" stroke="#6b7280"/>{ticks.map((v,i)=><text key={v} x="58" y={288-i*58} textAnchor="end" fill="#64748b" fontSize="15">{Math.round(v)}</text>)}<polyline fill="none" stroke="#8b5cf6" strokeWidth="3" points={pts}/>{vals.map((v,i)=><circle key={i} cx={70+i*104} cy={282-(v/max)*232} r="4" fill="#fff" stroke="#8b5cf6" strokeWidth="3"/>)}{safeLabels.map((m,i)=><text key={m} x={70+i*104} y="310" textAnchor="middle" fill="#64748b" fontSize="17">{m}</text>)}</svg>;
}

function isPaidStatus(status) {
  return ['paid', 'success', 'completed'].includes(String(status || '').toLowerCase());
}

function statusLabel(status) {
  return isPaidStatus(status) ? 'Đã thanh toán' : 'Chưa thanh toán';
}

function statusClass(status) {
  return isPaidStatus(status) ? 'active' : 'status-yellow';
}

function FinanceManagement() {
  const [activeTab, setActiveTab] = useState('statistics');
  const [summary, setSummary] = useState({});
  const [allPayments, setAllPayments] = useState([]);
  const [allSalaries, setAllSalaries] = useState([]);
  const [charts, setCharts] = useState({ labels: [], revenue: [], salary: [], profit: [] });
  const [loading, setLoading] = useState(false);

  const [paymentFilter, setPaymentFilter] = useState('all');
  const [salaryFilter, setSalaryFilter] = useState('all');
  const [salaryPayment, setSalaryPayment] = useState(null);
  const [confirmingSalary, setConfirmingSalary] = useState(false);

  const loadFinance = () => {
    setLoading(true);
    axios.get('/v1/admin/finance/summary')
      .then((res) => {
        const data = res.data.data || {};
        setSummary(data.summary || {});
        setCharts(data.charts || { labels: [], revenue: [], salary: [], profit: [] });
        setAllPayments(data.paymentRows || data.recentPayments || []);
        setAllSalaries(data.salaryRows || []);
      })
      .catch(() => {
        setSummary({});
        setAllPayments([]);
        setAllSalaries([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFinance();
  }, []);

  const revenue = summary.netRevenue || 0;
  const salary = summary.tutorSalaryTotal || 0;
  const profit = summary.expectedProfit || 0;
  const uncollected = summary.uncollectedTuition || 0;

  const filteredPayments = allPayments.filter(p => {
    const paid = isPaidStatus(p.status);
    if (paymentFilter === 'paid') return paid;
    if (paymentFilter === 'unpaid') return !paid;
    return true;
  });

  const filteredSalaries = allSalaries.filter(s => {
    let matches = true;
    if (salaryFilter === 'paid') matches = matches && s.status === 'paid';
    if (salaryFilter === 'unpaid') matches = matches && s.status !== 'paid';
    return matches;
  });

  const updateTuitionStatus = async (row, nextStatus) => {
    try {
      await axios.post(`/v1/admin/finance/payments/${row.transactionId || row.id}/status`, { status: nextStatus });
      toast.success(nextStatus === 'paid' ? 'Đã xác nhận học phí.' : 'Đã chuyển về chưa thanh toán.');
      loadFinance();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không cập nhật được trạng thái học phí.');
    }
  };

  const hasTutorBankInfo = salaryPayment && (salaryPayment.bankName || salaryPayment.bankBranch || salaryPayment.bankAccountNumber);
  const confirmTutorSalary = async () => {
    if (!salaryPayment) return;
    setConfirmingSalary(true);
    try {
      await axios.post(`/v1/admin/finance/tutors/${salaryPayment.tutorId}/pay-salary`);
      setSalaryPayment(null);
      loadFinance();
    } catch (error) {
      alert(error.response?.data?.message || 'Không xác nhận được thanh toán lương gia sư. Vui lòng restart backend nếu endpoint chưa được nhận.');
    } finally {
      setConfirmingSalary(false);
    }
  };

  return (
    <main className="dashboard-container">
      <h1>Quản lý tài chính</h1>

      <div className="finance-tabs">
        <button
          className={`tab-button ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          Thống kê
        </button>
        <button
          className={`tab-button ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          Lịch sử thanh toán học phí
        </button>
        <button
          className={`tab-button ${activeTab === 'salaries' ? 'active' : ''}`}
          onClick={() => setActiveTab('salaries')}
        >
          Lương gia sư
        </button>
      </div>

      {activeTab === 'statistics' && (
        <>
          <section className="stat-row finance-stat-row">
            <article className="admin-stat money-card">
              <span className="icon green">$</span>
              <p>Doanh thu tháng này</p>
              <h3>{money(revenue)}</h3>
              <small>Đồng bộ từ học phí đã thanh toán</small>
            </article>
            <article className="admin-stat money-card">
              <span className="icon blue">▤</span>
              <p>Lương gia sư</p>
              <h3>{money(salary)}</h3>
              <span className="muted">Tổng lương dự kiến trong tháng</span>
            </article>
            <article className="admin-stat money-card">
              <span className="icon purple">↗</span>
              <p>Lợi nhuận</p>
              <h3>{money(profit)}</h3>
              <span className="muted">Doanh thu - lương gia sư</span>
            </article>
            <article className="admin-stat money-card">
              <span className="icon orange">▭</span>
              <p>Học phí chưa thu</p>
              <h3>{money(uncollected)}</h3>
              <span className="muted">Các khoản chưa thanh toán</span>
            </article>
          </section>

          <section className="panel-grid-2">
            <article className="chart-card">
              <h2>Doanh thu & chi phí của hệ thống (Triệu VNĐ)</h2>
              <BarChart labels={charts.labels} revenue={charts.revenue} salary={charts.salary} />
            </article>
            <article className="chart-card">
              <h2>Lợi nhuận của hệ thống (Triệu VNĐ)</h2>
              <LineChart labels={charts.labels} values={charts.profit} />
            </article>
          </section>
        </>
      )}

      {activeTab === 'payments' && (
        <>
          <section className="filter-bar">
            <div className="filter-group">
              <label>Trạng thái thanh toán:</label>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                <option value="all">Tất cả</option>
                <option value="paid">Đã thanh toán</option>
                <option value="unpaid">Chưa thanh toán</option>
              </select>
            </div>
          </section>

          <section className="table-card full-width finance-history-card">
            <h2>Lịch sử thanh toán học phí</h2>
            <div className="table-wrapper">
              <table className="admin-table compact-table">
                <thead>
                  <tr>
                    <th>Phụ huynh</th>
                    <th>Lớp học</th>
                    <th>Số tiền</th>
                    <th>Ngày</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center' }}>Không có dữ liệu</td></tr>
                  ) : (
                    filteredPayments.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.parent}</strong></td>
                        <td>{p.className}</td>
                        <td><strong>{money(p.amount)}</strong></td>
                        <td>{p.date}</td>
                        <td><span className={`status-badge ${statusClass(p.status)}`}>{statusLabel(p.status)}</span></td>
                        <td>
                          {isPaidStatus(p.status)
                            ? <button type="button" className="finance-action-btn secondary" onClick={() => updateTuitionStatus(p, 'unpaid')}>Chuyển chưa thanh toán</button>
                            : <button type="button" className="finance-action-btn" onClick={() => updateTuitionStatus(p, 'paid')}>Xác nhận</button>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'salaries' && (
        <>
          <section className="filter-bar">
            <div className="filter-group">
              <label>Trạng thái:</label>
              <select value={salaryFilter} onChange={(e) => setSalaryFilter(e.target.value)}>
                <option value="all">Tất cả</option>
                <option value="paid">Đã nhận lương</option>
                <option value="unpaid">Chưa nhận lương</option>
              </select>
            </div>
          </section>

          <section className="table-card full-width">
            <h2>Bảng lương gia sư tháng này</h2>
            <div className="table-wrapper">
              <table className="admin-table compact-table">
                <thead>
                  <tr>
                    <th>Gia sư</th>
                    <th>Số lớp</th>
                    <th>Tháng nhận lương</th>
                    <th>Tổng lương</th>
                    <th>Trạng thái thanh toán</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalaries.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center' }}>Không có dữ liệu</td></tr>
                  ) : (
                    filteredSalaries.map((s) => (
                      <tr key={s.tutorId}>
                        <td><strong>{s.tutorName}</strong></td>
                        <td>{s.classes}</td>
                        <td>{s.salaryMonth || charts.monthLabel || 'Tháng này'}</td>
                        <td><strong>{money(s.salary)}</strong></td>
                        <td>
                          <span className={`status-badge ${statusClass(s.status)}`}>
                            {statusLabel(s.status)}
                          </span>
                        </td>
                        <td>
                          {s.status === 'paid' ? <span className="muted">Đã thanh toán</span> : <button type="button" className="finance-action-btn" onClick={() => setSalaryPayment(s)}>Thanh toán</button>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {salaryPayment && (
        <div className="finance-modal-backdrop" onClick={() => setSalaryPayment(null)}>
          <section className="finance-payment-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="finance-modal-close" onClick={() => setSalaryPayment(null)}>×</button>
            <h2>Thanh toán lương gia sư</h2>
            <p className="muted">Chuyển khoản theo thông tin ngân hàng gia sư đã cập nhật, sau đó bấm xác nhận thanh toán.</p>
            <div className="salary-payment-grid bank-payment-grid">
              <div className="bank-info-card">
                <span>Thông tin chuyển khoản</span>
                <h3>{salaryPayment.bankName || 'Chưa cập nhật ngân hàng'}</h3>
                <p><strong>Chi nhánh:</strong> {salaryPayment.bankBranch || 'Chưa cập nhật'}</p>
                <p><strong>Số tài khoản:</strong> {salaryPayment.bankAccountNumber || 'Chưa cập nhật'}</p>
                <p><strong>Chủ tài khoản:</strong> {salaryPayment.tutorName}</p>
              </div>
              <div className="salary-payment-info">
                <p><strong>Gia sư:</strong> {salaryPayment.tutorName}</p>
                <p><strong>Số lớp:</strong> {salaryPayment.classes}</p>
                <p><strong>Buổi được staff duyệt:</strong> {salaryPayment.approvedSessions || 0}/{salaryPayment.totalMonthlySessions || 0}</p>
                <p><strong>Số tiền cần thanh toán:</strong> {money(salaryPayment.salary)}</p>
                {!hasTutorBankInfo && <div className="bank-warning">Gia sư chưa cập nhật đầy đủ thông tin ngân hàng. Vui lòng yêu cầu gia sư cập nhật trước khi chuyển khoản.</div>}
              </div>
            </div>
            <div className="finance-modal-actions">
              <button type="button" className="finance-action-btn primary" disabled={confirmingSalary} onClick={confirmTutorSalary}>{confirmingSalary ? 'Đang xác nhận...' : 'Xác nhận thanh toán'}</button>
              <button type="button" className="finance-action-btn secondary" onClick={() => setSalaryPayment(null)}>Đóng</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default FinanceManagement;
