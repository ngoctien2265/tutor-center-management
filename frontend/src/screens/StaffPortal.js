'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import './Dashboard.css';

const tabKeys = ['dashboard', 'requests', 'createClass', 'findTutors', 'classes', 'sessions', 'payments'];
const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const grades = Array.from({ length: 12 }, (_, i) => `Lớp ${i + 1}`);
const subjects = ['Toán', 'Vật lý', 'Hóa học', 'Tiếng Anh', 'Sinh học', 'Ngữ văn'];

const initialClassForm = {
  subject_name: '', grade_level: '', schedule_detail: '', sessions_per_week: 2,
  salary_per_month: '', tuition_fee: '', address_teaching: '', requirements: '',
};

const statusVi = {
  PENDING: 'Chờ duyệt', PENDING_REVIEW: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối',
  staff_pending: 'Chờ nhân viên xử lý', pending_admin: 'Chờ admin duyệt', open: 'Đang tìm gia sư',
  waiting_parent: 'Chờ phụ huynh xác nhận', waiting_tutor: 'Chờ gia sư xác nhận', assigned: 'Đang học', teaching: 'Đang học',
  paused: 'Tạm dừng', completed: 'Hoàn thành', cancelled: 'Đã hủy', unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán',
  TAUGHT: 'Đã dạy', ABSENCE: 'Nghỉ', MAKEUP: 'Dạy bù', CONFIRMED: 'Đã duyệt',
  PRESENT: 'Đã dạy', ABSENT: 'Nghỉ', LATE: 'Đi trễ', ABSENCE_ONLY: 'Nghỉ', RESCHEDULE: 'Dạy bù', ABSENCE_WITH_MAKEUP: 'Dạy bù',
  'Đã dạy': 'Đã dạy', 'Nghỉ': 'Nghỉ', 'Dạy bù': 'Dạy bù', 'Đã duyệt': 'Đã duyệt',
};

const money = (value) => Number(value || 0).toLocaleString('vi-VN') + 'đ';
const itemsOf = (response) => response?.data?.data?.items || [];
const dataOf = (response) => response?.data?.data || {};
const lowerText = (v) => String(v || '').toLowerCase();
const scheduleToText = (items = []) => items.map((x) => `${x.dayLabel || x.dayOfWeek || ''} ${x.startTime || ''}-${x.endTime || ''}`.trim()).filter(Boolean).join(', ');

function StatusBadge({ status }) {
  const label = statusVi[status] || status || 'Chưa rõ';
  const lower = String(label || status || '').toLowerCase();
  let tone = 'yellow';
  if (['đã thanh toán', 'đã duyệt', 'đã dạy', 'đang học', 'hoàn thành'].some((x) => lower.includes(x))) tone = 'green';
  if (['dạy bù', 'chờ phụ huynh', 'đang tìm'].some((x) => lower.includes(x))) tone = 'blue';
  if (['chưa thanh toán', 'nghỉ', 'từ chối', 'hủy'].some((x) => lower.includes(x))) tone = 'red';
  return <span className={`staff-badge ${tone}`}>{label}</span>;
}
function IconButton({ children, tone = 'dark', onClick, title }) {
  return <button type="button" title={title} className={`staff-icon-btn ${tone}`} onClick={onClick}>{children}</button>;
}

function StaffPortal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab') || 'dashboard';
  const tab = tabKeys.includes(urlTab) ? urlTab : 'dashboard';
  const [dashboard, setDashboard] = useState({});
  const [classes, setClasses] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [finance, setFinance] = useState({});
  const [sessions, setSessions] = useState([]);
  const [absenceRequests, setAbsenceRequests] = useState([]);
  const [applications, setApplications] = useState([]);
  const [classForm, setClassForm] = useState(initialClassForm);
  const [filter, setFilter] = useState({ subject: '', grade: '', schedule: '', area: '' });
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);

  const setTab = (nextTab) => router.push(nextTab === 'dashboard' ? '/staff' : `/staff?tab=${nextTab}`);

  const load = async () => {
    try {
      const [d, classRes, tutorRes, financeRes, sessionRes, absenceRes, applicationRes] = await Promise.allSettled([
        axios.get('/v1/staff/dashboard'),
        axios.get('/v1/staff/classes', { params: { limit: 200 } }),
        axios.get('/v1/staff/tutors', { params: { limit: 200, verified: 'true' } }),
        axios.get('/v1/staff/finance'),
        axios.get('/v1/staff/teaching-logs'),
        axios.get('/v1/staff/absence-requests', { params: { limit: 100 } }),
        axios.get('/v1/staff/applications', { params: { limit: 100, status: 'PENDING' } }),
      ]);
      if (d.status === 'fulfilled') setDashboard(dataOf(d.value));
      if (classRes.status === 'fulfilled') setClasses(itemsOf(classRes.value));
      if (tutorRes.status === 'fulfilled') setTutors(itemsOf(tutorRes.value));
      if (financeRes.status === 'fulfilled') setFinance(dataOf(financeRes.value));
      if (sessionRes.status === 'fulfilled') setSessions(itemsOf(sessionRes.value));
      if (absenceRes.status === 'fulfilled') setAbsenceRequests(itemsOf(absenceRes.value));
      if (applicationRes.status === 'fulfilled') setApplications(itemsOf(applicationRes.value));
    } catch (_) { toast.error('Không tải được dữ liệu nhân viên.'); }
  };
  useEffect(() => { load(); }, []);

  const requestRows = useMemo(() => classes
    .filter((cls) => cls.status === 'staff_pending')
    .map((cls) => ({
      id: cls.id,
      parent: cls.student?.parentName || cls.student?.parent_name || cls.student?.fullName || cls.student?.full_name || 'Phụ huynh',
      student: cls.student?.fullName || cls.student?.full_name || '-',
      subject: (cls.subject_name || 'Môn học').replace(/\s+lớp\s+\d+/i, ''),
      grade: cls.grade_level || 'Chưa rõ',
      area: cls.address_teaching || 'Chưa cập nhật',
      schedule: cls.schedule_detail || '-',
      salary: cls.salary_per_month || 0,
      status: cls.status || 'staff_pending',
    })), [classes]);

  const tutorRows = useMemo(() => tutors.map((t) => {
    const subject = (t.teachable_subjects || t.subjects?.[0]?.name || t.major || '').split(',')[0].trim();
    const grade = (t.teachable_grades || '').split(',')[0].trim();
    const schedule = scheduleToText(t.availability) || 'Chưa cập nhật';
    return {
      id: t.id, full_name: t.full_name, subject, grade,
      area: t.teaching_areas || t.address || 'Chưa cập nhật', schedule,
      experience: t.experience_years ? `${t.experience_years} năm` : (t.experience_summary || 'Chưa cập nhật'),
      rating: Number(t.rating || 0),
    };
  }), [tutors]);

  const filteredTutors = useMemo(() => {
    if (!hasSearched) return tutorRows.slice(0, 6);
    return tutorRows.filter((t) => {
      const okSubject = !filter.subject || lowerText(t.subject).includes(lowerText(filter.subject));
      const okGrade = !filter.grade || lowerText(t.grade).includes(lowerText(filter.grade));
      const okArea = !filter.area || lowerText(t.area).includes(lowerText(filter.area));
      const okSchedule = !filter.schedule || lowerText(t.schedule).includes(lowerText(filter.schedule));
      return okSubject && okGrade && okArea && okSchedule;
    });
  }, [hasSearched, tutorRows, filter]);

  const applicationRows = useMemo(() => applications.map((app) => ({
    id: app.applicationId || app.id,
    tutor: app.tutorName || app.tutor?.fullName || app.tutor?.full_name || 'Gia sư',
    className: app.subject || app.class_info?.subject || 'Lớp học',
    grade: app.level || app.class_info?.level || '-',
    area: app.location || app.class_info?.location || '-',
    status: app.status || 'PENDING',
  })), [applications]);

  const sessionRows = useMemo(() => {
    const logRows = sessions.map((row) => ({
      id: row.id || row.logId,
      type: 'log',
      className: row.className || row.class_name || row.subject || 'Lớp học',
      tutor: row.tutor || row.tutorName || 'Gia sư',
      date: row.date || row.sessionDate,
      status: String(row.status || '').includes('Đã duyệt') ? 'CONFIRMED' : 'TAUGHT',
      note: row.topic || row.note || '',
    }));
    const absenceRows = absenceRequests.map((row) => ({
      id: row.requestId || row.id,
      type: 'absence',
      className: row.subject || row.className || 'Lớp học',
      tutor: row.tutorName || row.tutor?.full_name || row.tutor?.fullName || 'Gia sư',
      date: row.sessionDate || row.session_date,
      status: row.status === 'APPROVED' ? 'CONFIRMED' : (row.requestType === 'RESCHEDULE' || row.requestType === 'ABSENCE_WITH_MAKEUP' ? 'MAKEUP' : 'ABSENCE'),
      note: row.reason || row.note || '',
    }));
    return [...absenceRows, ...logRows].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 100);
  }, [sessions, absenceRequests]);

  const paymentRows = useMemo(() => (finance.paymentRows || []).map((row) => ({
    id: row.transactionId || row.id,
    enrollmentId: row.enrollmentId,
    parent: row.parent,
    className: row.className,
    amount: row.amount,
    date: row.date,
    status: row.status === 'paid' ? 'paid' : 'unpaid',
  })), [finance]);
  const salaryRows = useMemo(() => (finance.salaryByTutor || []).map((row) => ({ id: row.tutorId, tutor: row.tutorName, sessions: row.sessions || 0, salary: row.totalSalary || row.salary || 0, status: row.status || 'Đã tính' })), [finance]);

  const submitClass = async (e) => {
    e.preventDefault();
    if (!classForm.subject_name || !classForm.grade_level || !classForm.address_teaching || !classForm.schedule_detail || !classForm.salary_per_month) {
      toast.error('Vui lòng nhập đầy đủ môn học, lớp, địa điểm, lịch học và tiền lương gia sư.'); return;
    }
    try {
      const salary = Number(classForm.salary_per_month || 0);
      await axios.post('/v1/staff/classes', { ...classForm, salary_per_month: salary, tuition_fee: Math.round(salary * 1.25) });
      toast.success('Đã công khai lớp cho gia sư.');
      setClassForm(initialClassForm); load(); setTab('classes');
    } catch (error) { toast.error(error.response?.data?.message || 'Không tạo được lớp.'); }
  };

  const reviewApplication = async (classId, decision) => {
    try { await axios.post(`/v1/staff/classes/${classId}/review-request`, { status: decision }); toast.success(decision === 'APPROVED' ? 'Đã công khai lớp.' : 'Đã từ chối yêu cầu.'); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Không xử lý được yêu cầu.'); }
  };
  const inviteTutor = async (tutor) => {
    if (!selectedRequest) { toast.warning('Vui lòng chọn yêu cầu phụ huynh trước.'); return; }
    try { await axios.post(`/v1/staff/tutors/${tutor.id}/invite`, { classId: selectedRequest.id }); toast.success('Đã gửi gia sư cho phụ huynh xác nhận.'); setSelectedRequest(null); load(); setTab('requests'); }
    catch (error) { toast.error(error.response?.data?.message || 'Không gửi được lời mời.'); }
  };
  const reviewTutorApplication = async (applicationId, decision) => {
    try { await axios.post(`/v1/staff/applications/${applicationId}/review`, { status: decision }); toast.success(decision === 'APPROVED' ? 'Đã duyệt gia sư, chờ phụ huynh xác nhận.' : 'Đã từ chối gia sư.'); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Không xử lý được đơn nhận lớp.'); }
  };
  const changeClassStatus = async (classId, nextStatus) => {
    try { await axios.post(`/v1/staff/classes/${classId}/change-status`, { status: nextStatus }); toast.success('Đã cập nhật trạng thái lớp.'); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Không cập nhật được lớp.'); }
  };
  const confirmSession = async (row, decision = 'APPROVED') => {
    try {
      if (row.type === 'absence') await axios.post(`/v1/staff/absence-requests/${row.id}/review`, { status: decision });
      else if (decision === 'APPROVED') await axios.post(`/v1/staff/teaching-logs/${row.id}/confirm`);
      toast.success(decision === 'APPROVED' ? 'Đã duyệt yêu cầu/buổi học.' : 'Đã từ chối yêu cầu.'); load();
    } catch (error) { toast.error(error.response?.data?.message || 'Không xử lý được trạng thái.'); }
  };
  const changeEnrollmentStatus = async (enrollmentId) => {
    try { await axios.post(`/v1/staff/enrollments/${enrollmentId}/status`, { status: 'paid' }); toast.success('Đã xác nhận thanh toán.'); load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Không xác nhận được thanh toán.'); }
  };
  const resetFilter = () => { setFilter({ subject: '', grade: '', schedule: '', area: '' }); setHasSearched(false); setSelectedRequest(null); };

  const recentRequests = requestRows.slice(0, 4);
  const activeClasses = dashboard.activeClasses || classes.filter((cls) => ['assigned', 'teaching', 'waiting_parent', 'waiting_tutor'].includes(cls.status)).length || 0;
  const completedClasses = dashboard.completedClasses || classes.filter((cls) => cls.status === 'completed').length || 0;
  const readyTutors = tutors.length || 0;
  const totalCollected = paymentRows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalSalary = salaryRows.reduce((sum, row) => sum + Number(row.salary || 0), 0);
  const title = { dashboard: 'Tổng quan', requests: 'Yêu cầu tìm gia sư', createClass: 'Tạo lớp học', findTutors: 'Tìm gia sư', classes: 'Quản lý lớp học', sessions: 'Quản lý buổi học', payments: 'Theo dõi thanh toán' }[tab];

  return <main className="staff-page">
    <h1>{title}</h1>
    {tab === 'dashboard' && <>
      <section className="stat-row">
        <article className="admin-stat"><span className="icon yellow">▤</span><p>Yêu cầu mới</p><h3>{requestRows.length}</h3></article>
        <article className="admin-stat"><span className="icon blue">▰</span><p>Lớp đang quản lý</p><h3>{activeClasses}</h3></article>
        <article className="admin-stat"><span className="icon green">♁</span><p>Gia sư sẵn sàng</p><h3>{readyTutors}</h3></article>
        <article className="admin-stat"><span className="icon purple">✓</span><p>Lớp hoàn thành</p><h3>{completedClasses}</h3></article>
      </section>
      <section className="staff-card wide"><h2>Yêu cầu tìm gia sư mới nhất</h2><div className="staff-request-list">{recentRequests.length ? recentRequests.map((item) => <div className="staff-request-item" key={item.id}><div><strong>{item.parent} - {item.subject} {item.grade}</strong><span>{item.student} • {item.area} • {item.schedule}</span></div><button className="staff-primary-btn" onClick={() => setTab('requests')}>Xử lý yêu cầu</button></div>) : <p className="muted">Chưa có yêu cầu mới.</p>}</div></section>
    </>}

    {tab === 'requests' && <><section className="staff-card wide"><h2>Danh sách yêu cầu tìm gia sư</h2><div className="table-shell"><table className="staff-table"><thead><tr><th>Phụ huynh</th><th>Học viên</th><th>Môn</th><th>Lớp</th><th>Khu vực</th><th>Lịch học</th><th>Lương gia sư</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{requestRows.length ? requestRows.map((row) => <tr key={row.id}><td><strong>{row.parent}</strong></td><td>{row.student}</td><td>{row.subject}</td><td>{row.grade}</td><td>{row.area}</td><td>{row.schedule}</td><td>{money(row.salary)}</td><td><StatusBadge status={row.status} /></td><td className="staff-actions"><IconButton title="Tìm gia sư phù hợp" onClick={() => { setSelectedRequest(row); setFilter({ subject: row.subject, grade: row.grade, schedule: row.schedule, area: row.area }); setHasSearched(true); setTab('findTutors'); }}>⌕</IconButton><IconButton tone="green" title="Không có gia sư phù hợp - công khai lớp" onClick={() => reviewApplication(row.id, 'APPROVED')}>✓</IconButton><IconButton tone="red" title="Từ chối yêu cầu" onClick={() => reviewApplication(row.id, 'REJECTED')}>×</IconButton></td></tr>) : <tr><td colSpan="9" className="muted">Không có yêu cầu chờ xử lý.</td></tr>}</tbody></table></div></section>
      <section className="staff-card wide"><h2>Gia sư đăng ký nhận lớp chờ duyệt</h2><div className="table-shell"><table className="staff-table"><thead><tr><th>Gia sư</th><th>Lớp học</th><th>Khối lớp</th><th>Khu vực</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{applicationRows.length ? applicationRows.map((row) => <tr key={row.id}><td><strong>{row.tutor}</strong></td><td>{row.className}</td><td>{row.grade}</td><td>{row.area}</td><td><StatusBadge status={row.status} /></td><td className="staff-actions"><IconButton tone="green" title="Duyệt gia sư vào lớp" onClick={() => reviewTutorApplication(row.id, 'APPROVED')}>✓</IconButton><IconButton tone="red" title="Không duyệt" onClick={() => reviewTutorApplication(row.id, 'REJECTED')}>×</IconButton></td></tr>) : <tr><td colSpan="6" className="muted">Chưa có gia sư đăng ký nhận lớp.</td></tr>}</tbody></table></div></section></>}

    {tab === 'createClass' && <form className="staff-form-card create-class-card" onSubmit={submitClass}><h2>Tạo lớp học mới</h2><p className="form-subtitle">Nhân viên tạo lớp và công khai cho gia sư đăng ký nhận lớp. Tiền lương bên dưới là lương 1 tháng của gia sư và được đồng bộ sang Admin.</p>
      <div className="staff-form-grid two"><label>Môn học<select value={classForm.subject_name} onChange={(e) => setClassForm({ ...classForm, subject_name: e.target.value })}><option value="">Chọn môn học</option>{subjects.map(x=><option key={x}>{x}</option>)}</select></label><label>Lớp<select value={classForm.grade_level} onChange={(e) => setClassForm({ ...classForm, grade_level: e.target.value })}><option value="">Chọn lớp</option>{grades.map(g=><option key={g}>{g}</option>)}</select></label></div>
      <div className="staff-form-grid two"><label>Số buổi/tuần<input type="number" min="1" max="7" value={classForm.sessions_per_week} onChange={(e) => setClassForm({ ...classForm, sessions_per_week: e.target.value })} /></label><label>Tiền lương 1 tháng của gia sư<input type="number" placeholder="VD: 2500000" value={classForm.salary_per_month} onChange={(e) => setClassForm({ ...classForm, salary_per_month: e.target.value, tuition_fee: Math.round(Number(e.target.value || 0) * 1.25) })} /></label></div>
      <label>Địa điểm học<input placeholder="VD: 25 Nguyễn Văn Cừ, Quận 5, TP.HCM" value={classForm.address_teaching} onChange={(e) => setClassForm({ ...classForm, address_teaching: e.target.value })} /></label>
      <div className="staff-day-grid"><span>Lịch học</span>{days.map((day) => <label key={day} className="day-check"><input type="checkbox" checked={(classForm.schedule_detail || '').includes(day)} onChange={(e) => { const current = classForm.schedule_detail ? classForm.schedule_detail.split(', ').filter(Boolean) : []; const next = e.target.checked ? [...current, day] : current.filter((x) => x !== day); setClassForm({ ...classForm, schedule_detail: next.join(', ') }); }} />{day}</label>)}</div>
      <label>Yêu cầu thêm<textarea className="staff-textarea" placeholder="VD: cần gia sư nữ, có kinh nghiệm luyện thi..." value={classForm.requirements} onChange={(e) => setClassForm({ ...classForm, requirements: e.target.value })} /></label>
      <button className="staff-submit-btn">Công khai lớp cho gia sư</button></form>}

    {tab === 'findTutors' && <><section className="staff-card wide"><h2>Tìm gia sư phù hợp</h2>{selectedRequest && <p className="muted">Đang xử lý yêu cầu: <b>{selectedRequest.parent} - {selectedRequest.subject} {selectedRequest.grade}</b></p>}<div className="staff-search-grid four"><label>Môn học<select value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })}><option value="">Chọn môn</option>{subjects.map(x=><option key={x}>{x}</option>)}</select></label><label>Lớp<select value={filter.grade} onChange={(e) => setFilter({ ...filter, grade: e.target.value })}><option value="">Chọn lớp</option>{grades.map(g=><option key={g}>{g}</option>)}</select></label><label>Lịch<input placeholder="VD: Thứ 2" value={filter.schedule} onChange={(e) => setFilter({ ...filter, schedule: e.target.value })} /></label><label>Khu vực<input placeholder="Nhập khu vực" value={filter.area} onChange={(e) => setFilter({ ...filter, area: e.target.value })} /></label></div><div className="staff-inline-actions"><button type="button" className="staff-search-btn" onClick={() => setHasSearched(true)}>⌕ Tìm kiếm</button><button type="button" className="staff-light-btn" onClick={resetFilter}>Xóa bộ lọc</button></div></section><section className="staff-card wide"><h2>Gia sư phù hợp ({filteredTutors.length})</h2><div className="tutor-card-grid aligned-actions">{filteredTutors.length ? filteredTutors.map((tutor) => <article className="mini-tutor-card" key={tutor.id}><div><h3>{tutor.full_name}</h3><p className="rating">★ {Number(tutor.rating || 0).toFixed(1)}</p><p><strong>Môn:</strong> {tutor.subject || 'Chưa cập nhật'}</p><p><strong>Lớp:</strong> {tutor.grade || 'Chưa cập nhật'}</p><p><strong>Lịch:</strong> {tutor.schedule}</p><p><strong>Khu vực:</strong> {tutor.area}</p><p><strong>Kinh nghiệm:</strong> {tutor.experience}</p></div><button className="staff-submit-btn card-bottom-btn" onClick={() => inviteTutor(tutor)}>⌁ Gửi lời mời</button></article>) : <p className="muted">Không tìm thấy gia sư phù hợp. Bạn có thể công khai lớp để gia sư đăng ký.</p>}</div></section></>}

    {tab === 'classes' && <section className="staff-card wide"><h2>Quản lý lớp học</h2><div className="class-management-grid">{classes.length ? classes.map((cls) => <article className="staff-class-card" key={cls.id}><div className="class-top-line"><h3>{cls.subject_name} - {cls.grade_level}</h3><StatusBadge status={cls.status} /></div><p><strong>Học viên:</strong> {cls.student?.fullName || cls.student?.full_name || '-'}</p><p><strong>Phụ huynh:</strong> {cls.student?.parentName || cls.student?.parent_name || '-'}</p><p><strong>Gia sư:</strong> {cls.tutor?.full_name || cls.tutor?.fullName || 'Chưa có'}</p><p><strong>Lịch học:</strong> {cls.schedule_detail || '-'}</p><p><strong>Địa điểm:</strong> {cls.address_teaching || '-'}</p><p className="green-text"><strong>Lương gia sư:</strong> {money(cls.salary_per_month)}/tháng</p><div className="staff-inline-actions wrap"><button className="staff-light-btn" onClick={() => setSelectedClass(cls)}>Xem chi tiết</button>{cls.status === 'open' && <button className="staff-light-btn" onClick={() => changeClassStatus(cls.id, 'cancelled')}>Hủy lớp</button>}{['teaching','assigned','waiting_parent'].includes(cls.status) && <button className="staff-light-btn" onClick={() => changeClassStatus(cls.id, 'completed')}>Hoàn thành</button>}{cls.status === 'cancelled' && <button className="staff-light-btn" onClick={() => changeClassStatus(cls.id, 'open')}>Mở lại</button>}</div></article>) : <p className="muted">Chưa có lớp học.</p>}</div></section>}

    {tab === 'sessions' && <section className="staff-card wide"><h2>Quản lý buổi học của gia sư</h2><div className="table-shell"><table className="staff-table"><thead><tr><th>Lớp học</th><th>Gia sư</th><th>Ngày</th><th>Trạng thái gia sư gửi</th><th>Ghi chú</th><th>Thao tác</th></tr></thead><tbody>{sessionRows.length ? sessionRows.map((row) => <tr key={`${row.type}-${row.id}`}><td><strong>{row.className}</strong></td><td>{row.tutor}</td><td>{row.date}</td><td><StatusBadge status={row.status} /></td><td>{row.note || '-'}</td><td className="staff-actions">{row.status === 'CONFIRMED' ? <span className="muted">Đã duyệt</span> : <><IconButton tone="green" title="Duyệt" onClick={() => confirmSession(row, 'APPROVED')}>✓</IconButton>{row.type === 'absence' && <IconButton tone="red" title="Từ chối" onClick={() => confirmSession(row, 'REJECTED')}>×</IconButton>}</>}</td></tr>) : <tr><td colSpan="6" className="muted">Chưa có buổi học/yêu cầu nghỉ/dạy bù.</td></tr>}</tbody></table></div></section>}

    {tab === 'payments' && <><section className="stat-row two-cards"><article className="admin-stat"><span className="icon green">$</span><p>Học phí đã thu</p><h3>{money(totalCollected)}</h3></article><article className="admin-stat"><span className="icon blue">♁</span><p>Lương gia sư</p><h3>{money(totalSalary)}</h3></article></section><section className="staff-card wide"><h2>Theo dõi học phí phụ huynh</h2><div className="table-shell"><table className="staff-table"><thead><tr><th>Phụ huynh</th><th>Lớp học</th><th>Số tiền</th><th>Ngày thanh toán</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{paymentRows.map((row) => <tr key={row.id}><td><strong>{row.parent}</strong></td><td>{row.className}</td><td>{money(row.amount)}</td><td>{row.date}</td><td><StatusBadge status={row.status} /></td><td>{row.status === 'paid' ? <span className="muted">Đã xác nhận</span> : <button className="staff-light-btn" onClick={() => changeEnrollmentStatus(row.enrollmentId || row.id)}>Xác nhận</button>}</td></tr>)}</tbody></table></div></section><section className="staff-card wide"><h2>Theo dõi lương gia sư</h2><div className="table-shell"><table className="staff-table"><thead><tr><th>Gia sư</th><th>Số buổi dạy</th><th>Lương</th><th>Trạng thái</th></tr></thead><tbody>{salaryRows.map((row) => <tr key={row.id}><td><strong>{row.tutor}</strong></td><td>{row.sessions}</td><td>{money(row.salary)}</td><td><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div></section></>}

    {selectedClass && <div className="modal-backdrop" onClick={() => setSelectedClass(null)}><section className="modal-card large" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setSelectedClass(null)}>×</button><h2>Chi tiết lớp học</h2><div className="detail-grid"><p><strong>Môn học:</strong> {selectedClass.subject_name}</p><p><strong>Lớp:</strong> {selectedClass.grade_level}</p><p><strong>Học viên:</strong> {selectedClass.student?.fullName || selectedClass.student?.full_name || '-'}</p><p><strong>Phụ huynh:</strong> {selectedClass.student?.parentName || selectedClass.student?.parent_name || '-'}</p><p><strong>Gia sư:</strong> {selectedClass.tutor?.full_name || selectedClass.tutor?.fullName || 'Chưa có'}</p><p><strong>Trạng thái:</strong> <StatusBadge status={selectedClass.status} /></p><p><strong>Lịch học:</strong> {selectedClass.schedule_detail}</p><p><strong>Địa điểm:</strong> {selectedClass.address_teaching}</p><p><strong>Lương gia sư:</strong> {money(selectedClass.salary_per_month)}/tháng</p><p><strong>Yêu cầu:</strong> {selectedClass.requirements || '-'}</p></div></section></div>}
  </main>;
}
export default StaffPortal;
