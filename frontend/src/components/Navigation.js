'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import './Navigation.css';

const roleLabels = { admin: 'Admin', staff: 'Nhân viên', tutor: 'Gia sư', student: 'Học viên' };
const statusLabels = { active: 'Đã duyệt', inactive: 'Chờ duyệt', rejected: 'Không duyệt' };

function AccountModal({ account, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName: account?.display_name || account?.full_name || account?.username || '',
    email: account?.email || '',
    phone: account?.phone || '',
    address: account?.address || '',
    password: '',
  });
  const [saving, setSaving] = useState(false);

  if (!account) return null;

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.fullName.trim()) { toast.warning('Vui lòng nhập họ tên.'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.warning('Email không đúng định dạng.'); return; }
    if (form.phone && !/^(0|\+84)[0-9]{9,10}$/.test(form.phone)) { toast.warning('Số điện thoại chưa đúng định dạng.'); return; }
    if (form.password && form.password.length < 6) { toast.warning('Mật khẩu mới tối thiểu 6 ký tự.'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      const res = await axios.patch('/users/users/me/', payload);
      toast.success('Đã cập nhật thông tin tài khoản.');
      onSaved(res.data);
      onClose();
    } catch (error) {
      const message = error.response?.data?.message || error.response?.data?.detail || Object.values(error.response?.data || {})?.[0] || 'Không cập nhật được tài khoản.';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-modal-backdrop" onClick={onClose}>
      <form className="account-modal-card" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <button className="account-modal-close" type="button" onClick={onClose}>×</button>
        <div className="account-modal-head">
          <div className="account-avatar">{(account.display_name || account.username || 'U').slice(0, 1).toUpperCase()}</div>
          <div>
            <h2>Thông tin tài khoản</h2>
            <p>{roleLabels[account.role] || account.role || 'Tài khoản'} · {account.username}</p>
          </div>
        </div>
        <div className="account-info-grid">
          <label>Họ tên<input value={form.fullName} onChange={(e) => update('fullName', e.target.value)} /></label>
          <label>Tên đăng nhập<input value={account.username || 'Chưa cập nhật'} disabled /></label>
          <label>Email<input value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
          <label>Số điện thoại<input value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label>
          <label>Vai trò<input value={roleLabels[account.role] || account.role || 'Chưa cập nhật'} disabled /></label>
          <label>Trạng thái duyệt<input value={statusLabels[account.status] || account.status || 'Chưa cập nhật'} disabled /></label>
          <label>Trạng thái đăng nhập<input value={account.is_active ? 'Được phép đăng nhập' : 'Đã khóa đăng nhập'} disabled /></label>
          <label>Địa chỉ<input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Nhập địa chỉ liên hệ" /></label>
          <label className="account-full-row">Mật khẩu mới<input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Bỏ trống nếu không đổi" /></label>
        </div>
        <div className="account-modal-actions">
          <button className="account-modal-secondary" type="button" onClick={onClose}>Đóng</button>
          <button className="account-modal-ok" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </div>
      </form>
    </div>
  );
}

function Navigation({ onLogout }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const username = typeof window !== 'undefined' ? (localStorage.getItem('username') || 'Tiến') : 'Tiến';
  const role = typeof window !== 'undefined' ? (localStorage.getItem('role') || 'admin') : 'admin';
  const [account, setAccount] = useState(null);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    axios.get('/users/users/me/')
      .then((res) => setAccount(res.data))
      .catch(() => setAccount(null));
  }, [role, username]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    if (onLogout) onLogout();
    router.push('/login');
  };

  const adminLinks = [
    ['▦', '/dashboard', 'Tổng quan'],
    ['♚', '/users', 'Quản lý tài khoản'],
    ['$', '/finance', 'Quản lý tài chính'],
  ];

  const staffLinks = [
    ['▦', '/staff', 'Tổng quan'],
    ['▤', '/staff?tab=requests', 'Yêu cầu tìm gia sư'],
    ['▰', '/staff?tab=createClass', 'Tạo lớp học'],
    ['▰', '/staff?tab=classes', 'Quản lý lớp học'],
    ['$', '/staff?tab=payments', 'Theo dõi thanh toán'],
  ];

  const tutorLinks = [
    ['▦', '/tutor', 'Tổng quan'],
    ['♙', '/tutor?tab=profile', 'Hồ sơ cá nhân'],
    ['▰', '/tutor?tab=proposed', 'Lớp đề xuất'],
    ['▰', '/tutor?tab=classes', 'Lớp đang dạy'],
    ['⌚', '/tutor?tab=timetable', 'Lịch rảnh & dạy'],
    ['☆', '/tutor?tab=reviews', 'Đánh giá'],
  ];
  const customerLinks = [
    ['▦', '/customer', 'Tổng quan'],
    ['⌕', '/customer?tab=request', 'Đăng ký tìm gia sư'],
    ['▰', '/customer?tab=available', 'Lớp có sẵn'],
    ['▰', '/customer?tab=classes', 'Lớp đang học'],
    ['⌚', '/customer?tab=timetable', 'Thời khóa biểu'],
  ];

  const links = role === 'tutor'
    ? tutorLinks
    : role === 'student'
      ? customerLinks
      : role === 'staff'
        ? staffLinks
        : adminLinks;

  const panelTitle = role === 'staff' ? 'Nhân viên Panel' : role === 'tutor' ? 'Gia sư Panel' : role === 'student' ? 'Học viên Panel' : 'Admin Panel';

  return (
    <aside className="navigation admin-sidebar">
      <div className="nav-brand">
        <div className="brand-logo-row">
          <div className="brand-logo-mark"><img src="/tutor-logo.svg" alt="Logo gia sư" /></div>
          <div>
            <span>Phần mềm quản lý cho trung tâm gia sư</span>
            <h1>{panelTitle}</h1>
          </div>
        </div>
        <p>Chào {account?.display_name || username}</p>
        <button className="nav-account-btn" type="button" onClick={() => setShowAccount(true)}>Xem tài khoản</button>
      </div>

      <ul className="nav-links">
        {links.map(([icon, href, label]) => (
          <li key={href}>
            <Link href={href} className={`nav-link ${(() => {
              const [linkPath, query = ''] = href.split('?');
              const linkTab = new URLSearchParams(query).get('tab');
              const currentTab = searchParams.get('tab');
              if (role === 'staff' && linkPath === '/staff') {
                return pathname === '/staff' && (linkTab ? currentTab === linkTab : !currentTab) ? 'active' : '';
              }
              if (role === 'tutor' && linkPath === '/tutor') {
                return pathname === '/tutor' && (linkTab ? currentTab === linkTab : !currentTab) ? 'active' : '';
              }
              if (role === 'student' && linkPath === '/customer') {
                return pathname === '/customer' && (linkTab ? currentTab === linkTab : !currentTab) ? 'active' : '';
              }
              return pathname === href ? 'active' : '';
            })()}`}>
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="nav-footer">
        <button onClick={handleLogout} className="nav-logout">
          <span>↪</span>
          Đăng xuất
        </button>
      </div>
      {showAccount && <AccountModal account={account || { username, role }} onClose={() => setShowAccount(false)} onSaved={setAccount} />}
    </aside>
  );
}

export default Navigation;
