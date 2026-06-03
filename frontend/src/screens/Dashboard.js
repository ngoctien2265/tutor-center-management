'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './Dashboard.css';

const moneyShort = (value) => {
  const n = Number(value || 0);
  if (n >= 1000000) return `${Math.round(n / 1000000)}M`;
  return n.toLocaleString('vi-VN');
};

const niceMax = (values, fallback = 10) => {
  const max = Math.max(...(values || []).map((v) => Number(v) || 0), fallback);
  return Math.ceil(max * 1.2 / 5) * 5 || fallback;
};

function BarChart({ values = [], labels = [], color = '#10b981', unit = '' }) {
  const max = niceMax(values, 10);
  const ticks = [0, max * 0.25, max * 0.5, max * 0.75, max];
  const safeLabels = labels.length ? labels : ['T1', 'T2', 'T3', 'T4'];
  const safeValues = safeLabels.map((_, i) => Number(values[i] || 0));
  const span = 500;
  const step = span / Math.max(safeLabels.length, 1);
  return (
    <svg className="chart-svg" viewBox="0 0 620 340" role="img">
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="70" x2="590" y1={50 + i * 58} y2={50 + i * 58} stroke="#d1d5db" strokeDasharray="4 4" />)}
      {safeLabels.map((_, i) => <line key={i} x1={70 + i * step + step / 2} x2={70 + i * step + step / 2} y1="50" y2="282" stroke="#d1d5db" strokeDasharray="4 4" />)}
      <line x1="70" x2="590" y1="282" y2="282" stroke="#6b7280" />
      <line x1="70" x2="70" y1="50" y2="282" stroke="#6b7280" />
      {ticks.map((v, i) => <text key={v} x="58" y={288 - i * 58} textAnchor="end" fill="#64748b" fontSize="15">{Math.round(v)}{unit}</text>)}
      {safeValues.map((v, i) => {
        const h = Math.max(v > 0 ? 8 : 0, (v / max) * 232);
        return <rect key={i} x={70 + i * step + step / 2 - 18} y={282 - h} width="36" height={h} rx="6" fill={color} />;
      })}
      {safeLabels.map((m, i) => <text key={m} x={70 + i * step + step / 2} y="310" textAnchor="middle" fill="#64748b" fontSize="14">{m}</text>)}
    </svg>
  );
}

function DonutChart({ labels = [], values = [] }) {
  const colors = ['#8b5cf6', '#0ea5e9', '#22c55e', '#f97316', '#ef4444', '#14b8a6', '#f59e0b'];
  const safeLabels = labels.length ? labels : ['Chưa có dữ liệu'];
  const safeValues = safeLabels.map((_, i) => Number(values[i] || 0));
  const total = safeValues.reduce((sum, value) => sum + value, 0);
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg className="chart-svg" viewBox="0 0 620 340" role="img">
      <g transform="translate(190 170) rotate(-90)">
        <circle r={radius} cx="0" cy="0" fill="none" stroke="#e5e7eb" strokeWidth="34" />
        {total > 0 && safeValues.map((value, index) => {
          const length = (value / total) * circumference;
          const strokeDasharray = `${length} ${circumference - length}`;
          const strokeDashoffset = -offset;
          offset += length;
          return <circle key={`${safeLabels[index]}-${index}`} r={radius} cx="0" cy="0" fill="none" stroke={colors[index % colors.length]} strokeWidth="34" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />;
        })}
      </g>
      <text x="190" y="160" textAnchor="middle" fill="#64748b" fontSize="15" fontWeight="700">Tổng lớp</text>
      <text x="190" y="192" textAnchor="middle" fill="#020617" fontSize="34" fontWeight="850">{total}</text>
      <g transform="translate(350 82)">
        {safeLabels.map((label, index) => {
          const value = safeValues[index];
          const percent = total ? Math.round((value / total) * 100) : 0;
          return (
            <g key={`${label}-${index}`} transform={`translate(0 ${index * 34})`}>
              <rect width="16" height="16" rx="5" fill={colors[index % colors.length]} />
              <text x="28" y="13" fill="#0f172a" fontSize="15" fontWeight="750">{label}</text>
              <text x="160" y="13" fill="#64748b" fontSize="14">{value} lớp · {percent}%</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function timeAgo(value) {
  if (!value) return 'Vừa xong';
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [finance, setFinance] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      axios.get('/v1/admin/dashboard'),
      axios.get('/v1/admin/finance/summary'),
    ]).then(([dashboardResult, financeResult]) => {
      if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value.data.data);
      if (financeResult.status === 'fulfilled') setFinance(financeResult.value.data.data);
    });
  }, []);

  const totals = dashboard?.totals || {};
  const charts = dashboard?.charts || {};
  const financeCharts = finance?.charts || {};
  const labels = charts.labels || financeCharts.labels || ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
  const overview = charts.overview || { labels: ['Tổng số gia sư', 'Tổng số học viên', 'Lớp đang hoạt động'], values: [totals.tutors || 0, totals.students || 0, totals.activeClasses || 0] };
  const topTutors = dashboard?.topTutors || [];
  const subjectLabels = (charts.subjectDistribution || []).map((item) => item.subject_name || 'Chưa cập nhật');
  const subjectValues = (charts.subjectDistribution || []).map((item) => item.count || 0);
  const gradeLabels = (charts.gradeDistribution || []).map((item) => item.grade_level || 'Chưa cập nhật');
  const gradeValues = (charts.gradeDistribution || []).map((item) => item.count || 0);

  return (
    <main className="dashboard-container">
      <h1>Tổng quan</h1>

      <section className="stat-row">
        <article className="admin-stat"><span className="icon blue">▱</span><p>Tổng số gia sư</p><h3>{totals.tutors || 0}</h3></article>
        <article className="admin-stat"><span className="icon green">♁</span><p>Tổng số học viên</p><h3>{totals.students || 0}</h3></article>
        <article className="admin-stat"><span className="icon purple">▰</span><p>Lớp đang hoạt động</p><h3>{totals.activeClasses || 0}</h3></article>
        <article className="admin-stat"><span className="icon orange">$</span><p>Doanh thu tháng này</p><h3>{moneyShort(finance?.summary?.netRevenue ?? totals.revenue)}</h3></article>
      </section>

      <section className="panel-grid-2">
        <article className="chart-card">
          <h2>Thống kê tổng quan hệ thống</h2>
          <BarChart labels={overview.labels} values={overview.values} color="#3b82f6" />
        </article>

        <article className="table-card">
          <h2>Top gia sư xuất sắc tháng này</h2>
          <div className="top-list">
            {topTutors.length ? topTutors.map((tutor) => (
              <div className="top-item" key={tutor.id || tutor.name}>
                <span className="avatar">{tutor.avatar || tutor.name?.[0]}</span>
                <div><strong>{tutor.name}</strong><br /><span>{tutor.description}</span></div>
                <span className="rating">★ {Number(tutor.rating || 0).toFixed(1)}</span>
              </div>
            )) : <p className="muted">Chưa có dữ liệu đánh giá gia sư.</p>}
          </div>
        </article>
      </section>

      <section className="panel-grid-2">
        <article className="chart-card">
          <h2>Phân bố môn học trong hệ thống</h2>
          <BarChart labels={subjectLabels} values={subjectValues} color="#0ea5e9" />
        </article>
        <article className="chart-card">
          <h2>Phân bố lớp trong hệ thống</h2>
          <DonutChart labels={gradeLabels} values={gradeValues} />
        </article>
      </section>
    </main>
  );
}

export default Dashboard;
