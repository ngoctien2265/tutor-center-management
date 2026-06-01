'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './Register.css';

const initialForm = {
  username: '',
  email: '',
  phone: '',
  password: '',
  password_confirm: '',
  fullName: '',
};

function Field({ label, name, value, onChange, type = 'text' }) {
  return (
    <div className="register-field">
      <label htmlFor={name}>{label}</label>
      <input id={name} type={type} value={value} onChange={(e) => onChange(name, e.target.value)} />
    </div>
  );
}

export default function StaffRegister() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);

  const update = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password) {
      toast.error('Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }
    if (form.password !== form.password_confirm) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/users/register/staff/', form);
      toast.success('Đăng ký nhân viên thành công. Vui lòng đăng nhập.');
      router.push('/login');
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Đăng ký nhân viên thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">
      <div className="register-shell">
        <div className="register-topbar">
          <Link href="/">← Trang chủ</Link>
          <Link href="/login">Đã có tài khoản?</Link>
        </div>
        <form className="register-card" onSubmit={handleSubmit}>
          <div className="register-heading">
            <span>Đăng ký nhân viên</span>
            <h1>Đăng ký nhân viên</h1>
            <p>Tạo tài khoản nhân viên để quản lý yêu cầu, lớp học, học viên và gia sư.</p>
          </div>

          <section className="register-section">
            <h2>Thông tin tài khoản</h2>
            <div className="register-grid">
              <Field label="Tên đăng nhập *" name="username" value={form.username} onChange={update} />
              <Field label="Email *" name="email" type="email" value={form.email} onChange={update} />
              <Field label="Số điện thoại" name="phone" value={form.phone} onChange={update} />
              <Field label="Họ tên" name="fullName" value={form.fullName} onChange={update} />
              <Field label="Mật khẩu *" name="password" type="password" value={form.password} onChange={update} />
              <Field label="Xác nhận mật khẩu *" name="password_confirm" type="password" value={form.password_confirm} onChange={update} />
            </div>
          </section>

          <div className="register-actions">
            <Link href="/register/tutor">Tôi là gia sư</Link>
            <button className="register-submit" disabled={loading}>{loading ? 'Đang đăng ký...' : 'Hoàn tất đăng ký'}</button>
          </div>
        </form>
      </div>
    </main>
  );
}
