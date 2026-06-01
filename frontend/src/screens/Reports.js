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
          <span className="muted">Số học viên của phụ huynh</span>
        </article>
      </section>
      <section className="panel-grid-2">
        <article className="chart-card"><h2>Phân bố môn học trong hệ thống</h2><SimpleBar labels={subjectLabels} values={subjectValues} color="#0ea5e9" /></article>
        <article className="chart-card"><h2>Phân bố lớp trong hệ thống</h2><SimpleBar labels={gradeLabels} values={gradeValues} color="#8b5cf6" /></article>
      </section>
    </main>
  );
}

export default Reports;
