'use client';

import Link from 'next/link';
import './Landing.css';

function Landing() {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <div className="landing-brand">Phần mềm quản lý cho trung tâm gia sư</div>
        <div className="landing-links">
          <Link href="/login">Đăng nhập</Link>
          <Link href="/register/student" className="landing-nav-cta">Đăng ký học</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <span className="eyebrow">Phần mềm quản lý cho trung tâm gia sư</span>
          <h1>Quản lý lớp học, gia sư và học viên trong một hệ thống rõ ràng.</h1>
          <p>
            Nền tảng hỗ trợ trung tâm quản lý lớp học, gia sư, học viên, lịch dạy,
            hồ sơ năng lực và các yêu cầu vận hành hằng ngày.
          </p>
          <div className="landing-actions">
            <Link href="/register/student" className="landing-btn landing-btn-primary">Đăng ký cho học viên</Link>
            <Link href="/register/tutor" className="landing-btn landing-btn-secondary">Đăng ký làm gia sư</Link>
            <Link href="/register/staff" className="landing-btn landing-btn-secondary">Đăng ký nhân viên</Link>
          </div>
        </div>
        <div className="landing-card-preview">
          <div className="preview-header">
            <span></span>
            <b>Bảng điều khiển</b>
          </div>
          <div className="preview-stats">
            <div><strong>20</strong><span>Lớp học</span></div>
            <div><strong>10</strong><span>Gia sư</span></div>
            <div><strong>30</strong><span>Học viên</span></div>
          </div>
          <div className="preview-list">
            <p><b>Toán lớp 9</b><span>Đang tìm gia sư</span></p>
            <p><b>Tiếng Anh giao tiếp</b><span>Đang học</span></p>
            <p><b>Vật lý 10</b><span>Chờ duyệt</span></p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-title">
          <span>Vai trò sử dụng</span>
          <h2>Chọn đúng luồng đăng ký của bạn</h2>
        </div>
        <div className="landing-grid">
          <article className="landing-info-card">
            <h3>Học viên / Phụ huynh</h3>
            <p>Đăng ký tài khoản học viên để trung tâm tiếp nhận thông tin và tư vấn lớp phù hợp.</p>
            <Link href="/register/student">Đăng ký học viên</Link>
          </article>
          <article className="landing-info-card">
            <h3>Gia sư</h3>
            <p>Tạo hồ sơ gia sư để cập nhật thông tin cá nhân, năng lực và tham gia nhận lớp.</p>
            <Link href="/register/tutor">Đăng ký gia sư</Link>
          </article>
          <article className="landing-info-card muted-card">
            <h3>Nhân viên trung tâm</h3>
            <p>Đăng ký tài khoản nhân viên để hỗ trợ quản lý users, tutors, classes, enrollments và vận hành hệ thống.</p>
            <Link href="/register/staff">Đăng ký nhân viên</Link>
          </article>
        </div>
      </section>
    </main>
  );
}

export default Landing;
