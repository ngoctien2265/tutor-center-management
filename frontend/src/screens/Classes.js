'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './Dashboard.css';
import './ListPage.css';

function derivedStatus(cls) {
  if (cls.status === 'cancelled') return 'cancelled';
  if (cls.status === 'completed') return 'completed';
  if (cls.status === 'waiting_student') return 'waiting_student';
  if (cls.status === 'teaching' || cls.tutor_name || cls.tutor?.id || cls.tutor) return 'teaching';
  return 'open';
}

function statusText(status) {
  return {
    open: 'Đang tìm gia sư',
    waiting_student: 'Đang chờ học viên',
    teaching: 'Đang dạy',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
  }[status] || status;
}

function statusClass(status) {
  return {
    open: 'status-orange',
    waiting_student: 'status-yellow',
    teaching: 'active',
    completed: 'status-blue',
    cancelled: 'locked',
  }[status] || 'status-blue';
}

function Classes() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');

  const load = () => axios.get('/classes/', { params: { page: 1, page_size: 300 } })
    .then((res) => {
      const mapped = (res.data.results || []).map((c) => ({
        ...c,
        tutor_name: c.tutor?.full_name || c.tutor?.user?.display_name || c.tutor?.user?.username || c.tutor_name || '',
      }));
      setItems(mapped);
    })
    .catch(() => toast.error('Không tải được danh sách lớp học.'));

  useEffect(() => { load(); }, []);

  const withStatus = useMemo(() => items.map((c) => ({ ...c, displayStatus: derivedStatus(c) })), [items]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return withStatus.filter((c) => `${c.subject_name || ''} ${c.grade_level || ''} ${c.tutor_name || ''} ${c.schedule_detail || ''}`.toLowerCase().includes(q));
  }, [withStatus, query]);

  const reviewClass = async (cls, decision) => {
    if (cls.displayStatus !== 'open') {
      toast.info('Chỉ xử lý duyệt/từ chối với lớp đang tìm gia sư.');
      return;
    }
    try {
      await axios.post(`/v1/admin/classes/${cls.id}/review`, { decision });
      toast.success(decision === 'APPROVED' ? 'Đã duyệt lớp học.' : 'Đã từ chối lớp học.');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không xử lý được lớp học.');
    }
  };

  return (
    <main className="list-container">
      <h1>Quản lý lớp học</h1>
      <section className="stat-row">
        <article className="admin-stat"><p>Tổng lớp học</p><h3>{items.length}</h3></article>
        <article className="admin-stat"><p>Đang dạy</p><h3 style={{ color: '#16a34a' }}>{withStatus.filter((c) => c.displayStatus === 'teaching').length}</h3></article>
        <article className="admin-stat"><p>Đang tìm gia sư</p><h3 style={{ color: '#d97706' }}>{withStatus.filter((c) => c.displayStatus === 'open').length}</h3></article>
        <article className="admin-stat"><p>Hoàn thành</p><h3 style={{ color: '#2563eb' }}>{withStatus.filter((c) => c.displayStatus === 'completed').length}</h3></article>
      </section>
      <section className="table-card">
        <div className="admin-toolbar"><h2>Danh sách lớp học</h2></div>
        <div className="search-box"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kiếm lớp học..." /></div>
        <table className="admin-table compact-table" style={{ marginTop: 20 }}>
          <thead><tr><th>Môn học</th><th>Khối lớp</th><th>Gia sư</th><th>Trạng thái</th><th>Học phí/tháng</th><th>Lịch học</th><th>Thao tác</th></tr></thead>
          <tbody>{filtered.map((cls) => (
            <tr key={cls.id}>
              <td><strong>{cls.subject_name}</strong></td>
              <td>{cls.grade_level}</td>
              <td>{cls.tutor_name || <span className="muted">Chưa có</span>}</td>
              <td><span className={`status-badge ${statusClass(cls.displayStatus)}`}>{statusText(cls.displayStatus)}</span></td>
              <td><strong>{Number(cls.tuition_fee || 0).toLocaleString('vi-VN')}đ</strong></td>
              <td>{cls.schedule_detail || '-'}</td>
              <td className="action-buttons">
                {cls.displayStatus === 'open' ? (
                  <>
                    <button className="icon-button success" title="Duyệt lớp học" onClick={() => reviewClass(cls, 'APPROVED')}>✓</button>
                    <button className="icon-button danger" title="Từ chối lớp học" onClick={() => reviewClass(cls, 'REJECTED')}>×</button>
                  </>
                ) : <span className="muted">—</span>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </main>
  );
}

export default Classes;
