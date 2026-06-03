'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
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

function statusLabel(status) {
  return status === 'paid' || status === 'success' ? 'Đã thanh toán' : 'Chưa thanh toán';
}

function statusClass(status) {
  return status === 'paid' || status === 'success' ? 'active' : 'status-yellow';
}

function FinanceManagement() {
  const [activeTab, setActiveTab] = useState('statistics');
  const [summary, setSummary] = useState({});
  const [allPayments, setAllPayments] = useState([]);
  const [allSalaries, setAllSalaries] = useState([]);
  const [charts, setCharts] = useState({ labels: [], revenue: [], salary: [], profit: [] });
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(false);

  const [paymentFilter, setPaymentFilter] = useState('all');
  const [salaryFilter, setSalaryFilter] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');

  useEffect(() => {
    setLoading(true);
    axios.get('/v1/admin/finance/summary')
      .then((res) => {
        setSummary(res.data.data?.summary || {});
        setCharts(res.data.data?.charts || { labels: [], revenue: [], salary: [], profit: [] });
        setAllSalaries(res.data.data?.salaryRows || []);
      })
      .catch(() => setSummary({}))
      .finally(() => setLoading(false));

    axios.get('/api/finance/transactions/')
      .then((res) => {
        const transactions = res.data || [];
        const tuitionTransactions = transactions
          .filter(tx => tx.type === 'tuition_fee')
          .map(tx => ({
            id: tx.id,
            parent: tx.user_id?.full_name || tx.user_id?.first_name || tx.user_id?.username || 'N/A',
            className: tx.enrollment_id?.class_id?.subject_name || 'Lớp học',
            classId: tx.enrollment_id?.class_id?.id,
            amount: tx.amount,
            date: tx.updated_at ? new Date(tx.updated_at).toLocaleDateString('vi-VN') : '',
            status: tx.status,
          }));
        setAllPayments(tuitionTransactions);
      })
      .catch(() => setAllPayments([]));

    axios.get('/api/finance/enrollments/')
      .then((res) => {
        const enrollmentData = res.data || [];
        setEnrollments(enrollmentData.map(e => ({
          id: e.id,
          className: e.class_id?.subject_name || 'N/A',
          classId: e.class_id?.id,
          student: e.student_id?.full_name || 'N/A',
          paymentStatus: e.status,
          tuitionFee: e.class_id?.tuition_fee || 0,
        })));
      })
      .catch(() => setEnrollments([]));
  }, []);

  const revenue = summary.netRevenue || 0;
  const salary = summary.tutorSalaryTotal || 0;
  const profit = summary.expectedProfit || 0;
  const uncollected = summary.uncollectedTuition || 0;

  const filteredPayments = allPayments.filter(p => {
    if (paymentFilter === 'paid') return p.status === 'success';
    if (paymentFilter === 'unpaid') return p.status !== 'success';
    return true;
  });

  const filteredSalaries = allSalaries.filter(s => {
    let matches = true;
    if (salaryFilter === 'paid') matches = matches && s.status === 'paid';
    if (salaryFilter === 'unpaid') matches = matches && s.status !== 'paid';
    if (selectedClass !== 'all') matches = matches && s.classes >= parseInt(selectedClass);
    return matches;
  });

  const uniqueSubjects = [...new Set(allSalaries.map(s => s.tutorName))];

  const classPaymentStatus = enrollments.reduce((acc, e) => {
    const key = e.className;
    if (!acc[key]) {
      acc[key] = { className: key, paid: 0, unpaid: 0, total: 0, totalFee: 0 };
    }
    acc[key].total += 1;
    acc[key].totalFee += Number(e.tuitionFee || 0);
    if (e.paymentStatus === 'paid' || e.paymentStatus === 'active') {
      acc[key].paid += 1;
    } else {
      acc[key].unpaid += 1;
    }
    return acc;
  }, {});

  const classStatusArray = Object.values(classPaymentStatus);

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
          <section className="stat-row">
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

          <section className="panel-grid-2">
            <article className="table-card">
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.length === 0 ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center' }}>Không có dữ liệu</td></tr>
                    ) : (
                      filteredPayments.map((p) => (
                        <tr key={p.id}>
                          <td><strong>{p.parent}</strong></td>
                          <td>{p.className}</td>
                          <td><strong>{money(p.amount)}</strong></td>
                          <td>{p.date}</td>
                          <td>
                            <span className={`status-badge ${statusClass(p.status)}`}>
                              {statusLabel(p.status)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="table-card">
              <h2>Trạng thái thanh toán theo lớp</h2>
              <div className="table-wrapper">
                <table className="admin-table compact-table">
                  <thead>
                    <tr>
                      <th>Lớp học</th>
                      <th>Đã thanh toán</th>
                      <th>Chưa thanh toán</th>
                      <th>Tổng học viên</th>
                      <th>Tổng học phí</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStatusArray.length === 0 ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center' }}>Không có dữ liệu</td></tr>
                    ) : (
                      classStatusArray.map((c, idx) => (
                        <tr key={idx}>
                          <td><strong>{c.className}</strong></td>
                          <td><span className="status-badge active">{c.paid}</span></td>
                          <td><span className="status-badge status-yellow">{c.unpaid}</span></td>
                          <td>{c.total}</td>
                          <td><strong>{money(c.totalFee)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
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
            <div className="filter-group">
              <label>Số lớp:</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="all">Tất cả</option>
                <option value="1">≥ 1 lớp</option>
                <option value="2">≥ 2 lớp</option>
                <option value="3">≥ 3 lớp</option>
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
                    <th>Buổi dạy</th>
                    <th>Lương</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalaries.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center' }}>Không có dữ liệu</td></tr>
                  ) : (
                    filteredSalaries.map((s) => (
                      <tr key={s.tutorId}>
                        <td><strong>{s.tutorName}</strong></td>
                        <td>{s.classes}</td>
                        <td>{s.sessionLabel || `${s.sessions || 0} buổi trong tháng`}</td>
                        <td><strong>{money(s.salary)}</strong></td>
                        <td>
                          <span className={`status-badge ${statusClass(s.status)}`}>
                            {statusLabel(s.status)}
                          </span>
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
    </main>
  );
}

export default FinanceManagement;
