'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import AdminProfileModal from '../components/AdminProfileModal';
import './Dashboard.css';
import './ListPage.css';

function firstValue(value, fallback = 'Chưa cập nhật') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const parts = text.split(',').map((item) => item.trim()).filter(Boolean);
  return parts[0] || fallback;
}

function normalizeTutor(t, completedMap = {}) {
  return {
    ...t,
    email: t.user?.email || t.email,
    subjects: firstValue(t.teachable_subjects || t.subjects || t.major, 'Chưa cập nhật'),
    grades: firstValue(t.teachable_grades || t.grade_range || t.grades, 'Chưa cập nhật'),
    status: t.is_verified ? 'active' : 'pending',
    completed: completedMap[t.id] || t.completed_classes || t.completed || 0,
  };
}

function Tutors() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState(null);

  const load = async () => {
    try {
      const [tutorsRes, classesRes] = await Promise.allSettled([
        axios.get('/users/tutors/', { params: { page: 1, page_size: 200 } }),
        axios.get('/classes/', { params: { page: 1, page_size: 300 } }),
      ]);
      const completedMap = {};
      if (classesRes.status === 'fulfilled') {
        (classesRes.value.data.results || []).forEach((cls) => {
          if (cls.status === 'completed' && cls.tutor?.id) completedMap[cls.tutor.id] = (completedMap[cls.tutor.id] || 0) + 1;
        });
      }
      if (tutorsRes.status === 'fulfilled') {
        const mapped = (tutorsRes.value.data.results || []).map((t) => normalizeTutor(t, completedMap));
        setItems(mapped);
      }
    } catch {
      toast.error('Không tải được danh sách gia sư.');
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((t) => `${t.full_name || ''} ${t.email || ''} ${t.subjects || ''}`.toLowerCase().includes(q));
  }, [items, query]);

  const verifyTutor = async (tutor) => {
    try {
      await axios.post(`/v1/admin/tutors/${tutor.id}/verify`);
      toast.success('Đã duyệt hồ sơ gia sư.');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không duyệt được gia sư.');
    }
  };

  const unverifyTutor = async (tutor) => {
    try {
      await axios.post(`/v1/admin/tutors/${tutor.id}/unverify`);
      toast.success('Đã hủy duyệt hồ sơ gia sư.');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không hủy duyệt được gia sư.');
    }
  };

  const viewProfile = async (id) => {
    try {
      const res = await axios.get(`/v1/admin/users/${id}/profile`);
      setProfile(res.data.data);
    } catch {
      toast.error('Không xem được hồ sơ gia sư.');
    }
  };

  const total = items.length;
  const active = items.filter((t) => t.status === 'active').length;
  const pending = items.filter((t) => t.status === 'pending').length;

  return (
    <main className="list-container">
      <h1>Quản lý gia sư</h1>
      <section className="stat-row three">
        <article className="admin-stat"><p>Tổng gia sư</p><h3>{total}</h3></article>
        <article className="admin-stat"><p>Đã duyệt</p><h3 style={{ color: '#16a34a' }}>{active}</h3></article>
        <article className="admin-stat"><p>Chờ duyệt</p><h3 style={{ color: '#d97706' }}>{pending}</h3></article>
      </section>
      <section className="table-card">
        <div className="admin-toolbar"><h2>Danh sách gia sư</h2></div>
        <div className="search-box"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kiếm theo tên hoặc môn học..." /></div>
        <table className="admin-table" style={{ marginTop: 20 }}>
          <thead><tr><th>Họ tên</th><th>Email</th><th>Môn dạy</th><th>Khối lớp</th><th>Trạng thái</th><th>Đánh giá</th><th>Thao tác</th></tr></thead>
          <tbody>{filtered.map((tutor) => (
            <tr key={tutor.id}>
              <td><strong>{tutor.full_name}</strong></td><td>{tutor.email || '-'}</td>
              <td><span className="tag">{tutor.subjects}</span></td>
              <td><span className="tag">{tutor.grades}</span></td>
              <td><span className={`status-badge ${tutor.status === 'active' ? 'active' : 'status-yellow'}`}>{tutor.status === 'active' ? 'Đã duyệt' : 'Chờ duyệt'}</span></td>
              <td>{Number(tutor.rating || 0) > 0 ? <span className="rating">★ {Number(tutor.rating).toFixed(1)}</span> : <span className="muted">Chưa có</span>}</td>
              <td className="action-buttons">
                <button className="icon-button primary" title="Xem" onClick={() => viewProfile(tutor.user?.id)}>⊙</button>
                <button className="icon-button success" title="Duyệt" onClick={() => verifyTutor(tutor)}>✓</button>
                <button className="icon-button danger" title="Hủy duyệt" onClick={() => unverifyTutor(tutor)}>×</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <AdminProfileModal profile={profile} onClose={() => setProfile(null)} />
    </main>
  );
}

export default Tutors;
