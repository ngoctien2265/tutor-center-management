'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import AdminProfileModal from '../components/AdminProfileModal';
import './Dashboard.css';
import './ListPage.css';

function Parents() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);

  const load = () => axios.get('/v1/admin/parents')
    .then((res) => setItems(res.data.data?.items || []))
    .catch(() => toast.error('Không tải được danh sách phụ huynh.'));

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((p) => `${p.name || ''} ${p.email || ''} ${p.phone || ''}`.toLowerCase().includes(q));
  }, [items, query]);

  const view = async (p) => {
    try {
      const res = await axios.get(`/v1/admin/users/${p.userId}/profile`);
      setDetail(res.data.data);
    } catch {
      toast.error('Không xem được hồ sơ phụ huynh.');
    }
  };

  const verifyParent = async (p) => {
    try {
      await axios.post(`/v1/admin/parents/${p.id}/verify`);
      toast.success('Đã duyệt tài khoản phụ huynh.');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không duyệt được phụ huynh.');
    }
  };

  const unverifyParent = async (p) => {
    try {
      await axios.post(`/v1/admin/parents/${p.id}/unverify`);
      toast.success('Đã hủy duyệt tài khoản phụ huynh.');
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không hủy duyệt được phụ huynh.');
    }
  };

  const approved = items.filter((p) => p.status === 'active').length;
  const pending = items.filter((p) => p.status !== 'active').length;

  return (
    <main className="list-container">
      <h1>Quản lý phụ huynh</h1>
      <section className="stat-row three">
        <article className="admin-stat"><p>Tổng phụ huynh</p><h3>{items.length}</h3></article>
        <article className="admin-stat"><p>Đã duyệt</p><h3 style={{ color: '#16a34a' }}>{approved}</h3></article>
        <article className="admin-stat"><p>Chờ duyệt</p><h3 style={{ color: '#d97706' }}>{pending}</h3></article>
      </section>
      <section className="table-card">
        <div className="admin-toolbar"><h2>Danh sách phụ huynh</h2></div>
        <div className="search-box"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kiếm phụ huynh..." /></div>
        <table className="admin-table compact-table" style={{ marginTop: 20 }}>
          <thead><tr><th>Họ tên</th><th>Email</th><th>Số điện thoại</th><th>Số học viên</th><th>Lớp đang học</th><th>Trạng thái</th><th>Địa chỉ</th><th>Thao tác</th></tr></thead>
          <tbody>{filtered.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.name}</strong></td><td>{p.email}</td><td>{p.phone || '-'}</td><td>{p.students}</td><td>{p.activeClasses}</td>
              <td><span className={`status-badge ${p.status === 'active' ? 'active' : 'status-yellow'}`}>{p.status === 'active' ? 'Đã duyệt' : 'Chờ duyệt'}</span></td>
              <td>{p.address || '-'}</td>
              <td className="action-buttons">
                <button className="icon-button primary" title="Xem chi tiết" onClick={() => view(p)}>⊙</button>
                <button className="icon-button success" title="Duyệt" onClick={() => verifyParent(p)}>✓</button>
                <button className="icon-button danger" title="Hủy duyệt" onClick={() => unverifyParent(p)}>×</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <AdminProfileModal profile={detail} onClose={() => setDetail(null)} />
    </main>
  );
}
export default Parents;
