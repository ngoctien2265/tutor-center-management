'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import './Login.css';

function homeRouteForRole(role) {
  if (role === 'tutor') return '/tutor';
  if (role === 'staff') return '/staff';
  if (role === 'student') return '/customer';
  return '/dashboard';
}

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        '/token/',
        {
          username: username,
          password: password,
        }
      );

      const { access, refresh } = response.data;

      // Store tokens and username
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('username', username);

      try {
        const me = await axios.get('/users/users/me/');
        localStorage.setItem('role', me.data.role || '');
        toast.success('Đăng nhập thành công!');
        onLoginSuccess();
        router.push(homeRouteForRole(me.data.role));
      } catch (profileError) {
        const fallbackRole = username.startsWith('tutor') ? 'tutor' : username.startsWith('staff') ? 'staff' : username.startsWith('student') ? 'student' : 'admin';
        localStorage.setItem('role', fallbackRole);
        toast.success('Đăng nhập thành công!');
        onLoginSuccess();
        router.push(homeRouteForRole(fallbackRole));
      }
    } catch (error) {
      console.error('Login failed:', error);
      const message = error.response?.data?.detail;
      if (message?.includes('chờ admin duyệt')) {
        toast.error(message);
      } else if (error.response?.status === 401) {
        toast.error('Sai tên đăng nhập hoặc mật khẩu');
      } else {
        toast.error('Đăng nhập thất bại. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Hệ thống quản lý gia sư</h1>
        <p className="login-subtitle">Đăng nhập tài khoản</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Tên đăng nhập</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="button button-primary login-button"
            disabled={loading}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="login-register-links">
          <Link href="/">Trang chủ</Link>
          <Link href="/register/student">Đăng ký học viên</Link>
          <Link href="/register/tutor">Đăng ký gia sư</Link>
          <Link href="/register/staff">Đăng ký nhân viên</Link>
        </div>

        <p className="login-info">
          Tài khoản demo:
          <br />
          <strong>Quản trị viên:</strong> admin / admin123
          <br />
          <strong>Gia sư:</strong> tutor_1 / tutor123
          <br />
          <strong>Học viên:</strong> student1 / student123
        </p>
      </div>
    </div>
  );
}

export default Login;
