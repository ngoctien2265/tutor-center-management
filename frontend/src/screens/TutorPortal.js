'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import './TutorPortal.css';

const tabKeys = ['dashboard', 'profile', 'classes', 'reviews'];
const money = (value) => Number(value || 0).toLocaleString('vi-VN') + 'đ';
function StatusBadge({ children, tone = 'green' }) { return <span className={`tutor-badge ${tone}`}>{children}</span>; }
function scheduleLabel(slots = []) { return slots.map((s) => `${s.dayLabel || s.dayOfWeek} ${s.startTime || ''}-${s.endTime || ''}`.trim()).join(', ') || '-'; }
function statusVi(status) { return ({ OPEN: 'Đang tìm gia sư', WAITING_PARENT: 'Chờ phụ huynh xác nhận', WAITING_TUTOR: 'Chờ gia sư xác nhận', ASSIGNED: 'Đang học', TEACHING: 'Đang học', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', ABSENCE_ONLY: 'Nghỉ', RESCHEDULE: 'Dạy bù', ABSENCE_WITH_MAKEUP: 'Dạy bù' }[status] || status || 'Đang học'); }
const today = () => new Date().toISOString().slice(0, 10);

function TutorPortal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab') || 'dashboard';
  const tab = tabKeys.includes(urlTab) ? urlTab : 'dashboard';

  const [dashboard, setDashboard] = useState({});
  const [profile, setProfile] = useState({ fullName: '', email: '', phone: '', address: '', university: '', major: '', bio: '', teachableSubjects: '', teachableGrades: '', teachingAreas: '', rating: 0 });
  const [openClasses, setOpenClasses] = useState([]);
  const [activeClasses, setActiveClasses] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [logs, setLogs] = useState([]);
  const [absenceRequests, setAbsenceRequests] = useState([]);
  const [declinedOpen, setDeclinedOpen] = useState([]);
  const [actionForm, setActionForm] = useState(null);

  const setTab = (nextTab) => router.push(nextTab === 'dashboard' ? '/tutor' : `/tutor?tab=${nextTab}`);
  const pageTitle = { dashboard: 'Tổng quan', profile: 'Hồ sơ cá nhân', classes: 'Lớp đang dạy', reviews: 'Đánh giá' }[tab];

  const loadAll = async () => {
    try {
      const [d, p, open, active, r, abs] = await Promise.allSettled([
        axios.get('/v1/tutor/dashboard'),
        axios.get('/v1/tutor/profile'),
        axios.get('/v1/tutor/classes/open', { params: { limit: 20 } }),
        axios.get('/v1/tutor/classes/active', { params: { limit: 50 } }),
        axios.get('/v1/tutor/reviews', { params: { limit: 50 } }),
        axios.get('/v1/tutor/absence-requests', { params: { limit: 50 } }),
      ]);
      if (d.status === 'fulfilled') setDashboard(d.value.data.data || {});
      if (p.status === 'fulfilled') setProfile((prev) => ({ ...prev, ...(p.value.data.data || {}) }));
      if (open.status === 'fulfilled') setOpenClasses(open.value.data.data?.items || []);
      if (active.status === 'fulfilled') setActiveClasses(active.value.data.data?.items || []);
      if (r.status === 'fulfilled') setReviews(r.value.data.data?.items || []);
      if (abs.status === 'fulfilled') setAbsenceRequests(abs.value.data.data?.items || []);
    } catch (error) { toast.error('Không tải được dữ liệu gia sư.'); }
  };
  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    const loadLogs = async () => {
      if (!activeClasses.length) { setLogs([]); return; }
      const results = await Promise.allSettled(activeClasses.map((c) => axios.get(`/v1/tutor/classes/${c.classId}/teaching-logs`, { params: { limit: 30 } })));
      const merged = [];
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          (res.value.data.data?.items || []).forEach((log) => merged.push({ ...log, className: activeClasses[idx]?.subject, studentName: activeClasses[idx]?.studentName }));
        }
      });
      setLogs(merged);
    };
    loadLogs();
  }, [activeClasses]);

  const income = useMemo(() => activeClasses.reduce((sum, cls) => sum + Number(cls.salaryPerSession || 0) * Number(cls.sessionsPerWeek || 2) * 4, 0), [activeClasses]);
  const avgRating = Number(profile.rating || (reviews.reduce((s, r) => s + Number(r.starRating || 0), 0) / Math.max(reviews.length, 1)) || 0).toFixed(1);
  const proposedClasses = openClasses.filter((item) => !declinedOpen.includes(String(item.classId)));
  const weekSchedule = dashboard.upcomingSessions?.length ? dashboard.upcomingSessions : activeClasses.slice(0, 5);

  const saveProfile = async () => {
    try { await axios.patch('/v1/tutor/profile', profile); toast.success('Đã cập nhật hồ sơ.'); loadAll(); }
    catch (error) { toast.error(error.response?.data?.message || 'Không cập nhật được hồ sơ.'); }
  };
  const acceptClass = async (item) => {
    try { await axios.post(`/v1/tutor/classes/${item.classId}/applications`, { coverNote: 'Gia sư đồng ý nhận lớp.', expectedSalary: item.salaryPerSession }); toast.success('Đã gửi yêu cầu nhận lớp cho nhân viên duyệt.'); loadAll(); }
    catch (error) { toast.error(error.response?.data?.message || 'Không thể nhận lớp này.'); }
  };
  const startAction = (cls, type) => setActionForm({ classId: cls.classId, className: cls.subject, type, date: today(), note: '' });
  const submitClassAction = async (event) => {
    event.preventDefault();
    if (!actionForm?.date) { toast.warning('Vui lòng chọn ngày.'); return; }
    try {
      if (actionForm.type === 'TAUGHT') {
        await axios.post(`/v1/tutor/classes/${actionForm.classId}/teaching-logs`, {
          sessionDate: actionForm.date, startTime: '19:00', endTime: '20:30', topic: 'Đã dạy', content: actionForm.note || 'Gia sư đã hoàn thành buổi dạy.', studentUnderstandingLevel: 'GOOD', attendanceStatus: 'PRESENT', homework: actionForm.note || '', note: actionForm.note || '',
        });
        toast.success('Đã gửi trạng thái Đã dạy cho nhân viên duyệt.');
      } else if (actionForm.type === 'ABSENCE') {
        await axios.post(`/v1/tutor/classes/${actionForm.classId}/absence-requests`, { requestType: 'ABSENCE_ONLY', sessionDate: actionForm.date, absentDates: [actionForm.date], reason: actionForm.note || 'Gia sư xin nghỉ buổi học.' });
        toast.success('Đã gửi yêu cầu Nghỉ cho nhân viên duyệt.');
      } else {
        await axios.post(`/v1/tutor/classes/${actionForm.classId}/absence-requests`, { requestType: 'RESCHEDULE', sessionDate: actionForm.date, proposedMakeupDate: actionForm.date, proposedStartTime: '19:00', proposedEndTime: '20:30', reason: actionForm.note || 'Gia sư yêu cầu dạy bù.' });
        toast.success('Đã gửi yêu cầu Dạy bù cho nhân viên duyệt.');
      }
      setActionForm(null); loadAll();
    } catch (error) { toast.error(error.response?.data?.message || 'Không gửi được yêu cầu.'); }
  };

  return <main className="tutor-figma-page"><h1>{pageTitle}</h1>
    {tab === 'dashboard' && <>
      <section className="tutor-stat-row">
        <article className="tutor-stat"><span className="tutor-icon blue">▰</span><p>Lớp đang dạy</p><h3>{dashboard.activeClasses ?? activeClasses.filter((c) => ['TEACHING','ASSIGNED','WAITING_PARENT'].includes(c.status)).length}</h3></article>
        <article className="tutor-stat"><span className="tutor-icon green">▣</span><p>Buổi dạy tháng này</p><h3>{dashboard.totalTeachingLogs ?? logs.length}</h3></article>
        <article className="tutor-stat"><span className="tutor-icon purple">$</span><p>Thu nhập tháng này</p><h3>{money(income)}</h3></article>
        <article className="tutor-stat"><span className="tutor-icon yellow">☆</span><p>Đánh giá</p><h3>{avgRating}</h3></article>
      </section>
      <section className="tutor-dashboard-grid"><div className="tutor-card"><h2>Lịch dạy tuần này</h2><div className="tutor-list">{weekSchedule.length ? weekSchedule.map((item, idx) => <div className="schedule-item" key={idx}><div><strong>{item.subject}</strong><span>{item.studentName || ''}</span><span>Địa chỉ: {item.location || item.address || 'Chưa cập nhật'}</span></div><div className="schedule-time"><b>{item.dayLabel || item.schedule?.[0]?.dayLabel || 'Thứ'}</b><span>{item.startTime || item.schedule?.[0]?.startTime || ''}</span></div></div>) : <p className="muted">Chưa có lịch dạy.</p>}</div></div><div className="tutor-card"><h2>Lớp được đề xuất</h2>{proposedClasses.length ? proposedClasses.slice(0, 4).map((item) => <article className="suggest-card" key={item.classId}><h3>{item.subject} - {item.level}</h3><p>Địa chỉ: {item.location}</p><p>Lịch: {scheduleLabel(item.schedule)}</p><p>Lương dự kiến: {money(item.salaryPerSession * (item.sessionsPerWeek || 2) * 4)}/tháng</p><div className="suggest-actions"><button className="tutor-primary" onClick={() => acceptClass(item)}>Đồng ý nhận lớp</button><button className="tutor-muted-btn" onClick={() => setDeclinedOpen((prev) => [...prev, String(item.classId)])}>Từ chối</button></div></article>) : <p className="muted">Chưa có lớp phù hợp được công khai.</p>}</div></section>
    </>}

    {tab === 'profile' && <form className="profile-stack beautiful-profile" onSubmit={(e) => { e.preventDefault(); saveProfile(); }}><section className="tutor-card profile-hero"><div className="profile-avatar">{(profile.fullName || 'GS').slice(0, 2).toUpperCase()}</div><div><h2>{profile.fullName || 'Gia sư'}</h2><p>{profile.university || 'Cập nhật trường học'} • {profile.major || 'Cập nhật chuyên ngành'}</p><span className="rating">★ {avgRating}</span></div></section><section className="tutor-card profile-card"><h2>Thông tin cá nhân</h2><div className="profile-grid two"><label>Họ và tên<input value={profile.fullName || ''} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></label><label>Email<input value={profile.email || ''} readOnly /></label><label>Số điện thoại<input value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label><label>Địa chỉ<input value={profile.address || ''} onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></label><label>Trường đại học<input value={profile.university || ''} onChange={(e) => setProfile({ ...profile, university: e.target.value })} /></label><label>Chuyên ngành<input value={profile.major || ''} onChange={(e) => setProfile({ ...profile, major: e.target.value })} /></label></div><label>Kinh nghiệm<textarea className="profile-textarea" value={profile.bio || ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></label></section><section className="tutor-card profile-card"><h2>Năng lực giảng dạy</h2><div className="profile-grid two"><label>Môn có thể dạy<input value={profile.teachableSubjects || ''} onChange={(e) => setProfile({ ...profile, teachableSubjects: e.target.value })} /></label><label>Khối lớp<input value={profile.teachableGrades || ''} onChange={(e) => setProfile({ ...profile, teachableGrades: e.target.value })} /></label></div><label>Khu vực dạy<input value={profile.teachingAreas || ''} onChange={(e) => setProfile({ ...profile, teachingAreas: e.target.value })} /></label></section><button className="tutor-submit full-width">Lưu hồ sơ</button></form>}

    {tab === 'classes' && <><section className="tutor-card"><h2>Lớp đang dạy</h2><div className="teaching-grid tutor-class-management">{activeClasses.length ? activeClasses.map((cls) => <article className="teaching-card" key={cls.classId}><div className="class-top"><h3>{cls.subject} - {cls.level}</h3><StatusBadge tone={cls.status === 'WAITING_PARENT' ? 'yellow' : 'green'}>{statusVi(cls.status)}</StatusBadge></div><p><strong>Học viên:</strong> {cls.studentName}</p><p><strong>Phụ huynh:</strong> {cls.parentName} - {cls.parentPhone || 'Chưa cập nhật'}</p><p><strong>Lịch:</strong> {scheduleLabel(cls.schedule)}</p><p><strong>Địa chỉ:</strong> {cls.location}</p><p className="green-text"><b>Lương: {money(Number(cls.salaryPerSession || 0) * Number(cls.sessionsPerWeek || 2) * 4)}/tháng</b></p><div className="suggest-actions wrap"><button className="outline-btn compact" onClick={() => startAction(cls, 'TAUGHT')}>Đã dạy</button><button className="outline-btn compact" onClick={() => startAction(cls, 'ABSENCE')}>Xin nghỉ</button><button className="outline-btn compact" onClick={() => startAction(cls, 'MAKEUP')}>Dạy bù</button></div></article>) : <p className="muted">Chưa có lớp đang dạy.</p>}</div></section>{actionForm && <form className="tutor-card action-panel" onSubmit={submitClassAction}><h2>{actionForm.type === 'TAUGHT' ? 'Ghi nhận đã dạy' : actionForm.type === 'ABSENCE' ? 'Xin nghỉ buổi học' : 'Yêu cầu dạy bù'} - {actionForm.className}</h2><div className="profile-grid two"><label>Ngày<input type="date" value={actionForm.date} onChange={(e) => setActionForm({ ...actionForm, date: e.target.value })} /></label><label>Ghi chú<input value={actionForm.note} onChange={(e) => setActionForm({ ...actionForm, note: e.target.value })} placeholder="Nhập nội dung/ lý do..." /></label></div><div className="suggest-actions"><button className="tutor-primary">Gửi cho nhân viên duyệt</button><button type="button" className="tutor-muted-btn" onClick={() => setActionForm(null)}>Đóng</button></div></form>}<section className="tutor-card"><h2>Nhật ký và yêu cầu đã gửi</h2><div className="table-shell"><table className="tutor-table-new"><thead><tr><th>Lớp</th><th>Ngày</th><th>Loại</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>{[...absenceRequests.map((a) => ({ id: `a-${a.requestId}`, className: a.subject, date: a.sessionDate, type: statusVi(a.requestType), status: statusVi(a.status), note: a.reason })), ...logs.map((l) => ({ id: `l-${l.logId}`, className: l.className, date: l.sessionDate, type: 'Đã dạy', status: (l.note || '').includes('Staff xác nhận') ? 'Đã duyệt' : 'Chờ duyệt', note: l.content || l.note }))].map((row) => <tr key={row.id}><td>{row.className}</td><td>{row.date}</td><td>{row.type}</td><td>{row.status}</td><td>{row.note || '-'}</td></tr>)}</tbody></table></div></section></>}

    {tab === 'reviews' && <><section className="tutor-card review-summary"><h2>Tổng quan đánh giá</h2><div className="review-big"><strong>{avgRating}</strong><span>{'★'.repeat(Math.round(Number(avgRating)))}</span><p>{reviews.length} đánh giá từ phụ huynh</p></div></section><section className="review-list-new">{reviews.length ? reviews.map((review) => <article className="review-item-new" key={review.reviewId}><div><h3>{review.reviewer || 'Phụ huynh'}</h3><p>{review.comment || 'Không có nhận xét.'}</p><small>{review.subject}</small></div><span>{'★'.repeat(review.starRating || 5)}</span></article>) : <p className="muted">Chưa có đánh giá.</p>}</section></>}
  </main>;
}
export default TutorPortal;
