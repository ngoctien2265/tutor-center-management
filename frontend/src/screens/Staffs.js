'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import AdminProfileModal from '../components/AdminProfileModal';
import './Dashboard.css';
import './ListPage.css';

function Staffs() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState(null);

  const load = () => axios.get('/v1/admin/staff', { params: { page: 1, limit: 100 } })
    .then((res) => setItems(res.data.data?.items || []))
    .catch(() => toast.error('Không tải được danh sách nhân viên.'));

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((s) => `${s.display_name || s.full_name || s.username || ''} ${s.email || ''}`.toLowerCase().includes(q));
  }, [items, query]);

  const total = items.length;
  const active = items.filter((s) => s.status === 'active').length;
  const pending = items.filter((s) => s.status !== 'active').length;

  const verify = async (id) => {
    try {
      await axios.post(`/v1/admin/staff/${id}/verify`);
      toast.success('Đã duyệt nhân viên.');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không duyệt được nhân viên.');
    }
  };

  const unverify = async (id) => {
    try {
      await axios.post(`/v1/admin/staff/${id}/unverify`);
      toast.success('Đã hủy duyệt nhân viên.');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không hủy duyệt được nhân viên.');
    }
  };

  const viewProfile = async (id) => {
    try {
      const res = await axios.get(`/v1/admin/users/${id}/profile`);
      setProfile(res.data.data);
    } catch {
      toast.error('Không xem được hồ sơ nhân viên.');
    }
  };

  return (
    <main className="list-container">
      <h1>Quản lý nhân viên</h1>
      <section className="stat-row three">
        <article className="admin-stat"><p>Tổng nhân viên</p><h3>{total}</h3></article>
        <article className="admin-stat"><p>Đang làm việc</p><h3 style={{ color: '#16a34a' }}>{active}</h3></article>
        <article className="admin-stat"><p>Chờ duyệt</p><h3 style={{ color: '#d97706' }}>{pending}</h3></article>
      </section>

      <section className="table-card">
        <div className="admin-toolbar"><h2>Danh sách nhân viên</h2></div>
        <div className="search-box"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kiếm nhân viên..." /></div>
        <table className="admin-table" style={{ marginTop: 20 }}>
          <thead><tr><th>Họ tên</th><th>Email</th><th>Số điện thoại</th><th>Trạng thái</th><th>Ngày vào làm</th><th>Thao tác</th></tr></thead>
          <tbody>
            {filtered.map((staff) => {
              const isActive = staff.status === 'active';
              return (
                <tr key={staff.id}>
                  <td><strong>{staff.display_name || staff.full_name || staff.username}</strong></td>
                  <td>{staff.email}</td>
                  <td>{staff.phone || '-'}</td>
                  <td><span className={`status-badge ${isActive ? 'active' : 'status-yellow'}`}>{isActive ? 'Đang làm việc' : 'Chờ duyệt'}</span></td>
                  <td>{staff.created_at ? new Date(staff.created_at).toLocaleDateString('vi-VN') : '-'}</td>
                  <td className="action-buttons">
                    <button className="icon-button primary" title="Xem" onClick={() => viewProfile(staff.id)}>⊙</button>
                    <button className="icon-button success" title="Duyệt" onClick={() => verify(staff.id)}>✓</button>
                    <button className="icon-button danger" title="Hủy duyệt" onClick={() => unverify(staff.id)}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <AdminProfileModal profile={profile} onClose={() => setProfile(null)} />
    </main>
  );
}

export default Staffs;
