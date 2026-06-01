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
  parentFullName: '',
  parentPhone: '',
  address: '',
  fullName: '',
  gender: '',
  birthday: '',
  gradeLevel: '',
  schoolName: '',
  note: '',
};

function Field({ label, name, value, onChange, type = 'text', textarea = false, options }) {
  return (
    <div className={`register-field ${textarea ? 'full' : ''}`}>
      <label htmlFor={name}>{label}</label>
      {textarea ? (
        <textarea id={name} value={value} onChange={(e) => onChange(name, e.target.value)} />
      ) : options ? (
        <select id={name} value={value} onChange={(e) => onChange(name, e.target.value)}>
          <option value="">-- Chọn --</option>
          {options.map(([v, l]) => <option value={v} key={v}>{l}</option>)}
        </select>
      ) : (
        <input id={name} type={type} value={value} onChange={(e) => onChange(name, e.target.value)} />
      )}
    </div>
  );
}

export default function StudentRegister() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);

  const update = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password || !form.fullName) {
      toast.error('Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }
    if (form.password !== form.password_confirm) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/users/register/student/', form);
      toast.success('Đăng ký học viên thành công. Vui lòng đăng nhập.');
      router.push('/login');
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Đăng ký học viên thất bại.');
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
            <span>Đăng ký học viên</span>
            <h1>Đăng ký học viên</h1>
            <p>Tạo tài khoản học viên và thông tin phụ huynh để trung tâm tiếp nhận tư vấn lớp phù hợp.</p>
          </div>

          <section className="register-section">
            <h2>Thông tin tài khoản</h2>
            <div className="register-grid">
              <Field label="Tên đăng nhập *" name="username" value={form.username} onChange={update} />
              <Field label="Email *" name="email" type="email" value={form.email} onChange={update} />
              <Field label="Số điện thoại" name="phone" value={form.phone} onChange={update} />
              <Field label="Mật khẩu *" name="password" type="password" value={form.password} onChange={update} />
              <Field label="Xác nhận mật khẩu *" name="password_confirm" type="password" value={form.password_confirm} onChange={update} />
            </div>
          </section>

          <section className="register-section">
            <h2>Thông tin phụ huynh/liên hệ</h2>
            <div className="register-grid">
              <Field label="Họ tên phụ huynh" name="parentFullName" value={form.parentFullName} onChange={update} />
              <Field label="SĐT phụ huynh" name="parentPhone" value={form.parentPhone} onChange={update} />
              <Field label="Địa chỉ" name="address" value={form.address} onChange={update} textarea />
            </div>
          </section>

          <section className="register-section">
            <h2>Thông tin học viên</h2>
            <div className="register-grid">
              <Field label="Họ tên học viên *" name="fullName" value={form.fullName} onChange={update} />
              <Field label="Giới tính" name="gender" value={form.gender} onChange={update} options={[["M", "Nam"], ["F", "Nữ"], ["O", "Khác"]]} />
              <Field label="Ngày sinh" name="birthday" type="date" value={form.birthday} onChange={update} />
              <Field label="Khối lớp" name="gradeLevel" value={form.gradeLevel} onChange={update} />
              <Field label="Trường học" name="schoolName" value={form.schoolName} onChange={update} />
              <Field label="Ghi chú" name="note" value={form.note} onChange={update} textarea />
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
