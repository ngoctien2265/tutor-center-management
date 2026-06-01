'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import './Navigation.css';

const roleLabels = { admin: 'Admin', staff: 'Nhân viên', tutor: 'Gia sư', parent: 'Phụ huynh', student: 'Học viên' };
const statusLabels = { active: 'Đã duyệt', inactive: 'Chờ duyệt', rejected: 'Không duyệt' };

function AccountModal({ account, onClose }) {
  if (!account) return null;
  return (
    <div className="account-modal-backdrop" onClick={onClose}>
      <section className="account-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="account-modal-close" type="button" onClick={onClose}>×</button>
        <div className="account-modal-head">
          <div className="account-avatar">{(account.display_name || account.username || 'U').slice(0, 1).toUpperCase()}</div>
          <div>
            <h2>Thông tin tài khoản</h2>
            <p>{account.display_name || account.full_name || account.username}</p>
          </div>
        </div>
        <div className="account-info-grid">
          <label>Họ tên<input value={account.display_name || account.full_name || account.username || 'Chưa cập nhật'} disabled /></label>
          <label>Tên đăng nhập<input value={account.username || 'Chưa cập nhật'} disabled /></label>
          <label>Email<input value={account.email || 'Chưa cập nhật'} disabled /></label>
          <label>Số điện thoại<input value={account.phone || 'Chưa cập nhật'} disabled /></label>
          <label>Vai trò<input value={roleLabels[account.role] || account.role || 'Chưa cập nhật'} disabled /></label>
          <label>Trạng thái duyệt<input value={statusLabels[account.status] || account.status || 'Chưa cập nhật'} disabled /></label>
          <label>Trạng thái đăng nhập<input value={account.is_active ? 'Được phép đăng nhập' : 'Đã khóa đăng nhập'} disabled /></label>
          <label>Địa chỉ<input value={account.address || 'Chưa cập nhật'} disabled /></label>
        </div>
        <button className="account-modal-ok" type="button" onClick={onClose}>Đóng</button>
      </section>
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
    axios.get('/users/me/')
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
    ['▥', '/reports', 'Báo cáo thống kê'],
    ['$', '/finance', 'Quản lý tài chính'],
  ];

  const staffLinks = [
    ['▦', '/staff', 'Tổng quan'],
    ['▤', '/staff?tab=requests', 'Yêu cầu tìm gia sư'],
    ['▰', '/staff?tab=createClass', 'Tạo lớp học'],
    ['▱', '/staff?tab=findTutors', 'Tìm gia sư'],
    ['▰', '/staff?tab=classes', 'Quản lý lớp học'],
    ['▣', '/staff?tab=sessions', 'Quản lý buổi học'],
    ['$', '/staff?tab=payments', 'Theo dõi thanh toán'],
  ];

  const tutorLinks = [
    ['▦', '/tutor', 'Tổng quan'],
    ['♙', '/tutor?tab=profile', 'Hồ sơ cá nhân'],
    ['▰', '/tutor?tab=classes', 'Lớp đang dạy'],
    ['☆', '/tutor?tab=reviews', 'Đánh giá'],
  ];
  const customerLinks = [
    ['▦', '/customer', 'Tổng quan'],
    ['⌕', '/customer?tab=request', 'Đăng ký tìm gia sư'],
    ['♙', '/customer?tab=students', 'Quản lý học viên'],
    ['✓', '/customer?tab=confirmations', 'Xác nhận gia sư'],
    ['▰', '/customer?tab=classes', 'Lớp đang học'],
    ['▱', '/customer?tab=tutors', 'Thông tin gia sư'],
    ['$', '/customer?tab=payments', 'Học phí'],
    ['☆', '/customer?tab=reviews', 'Đánh giá gia sư'],
  ];

  const links = role === 'tutor'
    ? tutorLinks
    : role === 'student' || role === 'parent'
      ? customerLinks
      : role === 'staff'
        ? staffLinks
        : adminLinks;

  return (
    <aside className="navigation admin-sidebar">
      <div className="nav-brand">
        <h1>{role === 'staff' ? 'Nhân viên Panel' : role === 'tutor' ? 'Gia sư Panel' : role === 'student' || role === 'parent' ? 'Phụ huynh Panel' : 'Admin Panel'}</h1>
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
              if ((role === 'student' || role === 'parent') && linkPath === '/customer') {
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
      {showAccount && <AccountModal account={account || { username, role }} onClose={() => setShowAccount(false)} />}
    </aside>
  );
}

export default Navigation;
