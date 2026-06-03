'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import { buildClassSessions, buildWeekDays, formatDate, formatWeekRange, parseScheduleSlots, startOfWeek, timeFromMinutes } from './customerClassUtils';
import './TutorPortal.css';

const tabKeys = ['dashboard', 'profile', 'proposed', 'classes', 'reviews', 'timetable'];
const money = (value) => Number(value || 0).toLocaleString('vi-VN') + 'đ';
function StatusBadge({ children, tone = 'green' }) { return <span className={`tutor-badge ${tone}`}>{children}</span>; }
function scheduleLabel(slots = []) { return slots.map((s) => `${s.dayLabel || s.dayOfWeek} ${s.startTime || ''}-${s.endTime || ''}`.trim()).join(', ') || '-'; }
function statusVi(status) { return ({ OPEN: 'Đang tìm gia sư', WAITING_PARENT: 'Chờ phụ huynh xác nhận', WAITING_TUTOR: 'Chờ gia sư xác nhận', ASSIGNED: 'Đang học', TEACHING: 'Đang học', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', ABSENCE_ONLY: 'Nghỉ', RESCHEDULE: 'Dạy bù', ABSENCE_WITH_MAKEUP: 'Dạy bù' }[status] || status || 'Đang học'); }
const today = () => new Date().toISOString().slice(0, 10);

// Cấu hình ma trận lịch: các thứ + khung giờ từ 7h đến 22h (mỗi ô = 1 tiếng)
const TIMETABLE_DAYS = [
  { code: 'MONDAY', label: 'Thứ 2' },
  { code: 'TUESDAY', label: 'Thứ 3' },
  { code: 'WEDNESDAY', label: 'Thứ 4' },
  { code: 'THURSDAY', label: 'Thứ 5' },
  { code: 'FRIDAY', label: 'Thứ 6' },
  { code: 'SATURDAY', label: 'Thứ 7' },
  { code: 'SUNDAY', label: 'Chủ nhật' },
];
const TIMETABLE_START_HOUR = 7;
const TIMETABLE_END_HOUR = 22;
const TIMETABLE_HOURS = Array.from({ length: TIMETABLE_END_HOUR - TIMETABLE_START_HOUR }, (_, i) => TIMETABLE_START_HOUR + i);

function hhmm(h) { return `${String(h).padStart(2, '0')}:00`; }
function hhmmEnd(h) { return `${String(h).padStart(2, '0')}:00`; }
const dayLabelOf = (code) => (TIMETABLE_DAYS.find((d) => d.code === code) || { label: code }).label;

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
  // State cho tab Lịch rảnh & Lịch dạy
  const [timetableData, setTimetableData] = useState({ availability: [], timetable: [], availabilityHourMap: {}, classHourMap: {} });
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [dragSelection, setDragSelection] = useState(null); // { day, startHour, endHour } trong khi đang kéo chuột
  const [isDragging, setIsDragging] = useState(false);
  const [timetableWeekStart, setTimetableWeekStart] = useState(() => startOfWeek(new Date()));

  const setTab = (nextTab) => router.push(nextTab === 'dashboard' ? '/tutor' : `/tutor?tab=${nextTab}`);
  const pageTitle = { dashboard: 'Tổng quan', profile: 'Hồ sơ cá nhân', proposed: 'Lớp đề xuất', classes: 'Lớp đang dạy', reviews: 'Đánh giá', timetable: 'Lịch rảnh & Lịch dạy' }[tab];

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
    try { await axios.post(`/v1/tutor/classes/${item.classId}/applications`, { coverNote: 'Gia sư đồng ý nhận lớp.', expectedSalary: item.salaryPerSession }); toast.success('Đã nhận lớp thành công.'); loadAll(); }
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

  // ====== Lịch rảnh & Lịch dạy ======
  const loadTimetable = async () => {
    setTimetableLoading(true);
    try {
      const res = await axios.get('/v1/tutor/availability/with-timetable');
      setTimetableData(res.data.data || { availability: [], timetable: [], availabilityHourMap: {}, classHourMap: {} });
    } catch (error) {
      toast.error('Không tải được lịch rảnh / lịch dạy.');
    } finally { setTimetableLoading(false); }
  };
  useEffect(() => {
    if (tab === 'timetable') loadTimetable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const timetableWeekDays = useMemo(() => buildWeekDays(timetableWeekStart), [timetableWeekStart]);
  const teachingSessions = useMemo(() => activeClasses.flatMap((cls) => {
    if (['COMPLETED', 'CANCELLED'].includes(cls.status)) return [];
    const slots = parseScheduleSlots({ schedule: cls.schedule });
    return buildClassSessions({ startDate: cls.startDate, totalSessions: cls.totalSessions }, slots).map((session) => ({
      ...session,
      classId: cls.classId,
      subject: cls.subject,
      studentName: cls.studentName,
      location: cls.location,
      status: cls.status,
    }));
  }), [activeClasses]);

  const sessionsAtCell = (dateKey, hour) => {
    const currentStart = hour * 60;
    const currentEnd = (hour + 1) * 60;
    return teachingSessions.filter((session) => session.dateKey === dateKey && session.start < currentEnd && session.end > currentStart);
  };

  const cellState = (day, hour, dateKey = null) => {
    const classMatches = dateKey ? sessionsAtCell(dateKey, hour) : [];
    if (classMatches.length) return { type: 'class', classes: classMatches };
    const avail = (timetableData.availabilityHourMap?.[day] || []).includes(hour);
    return { type: avail ? 'available' : 'empty' };
  };

  const isInDragSelection = (day, hour) => {
    if (!isDragging || !dragSelection || dragSelection.day !== day) return false;
    return hour >= dragSelection.startHour && hour < dragSelection.endHour;
  };

  // Click đơn lẻ vào 1 ô
  const handleCellClick = async (day, hour, dateKey = null) => {
    const state = cellState(day, hour, dateKey);
    if (state.type === 'class') {
      const subjects = state.classes.map((item) => item.subject).join(', ');
      toast.info(`Khung giờ này bạn đang dạy: ${subjects}.`);
      return;
    }
    try {
      if (state.type === 'available') {
        const slot = (timetableData.availability || []).find((s) => {
          if (s.dayOfWeek !== day) return false;
          const start = parseInt(String(s.startTime).split(':')[0], 10);
          const end = parseInt(String(s.endTime).split(':')[0], 10);
          return hour >= start && hour < end;
        });
        if (slot) {
          await axios.delete(`/v1/tutor/availability/${slot.id}`);
          toast.success(`Đã xoá khung giờ rảnh ${slot.startTime} - ${slot.endTime} (${dayLabelOf(day)}).`);
        }
      } else {
        await axios.post('/v1/tutor/availability/single', {
          dayOfWeek: day,
          startTime: `${String(hour).padStart(2, '0')}:00`,
          endTime: `${String(hour + 1).padStart(2, '0')}:00`,
        });
        toast.success(`Đã thêm khung giờ rảnh ${String(hour).padStart(2, '0')}:00 - ${String(hour + 1).padStart(2, '0')}:00 (${dayLabelOf(day)}).`);
      }
      await loadTimetable();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không cập nhật được lịch rảnh.');
    }
  };

  const handleCellMouseDown = (day, hour, e, dateKey = null) => {
    if (e.button !== 0) return;
    const state = cellState(day, hour, dateKey);
    if (state.type === 'class') return;
    setIsDragging(true);
    setDragSelection({ day, startHour: hour, endHour: hour + 1 });
  };

  const handleCellMouseEnter = (day, hour) => {
    if (!isDragging || !dragSelection) return;
    if (dragSelection.day !== day) return;
    setDragSelection({ ...dragSelection, endHour: hour + 1 });
  };

  const handleDragEnd = async () => {
    if (!isDragging || !dragSelection) {
      setIsDragging(false);
      setDragSelection(null);
      return;
    }
    const { day, startHour, endHour } = dragSelection;
    setIsDragging(false);
    setDragSelection(null);
    if (endHour <= startHour) return;
    let allAvailable = true;
    for (let h = startHour; h < endHour; h += 1) {
      if (cellState(day, h).type !== 'available') { allAvailable = false; break; }
    }
    try {
      if (allAvailable) {
        const slots = (timetableData.availability || []).filter((s) => {
          if (s.dayOfWeek !== day) return false;
          const ss = parseInt(String(s.startTime).split(':')[0], 10);
          const se = parseInt(String(s.endTime).split(':')[0], 10);
          return ss < endHour && se > startHour;
        });
        if (slots.length) {
          await Promise.all(slots.map((s) => axios.delete(`/v1/tutor/availability/${s.id}`)));
          toast.success(`Đã xoá ${slots.length} khung giờ rảnh (${dayLabelOf(day)}).`);
        }
      } else {
        await axios.post('/v1/tutor/availability/single', {
          dayOfWeek: day,
          startTime: `${String(startHour).padStart(2, '0')}:00`,
          endTime: `${String(endHour).padStart(2, '0')}:00`,
        });
        toast.success(`Đã cập nhật khung giờ rảnh ${String(startHour).padStart(2, '0')}:00 - ${String(endHour).padStart(2, '0')}:00 (${dayLabelOf(day)}).`);
      }
      await loadTimetable();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không cập nhật được lịch rảnh.');
    }
  };

  const availabilityStats = useMemo(() => {
    const items = timetableData.availability || [];
    const totalHours = items.reduce((sum, item) => {
      const start = parseInt(String(item.startTime).split(':')[0], 10);
      const end = parseInt(String(item.endTime).split(':')[0], 10);
      return sum + Math.max(0, end - start);
    }, 0);
    return { totalSlots: items.length, totalHours };
  }, [timetableData.availability]);
  const weekTeachingSessions = useMemo(() => teachingSessions
    .filter((session) => timetableWeekDays.some((day) => day.dateKey === session.dateKey))
    .sort((a, b) => `${a.dateKey}-${a.start}`.localeCompare(`${b.dateKey}-${b.start}`)), [teachingSessions, timetableWeekDays]);

  return <main className="tutor-figma-page"><h1>{pageTitle}</h1>
    {tab === 'dashboard' && <>
      <section className="tutor-stat-row">
        <article className="tutor-stat"><span className="tutor-icon blue">▰</span><p>Lớp đang dạy</p><h3>{dashboard.activeClasses ?? activeClasses.filter((c) => ['TEACHING','ASSIGNED','WAITING_PARENT'].includes(c.status)).length}</h3></article>
        <article className="tutor-stat"><span className="tutor-icon green">▣</span><p>Buổi dạy tháng này</p><h3>{dashboard.totalTeachingLogs ?? logs.length}</h3></article>
        <article className="tutor-stat"><span className="tutor-icon purple">$</span><p>Thu nhập tháng này</p><h3>{money(income)}</h3></article>
        <article className="tutor-stat"><span className="tutor-icon yellow">☆</span><p>Đánh giá</p><h3>{avgRating}</h3></article>
      </section>
      <section className="tutor-dashboard-grid"><div className="tutor-card"><h2>Lịch dạy tuần này</h2><div className="tutor-list">{weekSchedule.length ? weekSchedule.map((item, idx) => <div className="schedule-item" key={idx}><div><strong>{item.subject}</strong><span>{item.studentName || ''}</span><span>Địa chỉ: {item.location || item.address || 'Chưa cập nhật'}</span></div><div className="schedule-time"><b>{item.dayLabel || item.schedule?.[0]?.dayLabel || 'Thứ'}</b><span>{item.startTime || item.schedule?.[0]?.startTime || ''}</span></div></div>) : <p className="muted">Chưa có lịch dạy.</p>}</div></div></section>
    </>}

    {tab === 'proposed' && <section className="tutor-card"><h2>Lớp được đề xuất (Phù hợp với lịch rảnh)</h2><div className="teaching-grid tutor-class-management">{proposedClasses.length ? proposedClasses.map((item) => <article className="suggest-card" key={item.classId}><h3>{item.subject} - {item.level}</h3><p>Địa chỉ: {item.location}</p><p>Lịch: {scheduleLabel(item.schedule)}</p><p>Lương dự kiến: {money(item.salaryPerSession * (item.sessionsPerWeek || 2) * 4)}/tháng</p><div className="suggest-actions wrap"><button className="tutor-primary" onClick={() => acceptClass(item)}>Đồng ý nhận lớp</button><button className="tutor-muted-btn" onClick={() => setDeclinedOpen((prev) => [...prev, String(item.classId)])}>Từ chối</button></div></article>) : <p className="muted">Chưa có lớp phù hợp với lịch rảnh của bạn. Hãy cập nhật Lịch rảnh để hệ thống gợi ý tốt hơn.</p>}</div></section>}

    {tab === 'profile' && <form className="profile-stack beautiful-profile" onSubmit={(e) => { e.preventDefault(); saveProfile(); }}><section className="tutor-card profile-hero"><div className="profile-avatar">{(profile.fullName || 'GS').slice(0, 2).toUpperCase()}</div><div><h2>{profile.fullName || 'Gia sư'}</h2><p>{profile.university || 'Cập nhật trường học'} • {profile.major || 'Cập nhật chuyên ngành'}</p><span className="rating">★ {avgRating}</span></div></section><section className="tutor-card profile-card"><h2>Thông tin cá nhân</h2><div className="profile-grid two"><label>Họ và tên<input value={profile.fullName || ''} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></label><label>Email<input value={profile.email || ''} readOnly /></label><label>Số điện thoại<input value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label><label>Địa chỉ<input value={profile.address || ''} onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></label><label>Trường đại học<input value={profile.university || ''} onChange={(e) => setProfile({ ...profile, university: e.target.value })} /></label><label>Chuyên ngành<input value={profile.major || ''} onChange={(e) => setProfile({ ...profile, major: e.target.value })} /></label></div><label>Kinh nghiệm<textarea className="profile-textarea" value={profile.bio || ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></label></section><section className="tutor-card profile-card"><h2>Năng lực giảng dạy</h2><div className="profile-grid two"><label>Môn có thể dạy<input value={profile.teachableSubjects || ''} onChange={(e) => setProfile({ ...profile, teachableSubjects: e.target.value })} /></label><label>Khối lớp<input value={profile.teachableGrades || ''} onChange={(e) => setProfile({ ...profile, teachableGrades: e.target.value })} /></label></div><label>Khu vực dạy<input value={profile.teachingAreas || ''} onChange={(e) => setProfile({ ...profile, teachingAreas: e.target.value })} /></label></section><button className="tutor-submit full-width">Lưu hồ sơ</button></form>}

    {tab === 'classes' && <><section className="tutor-card"><h2>Lớp đang dạy</h2><div className="teaching-grid tutor-class-management">{activeClasses.length ? activeClasses.map((cls) => <article className="teaching-card" key={cls.classId}><div className="class-top"><h3>{cls.subject} - {cls.level}</h3><StatusBadge tone={cls.status === 'WAITING_PARENT' ? 'yellow' : 'green'}>{statusVi(cls.status)}</StatusBadge></div><p><strong>Học viên:</strong> {cls.studentName}</p><p><strong>Phụ huynh:</strong> {cls.parentName} - {cls.parentPhone || 'Chưa cập nhật'}</p><p><strong>Lịch:</strong> {scheduleLabel(cls.schedule)}</p><p><strong>Địa chỉ:</strong> {cls.location}</p><p className="green-text"><b>Lương: {money(Number(cls.salaryPerSession || 0) * Number(cls.sessionsPerWeek || 2) * 4)}/tháng</b></p><div className="suggest-actions wrap"><button className="outline-btn compact" onClick={() => startAction(cls, 'TAUGHT')}>Đã dạy</button><button className="outline-btn compact" onClick={() => startAction(cls, 'ABSENCE')}>Xin nghỉ</button><button className="outline-btn compact" onClick={() => startAction(cls, 'MAKEUP')}>Dạy bù</button></div></article>) : <p className="muted">Chưa có lớp đang dạy.</p>}</div></section>{actionForm && <form className="tutor-card action-panel" onSubmit={submitClassAction}><h2>{actionForm.type === 'TAUGHT' ? 'Ghi nhận đã dạy' : actionForm.type === 'ABSENCE' ? 'Xin nghỉ buổi học' : 'Yêu cầu dạy bù'} - {actionForm.className}</h2><div className="profile-grid two"><label>Ngày<input type="date" value={actionForm.date} onChange={(e) => setActionForm({ ...actionForm, date: e.target.value })} /></label><label>Ghi chú<input value={actionForm.note} onChange={(e) => setActionForm({ ...actionForm, note: e.target.value })} placeholder="Nhập nội dung/ lý do..." /></label></div><div className="suggest-actions"><button className="tutor-primary">Gửi cho nhân viên duyệt</button><button type="button" className="tutor-muted-btn" onClick={() => setActionForm(null)}>Đóng</button></div></form>}<section className="tutor-card"><h2>Nhật ký và yêu cầu đã gửi</h2><div className="table-shell"><table className="tutor-table-new"><thead><tr><th>Lớp</th><th>Ngày</th><th>Loại</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>{[...absenceRequests.map((a) => ({ id: `a-${a.requestId}`, className: a.subject, date: a.sessionDate, type: statusVi(a.requestType), status: statusVi(a.status), note: a.reason })), ...logs.map((l) => ({ id: `l-${l.logId}`, className: l.className, date: l.sessionDate, type: 'Đã dạy', status: (l.note || '').includes('Staff xác nhận') ? 'Đã duyệt' : 'Chờ duyệt', note: l.content || l.note }))].map((row) => <tr key={row.id}><td>{row.className}</td><td>{row.date}</td><td>{row.type}</td><td>{row.status}</td><td>{row.note || '-'}</td></tr>)}</tbody></table></div></section></>}

    {tab === 'reviews' && <><section className="tutor-card review-summary"><h2>Tổng quan đánh giá</h2><div className="review-big"><strong>{avgRating}</strong><span>{'★'.repeat(Math.round(Number(avgRating)))}</span><p>{reviews.length} đánh giá từ phụ huynh</p></div></section><section className="review-list-new">{reviews.length ? reviews.map((review) => <article className="review-item-new" key={review.reviewId}><div><h3>{review.reviewer || 'Phụ huynh'}</h3><p>{review.comment || 'Không có nhận xét.'}</p><small>{review.subject}</small></div><span>{'★'.repeat(review.starRating || 5)}</span></article>) : <p className="muted">Chưa có đánh giá.</p>}</section></>}

    {tab === 'timetable' && <TimetableTab
      timetableData={timetableData}
      loading={timetableLoading}
      onRefresh={loadTimetable}
      stats={availabilityStats}
      onCellMouseDown={handleCellMouseDown}
      onCellMouseEnter={handleCellMouseEnter}
      onCellClick={handleCellClick}
      onDragEnd={handleDragEnd}
      isInDragSelection={isInDragSelection}
      cellState={cellState}
      timetableWeekStart={timetableWeekStart}
      setTimetableWeekStart={setTimetableWeekStart}
      timetableWeekDays={timetableWeekDays}
      weekTeachingSessions={weekTeachingSessions}
    />}
  </main>;
}

function TimetableTab({ timetableData, loading, onRefresh, stats, onCellMouseDown, onCellMouseEnter, onCellClick, onDragEnd, isInDragSelection, cellState, timetableWeekStart, setTimetableWeekStart, timetableWeekDays, weekTeachingSessions }) {
  const [legendOpen, setLegendOpen] = useState(true);
  return <div className="timetable-tab" onMouseUp={onDragEnd} onMouseLeave={onDragEnd}>
    <section className="tutor-card timetable-intro">
      <div className="section-head">
        <div>
          <h2>Ma trận lịch rảnh & lịch dạy</h2>
          <p className="muted">Bấm vào ô trống để thêm khung giờ rảnh 1 tiếng, bấm vào ô xanh để xoá. Kéo chuột để chọn nhiều ô liên tiếp. Các ô xám là lớp đang dạy cố định.</p>
        </div>
        <div className="timetable-summary">
          <span className="timetable-pill green">{stats.totalSlots} khung rảnh</span>
          <span className="timetable-pill blue">{stats.totalHours} giờ / tuần</span>
          <button className="outline-btn compact" onClick={onRefresh} disabled={loading}>{loading ? 'Đang tải...' : '↻ Làm mới'}</button>
        </div>
      </div>
      <div className="timetable-legend">
        <button type="button" className="legend-toggle" onClick={() => setLegendOpen((o) => !o)}>{legendOpen ? 'Ẩn chú thích' : 'Hiện chú thích'}</button>
        {legendOpen && <div className="legend-row">
          <span className="legend-chip empty" /> <span>Trống (bấm để thêm)</span>
          <span className="legend-chip available" /> <span>Khung giờ rảnh (bấm để xoá)</span>
          <span className="legend-chip class" /> <span>Đang dạy lớp theo ngày cụ thể</span>
          <span className="legend-chip dragging" /> <span>Đang chọn</span>
        </div>}
      </div>
    </section>

    <section className="tutor-card timetable-matrix-card">
      <div className="section-head">
        <div>
          <h2>Thời khóa biểu dạy trong tuần</h2>
          <p className="muted">Tuần {formatWeekRange(timetableWeekStart)}</p>
        </div>
        <div className="suggest-actions wrap">
          <button className="outline-btn compact" onClick={() => setTimetableWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7))}>Tuần trước</button>
          <button className="outline-btn compact" onClick={() => setTimetableWeekStart(startOfWeek(new Date()))}>Tuần này</button>
          <button className="outline-btn compact" onClick={() => setTimetableWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7))}>Tuần sau</button>
        </div>
      </div>
      <div className="timetable-grid-wrapper">
        <div className="timetable-grid weekly-calendar-grid" style={{ gridTemplateColumns: `80px repeat(${timetableWeekDays.length}, minmax(130px, 1fr))` }}>
          <div className="timetable-header-cell corner" />
          {timetableWeekDays.map((d) => <div key={d.code} className="timetable-header-cell day-header"><strong>{d.label}</strong><span>{d.dateLabel}</span></div>)}
          {TIMETABLE_HOURS.map((hour) => <>
            <div key={`h-${hour}`} className="timetable-hour-cell">{String(hour).padStart(2, '0')}:00</div>
            {timetableWeekDays.map((d) => {
              const state = cellState(d.code, hour, d.dateKey);
              const inDrag = isInDragSelection(d.code, hour);
              const cellClass = ['timetable-cell', `state-${state.type}`, inDrag ? 'is-dragging' : ''].filter(Boolean).join(' ');
              return <div
                key={`${d.code}-${d.dateKey}-${hour}`}
                className={cellClass}
                onMouseDown={(e) => onCellMouseDown(d.code, hour, e, d.dateKey)}
                onMouseEnter={() => onCellMouseEnter(d.code, hour)}
                onClick={(e) => { if (e.detail === 1) onCellClick(d.code, hour, d.dateKey); }}
                title={state.type === 'class' ? `Đang dạy: ${state.classes.map((item) => item.subject).join(', ')}` : state.type === 'available' ? `Khung rảnh ${hour}:00 - ${hour + 1}:00 (bấm để xoá)` : `Trống - bấm để thêm ${hour}:00 - ${hour + 1}:00`}
              >
                {state.type === 'class' && state.classes.map((cls) => <div className="cell-class-label" key={`${cls.classId}-${cls.sessionNumber}`}>
                  <strong>{cls.subject || 'Lớp'}</strong>
                  <small>Buổi {cls.sessionNumber}: {timeFromMinutes(cls.start)}-{timeFromMinutes(cls.end)}</small>
                  <small>{cls.studentName || 'Học viên'} · {cls.location || '-'}</small>
                </div>)}
              </div>;
            })}
          </>)}
        </div>
      </div>
    </section>

    <section className="timetable-summary-grid">
      <article className="tutor-card">
        <h2>Lịch rảnh đã đăng ký</h2>
        {timetableData.availability?.length ? (
          <div className="table-shell">
            <table className="tutor-table-new">
              <thead><tr><th>Thứ</th><th>Bắt đầu</th><th>Kết thúc</th><th>Số giờ</th></tr></thead>
              <tbody>
                {(timetableData.availability || []).map((s) => {
                  const parseTime = (t) => {
                    if (!t) return NaN;
                    const parts = String(t).split(':');
                    return parseInt(parts[0], 10) * 60 + (parseInt(parts[1], 10) || 0);
                  };
                  const startMin = parseTime(s.startTime);
                  const endMin = parseTime(s.endTime);
                  const diffHours = isNaN(startMin) || isNaN(endMin) ? null : (endMin - startMin) / 60;
                  return <tr key={s.id}>
                    <td>{dayLabelOf(s.dayOfWeek)}</td>
                    <td>{s.startTime}</td>
                    <td>{s.endTime}</td>
                    <td>{diffHours !== null ? `${diffHours}h` : '--'}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Chưa đăng ký khung giờ rảnh nào. Bấm vào ô trống trong ma trận phía trên để thêm.</p>}
      </article>
      <article className="tutor-card">
        <h2>Buổi dạy trong tuần ({weekTeachingSessions.length})</h2>
        {weekTeachingSessions.length ? (
          <div className="table-shell">
            <table className="tutor-table-new">
              <thead><tr><th>Ngày</th><th>Giờ</th><th>Môn</th><th>Học viên</th><th>Địa chỉ</th></tr></thead>
              <tbody>
                {weekTeachingSessions.map((session) => <tr key={`${session.classId}-${session.sessionNumber}`}>
                  <td>{formatDate(session.date)}</td>
                  <td>{timeFromMinutes(session.start)} - {timeFromMinutes(session.end)}</td>
                  <td><strong>{session.subject}</strong></td>
                  <td>{session.studentName || '-'}</td>
                  <td>{session.location || '-'}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Tuần này chưa có buổi dạy nào hoặc lớp chưa có ngày bắt đầu/tổng số buổi.</p>}
      </article>
    </section>
  </div>;
}

export default TutorPortal;
