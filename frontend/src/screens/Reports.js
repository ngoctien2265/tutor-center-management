'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Dashboard.css';

const maxOf = (values, fallback = 10) => Math.ceil(Math.max(fallback, ...(values || []).map((v) => Number(v) || 0)) * 1.2 / 5) * 5;

function SimpleBar({ labels = [], values = [], color = '#2563eb' }) {
  const safeLabels = labels.length ? labels : ['Chưa có dữ liệu'];
  const safeValues = safeLabels.map((_, i) => Number(values[i] || 0));
  const max = maxOf(safeValues, 5);
  const step = 500 / Math.max(safeLabels.length, 1);
  return (
    <svg className="chart-svg" viewBox="0 0 620 345" role="img">
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="70" x2="590" y1={50 + i * 58} y2={50 + i * 58} stroke="#d1d5db" strokeDasharray="4 4" />)}
      <line x1="70" x2="590" y1="282" y2="282" stroke="#64748b" />
      <line x1="70" x2="70" y1="50" y2="282" stroke="#64748b" />
      {[0, max * 0.25, max * 0.5, max * 0.75, max].map((v, i) => <text key={v} x="58" y={288 - i * 58} textAnchor="end" fill="#64748b" fontSize="15">{Math.round(v)}</text>)}
      {safeValues.map((v, i) => {
        const barW = Math.min(70, step * 0.54);
        const h = (v / max) * 232;
        return (
          <g key={`${safeLabels[i]}-${i}`}>
            <rect x={70 + i * step + step / 2 - barW / 2} y={282 - h} width={barW} height={h} rx="8" fill={color} />
            <text x={70 + i * step + step / 2} y={270 - h} textAnchor="middle" fill="#0f172a" fontSize="14" fontWeight="800">{v}</text>
          </g>
        );
      })}
      {safeLabels.map((m, i) => <text key={m} x={70 + i * step + step / 2} y="316" textAnchor="middle" fill="#64748b" fontSize="14">{m}</text>)}
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
    <svg className="chart-svg" viewBox="0 0 620 345" role="img">
      <g transform="translate(190 172) rotate(-90)">
        <circle r={radius} cx="0" cy="0" fill="none" stroke="#e5e7eb" strokeWidth="34" />
        {total > 0 && safeValues.map((value, index) => {
          const length = (value / total) * circumference;
          const strokeDasharray = `${length} ${circumference - length}`;
          const strokeDashoffset = -offset;
          offset += length;
          return <circle key={`${safeLabels[index]}-${index}`} r={radius} cx="0" cy="0" fill="none" stroke={colors[index % colors.length]} strokeWidth="34" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />;
        })}
      </g>
      <text x="190" y="162" textAnchor="middle" fill="#64748b" fontSize="15" fontWeight="700">Tổng lớp</text>
      <text x="190" y="194" textAnchor="middle" fill="#020617" fontSize="34" fontWeight="850">{total}</text>
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

function Reports() {
  const [data, setData] = useState(null);
  useEffect(() => {
    axios.get('/v1/admin/dashboard')
      .then((res) => setData(res.data.data))
      .catch(() => setData(null));
  }, []);

  const totals = data?.totals || {};
  const charts = data?.charts || {};
  const subjectLabels = (charts.subjectDistribution || []).map((i) => i.subject_name || 'Chưa cập nhật');
  const subjectValues = (charts.subjectDistribution || []).map((i) => i.count || 0);
  const gradeLabels = (charts.gradeDistribution || []).map((i) => i.grade_level || 'Chưa cập nhật');
  const gradeValues = (charts.gradeDistribution || []).map((i) => i.count || 0);

  return (
    <main className="dashboard-container reports-polished">
      <h1>Báo cáo thống kê</h1>
      <section className="stat-row three report-stat-row">
        <article className="admin-stat report-big-stat">
          <span className="icon blue">▰</span>
          <p>Tổng số lớp học</p>
          <h3>{totals.classes || 0}</h3>
          <span className="muted">Số lớp đang hoạt động: {totals.activeClasses || 0}</span>
        </article>
        <article className="admin-stat report-big-stat">
          <span className="icon green">♙</span>
          <p>Tổng số gia sư</p>
          <h3>{totals.tutors || 0}</h3>
          <span className="muted">Số gia sư đang dạy</span>
        </article>
        <article className="admin-stat report-big-stat">
          <span className="icon purple">♁</span>
          <p>Tổng số học viên</p>
          <h3>{totals.students || 0}</h3>
          <span className="muted">Số học viên đã đăng ký</span>
        </article>
      </section>
      <section className="panel-grid-2">
        <article className="chart-card"><h2>Phân bố môn học trong hệ thống</h2><SimpleBar labels={subjectLabels} values={subjectValues} color="#0ea5e9" /></article>
        <article className="chart-card"><h2>Phân bố lớp trong hệ thống</h2><DonutChart labels={gradeLabels} values={gradeValues} /></article>
      </section>
    </main>
  );
}

export default Reports;
