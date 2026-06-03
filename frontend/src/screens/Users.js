'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './Dashboard.css';
import './ListPage.css';

const emptyForm = {
  id: null,
  fullName: '',
  email: '',
  phone: '',
  role: 'staff',
  password: '',
  address: '',
  status: 'active',
};

function roleText(role) {
  return { staff: 'Nhân viên', tutor: 'Gia sư', student: 'Học viên' }[role] || role;
}

function roleClass(role) {
  return { staff: 'role-staff', tutor: 'role-tutor', student: 'role-student' }[role] || 'role-staff';
}

function approvalText(status) {
  return status === 'active' ? 'Đã duyệt' : 'Chờ duyệt';
}

function approvalClass(status) {
  return status === 'active' ? 'active' : 'status-yellow';
}

function validateForm(form, editing) {
  const errors = [];
  if (!form.fullName.trim()) errors.push('Vui lòng nhập họ tên.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.push('Email không đúng định dạng.');
  if (!/^(0|\+84)[0-9]{9,10}$/.test(form.phone)) errors.push('Số điện thoại phải bắt đầu bằng 0 hoặc +84 và có 10-11 số.');
  if (!editing && (!form.password || form.password.length < 6)) errors.push('Mật khẩu tối thiểu 6 ký tự.');
  return errors;
}

function AccountModal({ mode, form, setForm, onClose, onSubmit }) {
  if (!mode) return null;
  const editing = mode === 'edit';
  const title = editing ? 'Xem / sửa tài khoản' : 'Thêm tài khoản';
  return (
    <div className="form-modal-backdrop" onClick={onClose}>
      <div className="form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="form-modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>
        <div className="form-grid two">
          {editing && <label>ID<input value={form.id || ''} disabled /></label>}
          <label>Họ tên<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="VD: Nguyễn Văn Nam" /></label>
          <label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="VD: nam@gmail.com" /></label>
          <label>Số điện thoại<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="VD: 0901234567" /></label>
          <label>Vai trò<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="staff">Nhân viên</option><option value="tutor">Gia sư</option><option value="student">Học viên</option></select></label>
          <label>Địa chỉ<input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="VD: Quận 1, TP.HCM" /></label>
          <label>{editing ? 'Mật khẩu mới (bỏ trống nếu không đổi)' : 'Mật khẩu'}<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 6 ký tự" /></label>
        </div>
        <div className="form-modal-actions">
          <button className="button secondary" onClick={onClose}>Hủy</button>
          <button className="primary-button" onClick={onSubmit}>{editing ? 'Lưu thay đổi' : 'Thêm tài khoản'}</button>
        </div>
      </div>
    </div>
  );
}

function Users() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [openActionsId, setOpenActionsId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const reload = () => axios.get('/v1/admin/users', { params: { page: 1, page_size: 200 } })
    .then((response) => setItems((response.data.data?.items || response.data.results || []).filter((u) => ['staff', 'tutor', 'student'].includes(u.role))))
    .catch(() => toast.error('Không tải được danh sách tài khoản.'));

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((user) => {
      const matchesQuery = !q || `${user.display_name || user.full_name || user.username || ''} ${user.email || ''} ${roleText(user.role)}`.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'approved' && user.status === 'active')
        || (statusFilter === 'pending' && user.status !== 'active')
        || (statusFilter === 'active' && user.is_active)
        || (statusFilter === 'locked' && !user.is_active);
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [items, query, roleFilter, statusFilter]);

  const openAdd = () => {
    setForm(emptyForm);
    setModalMode('add');
  };

  const openEdit = (user) => {
    setForm({
      id: user.id,
      fullName: user.display_name || user.full_name || user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'staff',
      password: '',
      address: user.address || '',
      status: user.status || 'active',
    });
    setModalMode('edit');
  };

  const submitForm = async () => {
    const errors = validateForm(form, modalMode === 'edit');
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    const payload = { ...form };
    if (modalMode === 'edit' && !payload.password) delete payload.password;
    try {
      if (modalMode === 'edit') await axios.patch(`/v1/admin/users/${form.id}`, payload);
      else await axios.post('/v1/admin/users', payload);
      toast.success(modalMode === 'edit' ? 'Đã cập nhật tài khoản.' : 'Đã thêm tài khoản.');
      setModalMode(null);
      reload();
    } catch (error) {
      const message = error.response?.data?.message;
      toast.error(typeof message === 'string' ? message : Object.values(message || {})[0] || 'Không lưu được tài khoản.');
    }
  };

  const toggleAccount = async (user) => {
    if (user.role === 'admin') {
      toast.info('Không khóa tài khoản admin.');
      return;
    }
    const action = user.is_active ? 'lock' : 'unlock';
    try {
      await axios.post(`/v1/admin/users/${user.id}/${action}`);
      toast.success(user.is_active ? 'Đã khóa tài khoản.' : 'Đã mở tài khoản.');
      reload();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không cập nhật được trạng thái tài khoản.');
    }
  };

  const approveAccount = async (user) => {
    try {
      await axios.post(`/v1/admin/users/${user.id}/approve`);
      toast.success('Đã duyệt tài khoản.');
      reload();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không duyệt được tài khoản.');
    }
  };

  const rejectAccount = async (user) => {
    try {
      await axios.post(`/v1/admin/users/${user.id}/reject`);
      toast.success('Đã hủy duyệt tài khoản.');
      reload();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không hủy duyệt được tài khoản.');
    }
  };

  const deleteAccount = async (user) => {
    if (user.role === 'admin') {
      toast.info('Không được xóa tài khoản admin.');
      return;
    }
    if (!window.confirm(`Xóa tài khoản ${user.display_name || user.username}?`)) return;
    try {
      await axios.delete(`/v1/admin/users/${user.id}/delete`);
      toast.success('Đã xóa tài khoản.');
      reload();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không xóa được tài khoản.');
    }
  };

  return (
    <main className="list-container">
      <h1>Quản lý tài khoản</h1>

      <section className="table-card">
        <div className="admin-toolbar">
          <h2>Quản lý tài khoản người dùng</h2>
          <button className="primary-button" onClick={openAdd}>+ Thêm tài khoản</button>
        </div>

        <div className="list-controls user-filter-controls">
          <div className="search-box">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kiếm theo tên hoặc email..." />
          </div>
          <select className="admin-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">Tất cả vai trò</option>
            <option value="staff">Nhân viên</option>
            <option value="tutor">Gia sư</option>
            <option value="student">Học viên</option>
          </select>
          <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="approved">Đã duyệt</option>
            <option value="pending">Chờ duyệt</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Đã khóa</option>
          </select>
        </div>

        <table className="admin-table" style={{ marginTop: 20 }}>
          <thead><tr><th>Họ tên</th><th>Email</th><th>SĐT</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.display_name || user.full_name || user.username || '-'}</strong></td>
                <td>{user.email || '-'}</td>
                <td>{user.phone || '-'}</td>
                <td><span className={`role-badge ${roleClass(user.role)}`}>{roleText(user.role)}</span></td>
                <td>
                  <span className={`status-badge ${approvalClass(user.status)}`}>{approvalText(user.status)}</span>
                  <br />
                  <span className={`status-badge ${user.is_active ? 'active' : 'locked'}`} style={{ marginTop: 6 }}>{user.is_active ? 'Hoạt động' : 'Đã khóa'}</span>
                </td>
                <td>{user.date_joined ? new Date(user.date_joined).toLocaleDateString('vi-VN') : '-'}</td>
                <td className="action-buttons more-actions-cell">
                  <button className="icon-button" title="Thêm thao tác" onClick={() => setOpenActionsId(openActionsId === user.id ? null : user.id)}>⋯</button>
                  {openActionsId === user.id && (
                    <div className="more-actions-menu">
                      <button onClick={() => { openEdit(user); setOpenActionsId(null); }}>Xem / sửa</button>
                      <button onClick={() => { approveAccount(user); setOpenActionsId(null); }}>Duyệt tài khoản</button>
                      <button onClick={() => { rejectAccount(user); setOpenActionsId(null); }}>Không duyệt / hủy duyệt</button>
                      <button onClick={() => { toggleAccount(user); setOpenActionsId(null); }}>{user.is_active ? 'Khóa đăng nhập' : 'Mở đăng nhập'}</button>
                      {user.role !== 'admin' && <button className="danger" onClick={() => { deleteAccount(user); setOpenActionsId(null); }}>Xóa tài khoản</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <AccountModal mode={modalMode} form={form} setForm={setForm} onClose={() => setModalMode(null)} onSubmit={submitForm} />
    </main>
  );
}

export default Users;
