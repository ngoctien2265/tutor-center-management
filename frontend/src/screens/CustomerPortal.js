'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import { buildClassSessions, buildWeekDays, dayLabelToCode, formatWeekRange, mapCustomerClass, money, parseScheduleSlots, startOfWeek, timeFromMinutes } from './customerClassUtils';
import './TutorPortal.css';

const tabKeys = ['dashboard', 'request', 'classes', 'timetable'];
const desiredDays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const grades = Array.from({ length: 12 }, (_, i) => `Lớp ${i + 1}`);
const emptyStudent = { full_name: '', grade_level: '', school_name: '', birthday: '', gender: '', note: '' };

// Cấu hình ma trận lịch cho form đăng ký (giống TutorPortal)
const REQUEST_DAYS = [
  { code: 'MONDAY', label: 'Thứ 2' },
  { code: 'TUESDAY', label: 'Thứ 3' },
  { code: 'WEDNESDAY', label: 'Thứ 4' },
  { code: 'THURSDAY', label: 'Thứ 5' },
  { code: 'FRIDAY', label: 'Thứ 6' },
  { code: 'SATURDAY', label: 'Thứ 7' },
  { code: 'SUNDAY', label: 'Chủ nhật' },
];
const REQUEST_START_HOUR = 7;
const REQUEST_END_HOUR = 22;
const REQUEST_HOURS = Array.from({ length: REQUEST_END_HOUR - REQUEST_START_HOUR }, (_, i) => REQUEST_START_HOUR + i);

function StatusBadge({ children, tone = 'green' }) { return <span className={`tutor-badge ${tone}`}>{children}</span>; }
function statusVi(status) { return ({ unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán', active: 'Đang học', completed: 'Hoàn thành', overdue: 'Quá hạn', STAFF_PENDING: 'Chờ nhân viên xử lý', PENDING_ADMIN: 'Chờ admin duyệt', OPEN: 'Đang tìm gia sư', WAITING_PARENT: 'Chờ phụ huynh xác nhận', WAITING_TUTOR: 'Chờ gia sư xác nhận', ASSIGNED: 'Đang học', TEACHING: 'Đang học', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', APPROVED: 'Đã duyệt', PENDING: 'Chờ duyệt', REJECTED: 'Từ chối', ABSENCE_ONLY: 'Nghỉ', RESCHEDULE: 'Dạy bù', ABSENCE_WITH_MAKEUP: 'Dạy bù' }[status] || status || 'Đang học'); }

function ParentPortal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab') || 'dashboard';
  const tab = tabKeys.includes(urlTab) ? urlTab : 'dashboard';
  const [profile, setProfile] = useState({ parent: {}, students: [] });
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [requestForm, setRequestForm] = useState({
    subject: '',
    grade: '',
    mode: 'offline',
    area: '',
    expectedFee: '',
    note: '',
    totalSessions: '',
    scheduleCells: {},
    startDate: '', // new field
  });
  const [studentModal, setStudentModal] = useState(null);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [isDragging, setIsDragging] = useState(false);
  const [dragAction, setDragAction] = useState(null);
  const [timetableWeekStart, setTimetableWeekStart] = useState(() => startOfWeek(new Date()));

  const setTab = (nextTab) => router.push(nextTab === 'dashboard' ? '/customer' : `/customer?tab=${nextTab}`);
  const pageTitle = { dashboard: 'Tổng quan', request: 'Đăng ký tìm gia sư', classes: 'Lớp đang học', timetable: 'Thời khóa biểu' }[tab];

  const loadAll = async () => {
    const [p, c, pay] = await Promise.allSettled([
      axios.get('/v1/customer/profile'),
      axios.get('/v1/customer/classes'),
      axios.get('/v1/customer/payments'),
    ]);
    if (p.status === 'fulfilled') setProfile(p.value.data.data || { parent: {}, students: [] });
    if (c.status === 'fulfilled') setClasses(c.value.data.data || []);
    if (pay.status === 'fulfilled') setPayments(pay.value.data.data || []);
  };
  useEffect(() => { loadAll(); }, []);

  const learningClasses = useMemo(() => classes.map((c) => ({ ...mapCustomerClass(c), status: statusVi(c.status) })), [classes]);
  const paymentRows = payments.map((p) => ({ id: p.id, classId: p.enrollment_id?.class_id?.id, className: p.enrollment_id?.class_id?.subject_name || 'Lớp học', month: p.created_at?.slice(0, 7) || 'Tháng này', amount: p.amount, due: p.created_at?.slice(0, 10) || '-', status: p.status === 'success' ? 'Đã thanh toán' : 'Chưa thanh toán' }));
  const unpaidTotal = useMemo(() => paymentRows.filter((row) => row.status !== 'Đã thanh toán').reduce((sum, row) => sum + Number(row.amount || 0), 0), [payments]);
  const weekSchedule = learningClasses.filter((c) => ['Đang học', 'Chờ phụ huynh xác nhận'].includes(c.status)).slice(0, 4).map((c, idx) => ({ id: c.id, title: c.title, subtitle: `${c.student} - ${c.tutor}`, day: c.schedule.split(' ')[0] || ['Thứ 2', 'Thứ 3', 'Thứ 4'][idx] || 'Thứ 2', time: c.schedule.match(/\d{1,2}:\d{2}/)?.[0] || '19:00', location: c.location }));
  const notifications = learningClasses.flatMap((c) => (c.notifications || []).map((n) => ({ ...n, className: c.title, tutor: c.tutor })));
  const pendingConfirmations = learningClasses.filter((c) => c.rawStatus === 'WAITING_PARENT' || c.status === 'Chờ phụ huynh xác nhận');
  const timetableWeekDays = useMemo(() => buildWeekDays(timetableWeekStart), [timetableWeekStart]);
  const timetableSessions = useMemo(() => learningClasses.flatMap((cls) => {
    if (['Hoàn thành', 'Đã hủy'].includes(cls.status)) return [];
    const slots = parseScheduleSlots({ schedule: cls.scheduleSlots, scheduleDetail: cls.scheduleDetail });
    return buildClassSessions(cls, slots).map((session) => ({
      ...session,
      classId: cls.id,
      classTitle: cls.title,
      student: cls.student,
      tutor: cls.tutor,
      location: cls.location,
      status: cls.status,
    }));
  }), [learningClasses]);

  // Helper to compute date for a given day label based on startDate
  const getDateForDay = (dayLabel) => {
    if (!requestForm.startDate) return dayLabel;
    const start = new Date(requestForm.startDate);
    const dayOrder = REQUEST_DAYS.map(d => d.label);
    const idx = dayOrder.indexOf(dayLabel);
    if (idx === -1) return dayLabel;
    const date = new Date(start);
    date.setDate(start.getDate() + idx);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = date.getFullYear();
    return `${dayLabel} (${dd}/${mm}/${yy})`;
  };

  // Build classHourMap from existing active classes for timetable display
  const existingClassMap = useMemo(() => {
    const map = {};
    (classes || []).forEach((c) => {
      const schedule = c.schedule || [];
      (schedule || []).forEach((slot) => {
        const dayCode = dayLabelToCode(slot.dayLabel);
        if (!dayCode) return;
        if (!map[dayCode]) map[dayCode] = [];
        const startHour = parseInt(String(slot.startTime).split(':')[0], 10);
        const endHour = parseInt(String(slot.endTime).split(':')[0], 10);
        if (isNaN(startHour) || isNaN(endHour)) return;
        for (let h = startHour; h < endHour; h++) {
          map[dayCode].push({ slotHour: h, subject: c.subject || c.subject_name || 'Lớp', startTime: slot.startTime, endTime: slot.endTime });
        }
      });
    });
    return map;
  }, [classes]);

  const existingClassAt = (day, hour) => {
    const cells = existingClassMap[day] || [];
    return cells.find((c) => c.slotHour === hour) || null;
  };

  const handleCellMouseDown = (day, hour, e) => {
    if (e.button !== 0) return;
    const existing = existingClassAt(day, hour);
    if (existing) return;
    const key = `${day}-${hour}`;
    const willSelect = !requestForm.scheduleCells[key];
    setIsDragging(true);
    setDragAction(willSelect);
    setRequestForm((prev) => ({ ...prev, scheduleCells: { ...prev.scheduleCells, [key]: willSelect } }));
  };

  const handleCellMouseEnter = (day, hour) => {
    if (!isDragging || dragAction === null) return;
    const existing = existingClassAt(day, hour);
    if (existing) return;
    const key = `${day}-${hour}`;
    setRequestForm((prev) => ({ ...prev, scheduleCells: { ...prev.scheduleCells, [key]: dragAction } }));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragAction(null);
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    if (!requestForm.subject || !requestForm.grade) { toast.warning('Vui lòng nhập môn học và lớp.'); return; }
    if (requestForm.mode === 'offline' && !requestForm.area) { toast.warning('Vui lòng nhập khu vực cho hình thức học offline.'); return; }
    const fee = Number(requestForm.expectedFee);
    if (!requestForm.expectedFee || isNaN(fee) || fee <= 0) { toast.warning('Vui lòng nhập mức lương mong muốn cho gia sư (VNĐ/giờ).'); return; }
    try {
      const selectedSlotsMap = {};
      Object.entries(requestForm.scheduleCells).forEach(([key, v]) => {
        if (!v) return;
        const [dayCode, hourStr] = key.split('-');
        const hour = Number(hourStr);
        if (!selectedSlotsMap[dayCode]) selectedSlotsMap[dayCode] = [];
        selectedSlotsMap[dayCode].push(hour);
      });
      const selectedSlots = [];
      Object.keys(selectedSlotsMap).forEach((dayCode) => {
        const hours = selectedSlotsMap[dayCode].sort((a, b) => a - b);
        let startHour = hours[0];
        let endHour = hours[0] + 1;
        const dayLabel = (REQUEST_DAYS.find((d) => d.code === dayCode) || {}).label || dayCode;
        for (let i = 1; i < hours.length; i++) {
          if (hours[i] === endHour) {
            endHour = hours[i] + 1;
          } else {
            selectedSlots.push(`${dayLabel} ${String(startHour).padStart(2, '0')}:00-${String(endHour).padStart(2, '0')}:00`);
            startHour = hours[i];
            endHour = hours[i] + 1;
          }
        }
        selectedSlots.push(`${dayLabel} ${String(startHour).padStart(2, '0')}:00-${String(endHour).padStart(2, '0')}:00`);
      });
      await axios.post('/v1/customer/class-requests', {
        studentId: undefined,
        subject: requestForm.subject,
        gradeLevel: requestForm.grade,
        mode: requestForm.mode,
        area: requestForm.mode === 'offline' ? requestForm.area : '',
        desiredSchedule: selectedSlots.join(', '),
        requirements: requestForm.note,
        expectedFee: fee,
        totalSessions: requestForm.totalSessions ? Number(requestForm.totalSessions) : null,
        startDate: requestForm.startDate || null,
      });
      toast.success('Đã gửi yêu cầu tìm gia sư. Yêu cầu của bạn đang chờ nhân viên duyệt.');
      setRequestForm({ subject: '', grade: '', mode: 'offline', area: '', note: '', expectedFee: '', totalSessions: '', scheduleCells: {}, startDate: '' });
      await loadAll(); setTab('classes');
    } catch (error) { toast.error(error.response?.data?.message || 'Không gửi được yêu cầu.'); }
  };

  const openStudentModal = (mode, student = null) => {
    setStudentModal({ mode, student });
    setStudentForm(student ? { ...emptyStudent, ...student } : emptyStudent);
  };
  const closeStudentModal = () => { setStudentModal(null); setStudentForm(emptyStudent); };
  const saveStudent = async () => {
    if (!studentForm.full_name || !studentForm.grade_level) { toast.warning('Vui lòng nhập họ tên và lớp của học viên.'); return; }
    try {
      if (studentModal?.mode === 'add') {
        await axios.post('/v1/customer/students', studentForm);
        toast.success('Đã thêm học viên.');
      } else {
        await axios.patch(`/v1/customer/students/${studentModal.student.id}`, studentForm);
        toast.success('Đã cập nhật học viên.');
      }
      closeStudentModal();
      loadAll();
    } catch (error) { toast.error(error.response?.data?.message || 'Không lưu được học viên.'); }
  };
  const deleteStudent = async (student) => {
    if (!window.confirm(`Xóa học viên ${student.full_name}?`)) return;
    try {
      await axios.delete(`/v1/customer/students/${student.id}`);
      toast.success('Đã xóa học viên.');
      loadAll();
    } catch (error) { toast.error(error.response?.data?.message || 'Không xóa được học viên.'); }
  };

  const confirmTutor = async (item, decision = 'APPROVED') => {
    const confirmMessage = decision === 'APPROVED' ? `Xác nhận gia sư ${item.tutor} cho lớp ${item.title}?` : `Từ chối gia sư ${item.tutor} và yêu cầu trung tâm tìm gia sư khác?`;
    if (!window.confirm(confirmMessage)) return;
    try {
      await axios.post(`/v1/customer/classes/${item.id}/confirm-tutor`, { decision });
      toast.success(decision === 'APPROVED' ? 'Đã xác nhận gia sư. Lớp chuyển sang Đang học.' : 'Đã từ chối gia sư. Trung tâm sẽ tìm gia sư khác.');
      await loadAll();
      setTab('classes');
    } catch (error) { toast.error(error.response?.data?.message || 'Không xác nhận được gia sư.'); }
  };
  return <main className="tutor-figma-page parent-figma-page"><h1>{pageTitle}</h1>
    {tab === 'dashboard' && <><section className="tutor-stat-row parent-stat-row"><article className="tutor-stat"><span className="tutor-icon blue">♙</span><p>Học viên</p><h3>{profile.students?.length || 0}</h3></article><article className="tutor-stat"><span className="tutor-icon green">▰</span><p>Lớp đang học</p><h3>{learningClasses.filter(c => c.status === 'Đang học').length}</h3></article><article className="tutor-stat"><span className="tutor-icon orange">✓</span><p>Cần xác nhận gia sư</p><h3>{pendingConfirmations.length}</h3></article><article className="tutor-stat"><span className="tutor-icon purple">$</span><p>Học phí chưa thanh toán</p><h3>{money(unpaidTotal)}</h3></article></section>{pendingConfirmations.length ? <section className="tutor-card parent-confirm-section"><div className="section-head"><div><h2>Cần phụ huynh xác nhận gia sư</h2><p className="muted">Nhân viên đã chấp thuận và gửi gia sư phù hợp. Vui lòng xác nhận để lớp chuyển sang Đang học.</p></div><button className="outline-btn compact" onClick={() => setTab('classes')}>Xem tất cả</button></div><div className="teaching-grid">{pendingConfirmations.slice(0, 2).map((item) => <ParentClassCard key={item.id} item={item} onConfirm={confirmTutor} onView={() => router.push(`/customer/classes/${item.id}`)} />)}</div></section> : null}<section className="tutor-dashboard-grid"><div className="tutor-card"><h2>Lịch học tuần này</h2><div className="tutor-list">{weekSchedule.length ? weekSchedule.map((item) => <div className="schedule-item" key={item.id}><div><strong>{item.title}</strong><span>{item.subtitle}</span><span>Địa chỉ: {item.location}</span></div><div className="schedule-time"><b>{item.day}</b><span>{item.time}</span></div></div>) : <p className="muted">Chưa có lịch học.</p>}</div></div><div className="tutor-card"><h2>Thông báo</h2><div className="notice-list"><div className="parent-notice blue"><strong>Nhắc nhở thanh toán</strong><span>Còn {money(unpaidTotal)} học phí cần thanh toán</span></div>{notifications.length ? notifications.slice(0, 3).map((n) => <div className="parent-notice green" key={n.requestId}><strong>{statusVi(n.requestType)} - {n.className}</strong><span>{n.sessionDate}: {n.reason}</span></div>) : <div className="parent-notice green"><strong>Trạng thái lớp</strong><span>{learningClasses.filter((c) => c.status.includes('Chờ')).length} yêu cầu đang chờ trung tâm xử lý</span></div>}</div></div></section></>}

    {tab === 'request' && <form className="tutor-card parent-form-card big-parent-form" onSubmit={submitRequest}>
      <h2>Đăng ký tìm gia sư</h2>
      <p className="form-subtitle">Nhập đầy đủ nhu cầu học tập để nhân viên tìm gia sư phù hợp nhất.</p>
      <div className="profile-grid two">
        <FieldSelect label="Môn học" value={requestForm.subject} onChange={(v) => setRequestForm({ ...requestForm, subject: v })} options={['Toán', 'Vật lý', 'Hóa học', 'Tiếng Anh', 'Sinh học', 'Ngữ văn']} placeholder="Chọn môn học" />
        <FieldSelect label="Lớp" value={requestForm.grade} onChange={(v) => setRequestForm({ ...requestForm, grade: v })} options={grades} placeholder="Chọn lớp" />
      </div>
      <div className="profile-grid two" style={{ marginTop: '12px' }}>
        <label className="parent-field"><span>Hình thức học</span>
          <select value={requestForm.mode} onChange={(e) => setRequestForm({ ...requestForm, mode: e.target.value })}>
            <option value="offline">Học offline (tại nhà)</option>
            <option value="online">Học online</option>
          </select>
        </label>
        {requestForm.mode === 'offline' && <TextField label="Khu vực" value={requestForm.area} placeholder="VD: Quận 1, TP.HCM" onChange={(v) => setRequestForm({ ...requestForm, area: v })} />}
      </div>

      <div className="profile-grid two" style={{ marginTop: '12px' }}>
        <label className="parent-field">
          <span>Ngày bắt đầu</span>
          <input type="date" value={requestForm.startDate || ''} onChange={(e) => setRequestForm({ ...requestForm, startDate: e.target.value })} />
        </label>
        <TextField label="Mức lương mong muốn (VNĐ/giờ)" type="number" value={requestForm.expectedFee} placeholder="VD: 200000" onChange={(v) => setRequestForm({ ...requestForm, expectedFee: v })} />
        <TextField label="Tổng số buổi học (tuỳ chọn)" type="number" value={requestForm.totalSessions} placeholder="VD: 10" onChange={(v) => setRequestForm({ ...requestForm, totalSessions: v })} />
      </div>

      <div className="day-checks-title" style={{ marginTop: '20px' }}>Thời gian mong muốn</div>
      <p className="muted" style={{ marginBottom: '8px', fontSize: '13px' }}>Bấm vào ô trống để chọn khung giờ bạn muốn học. Ô màu xám là lịch học hiện tại.</p>
      <div className="timetable-grid-wrapper" onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}>
        <div className="timetable-grid" style={{ gridTemplateColumns: `80px repeat(${REQUEST_DAYS.length}, minmax(100px, 1fr))` }}>
          <div className="timetable-header-cell corner" />
          {REQUEST_DAYS.map((d) => <div key={d.code} className="timetable-header-cell day-header">{d.label}</div>)}
          {REQUEST_HOURS.map((hour) => <>
            <div key={`h-${hour}`} className="timetable-hour-cell">{String(hour).padStart(2, '0')}:00</div>
            {REQUEST_DAYS.map((d) => {
              const existing = existingClassAt(d.code, hour);
              const key = `${d.code}-${hour}`;
              const selected = requestForm.scheduleCells[key] || false;
              const cellClass = existing ? 'timetable-cell state-class' : selected ? 'timetable-cell state-available' : 'timetable-cell state-empty';
              return <div key={key} className={cellClass}
                onMouseDown={(e) => handleCellMouseDown(d.code, hour, e)}
                onMouseEnter={() => handleCellMouseEnter(d.code, hour)}
                title={existing ? `Lớp đang học: ${existing.subject} (${existing.startTime}-${existing.endTime})` : selected ? `Bỏ chọn ${d.label} ${hour}:00-${hour + 1}:00` : `Chọn ${d.label} ${hour}:00-${hour + 1}:00`}
              >
                {existing && <div className="cell-class-label"><strong>{existing.subject}</strong><small>{existing.startTime}-{existing.endTime}</small></div>}
              </div>;
            })}
          </>)}
        </div>
      </div>

      <TextArea label="Ghi chú tìm gia sư" value={requestForm.note} placeholder="VD: cần gia sư nữ, học tại nhà, ưu tiên buổi tối..." onChange={(v) => setRequestForm({ ...requestForm, note: v })} />
      <button className="tutor-submit full-width">Gửi yêu cầu tìm gia sư</button>
    </form>}

    {tab === 'classes' && <section className="tutor-card"><h2>Lớp đang học</h2>{pendingConfirmations.length ? <div className="parent-notice yellow confirmation-reminder"><strong>Có {pendingConfirmations.length} gia sư đang chờ bạn xác nhận</strong><span>Vui lòng xác nhận để lớp chuyển sang Đang học.</span><button className="outline-btn compact" onClick={() => setTab('classes')}>Xác nhận ngay</button></div> : null}<div className="teaching-grid">{learningClasses.length ? learningClasses.map((item) => <ParentClassCard key={item.id} item={item} onConfirm={confirmTutor} onView={() => router.push(`/customer/classes/${item.id}`)} />) : <p className="muted">Chưa có lớp học.</p>}</div></section>}

    {tab === 'timetable' && <StudentTimetable weekStart={timetableWeekStart} setWeekStart={setTimetableWeekStart} weekDays={timetableWeekDays} sessions={timetableSessions} onViewClass={(id) => router.push(`/customer/classes/${id}`)} />}

    {studentModal && <StudentModal mode={studentModal.mode} student={studentForm} setStudent={setStudentForm} onClose={closeStudentModal} onSave={saveStudent} />}
  </main>;
}

function TextField({ label, value, onChange, placeholder, disabled = false, type = 'text' }) { return <label className="parent-field"><span>{label}</span><input type={type} value={value || ''} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>; }
function TextArea({ label, value, onChange, placeholder, disabled = false }) { return <label className="parent-field"><span>{label}</span><textarea className="profile-textarea" value={value || ''} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>; }
function FieldSelect({ label, value, onChange, options, placeholder, disabled = false }) { return <label className="parent-field"><span>{label}</span><select value={value || ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}><option value="">{placeholder}</option>{options.map((item) => typeof item === 'string' ? <option value={item} key={item}>{item}</option> : <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>; }
function StudentModal({ mode, student, setStudent, onClose, onSave }) { const readonly = mode === 'view'; const title = mode === 'add' ? 'Thêm học viên' : mode === 'edit' ? 'Cập nhật học viên' : 'Thông tin học viên'; return <div className="modal-backdrop" onClick={onClose}><section className="modal-card large student-modal-card" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h2>{title}</h2><p className="form-subtitle">Thông tin này được dùng để đăng ký tìm gia sư và theo dõi lớp học của con.</p><div className="profile-grid two"><TextField label="Họ tên học viên" value={student.full_name} disabled={readonly} onChange={(v) => setStudent({ ...student, full_name: v })} placeholder="VD: Nguyễn Văn An" /><FieldSelect label="Lớp" value={student.grade_level} disabled={readonly} onChange={(v) => setStudent({ ...student, grade_level: v })} options={grades} placeholder="Chọn lớp" /><TextField label="Trường học" value={student.school_name} disabled={readonly} onChange={(v) => setStudent({ ...student, school_name: v })} placeholder="VD: THPT Nguyễn Trãi" /><FieldSelect label="Giới tính" value={student.gender} disabled={readonly} onChange={(v) => setStudent({ ...student, gender: v })} options={[{ label: 'Nam', value: 'male' }, { label: 'Nữ', value: 'female' }, { label: 'Khác', value: 'other' }]} placeholder="Chọn giới tính" /><TextField label="Ngày sinh" type="date" value={student.birthday} disabled={readonly} onChange={(v) => setStudent({ ...student, birthday: v })} /><TextArea label="Ghi chú học tập" value={student.note} disabled={readonly} onChange={(v) => setStudent({ ...student, note: v })} placeholder="VD: mất gốc Toán, cần học buổi tối..." /></div>{!readonly && <button className="tutor-submit full-width" onClick={onSave}>{mode === 'add' ? 'Thêm học viên' : 'Lưu thay đổi'}</button>}</section></div>; }
function ParentClassCard({ item, onConfirm, onView }) { const waitingParent = item.rawStatus === 'WAITING_PARENT' || item.status === 'Chờ phụ huynh xác nhận'; return <article className={`teaching-card parent-class-card ${waitingParent ? 'need-confirm' : ''}`}><div className="class-top"><h3>{item.title}</h3><StatusBadge tone={waitingParent ? 'yellow' : 'green'}>{item.status}</StatusBadge></div>{waitingParent ? <div className="confirm-callout"><strong>Nhân viên đã gửi gia sư phù hợp</strong><span>Vui lòng xác nhận để lớp chuyển sang Đang học.</span></div> : null}<p><b>Học viên:</b> {item.student} - {item.grade}</p><p><b>Gia sư:</b> {item.tutor}</p><p><b>Lịch:</b> {item.schedule}</p><p><b>Địa chỉ:</b> {item.location}</p><p className="green-text"><b>Học phí: {money(item.tuition)}/tháng</b></p>{item.notifications?.length ? <p className="muted">Có {item.notifications.length} thông báo nghỉ/dạy bù</p> : null}{waitingParent ? <div className="suggest-actions"><button className="tutor-primary" onClick={() => onConfirm(item, 'APPROVED')}>Đồng ý gia sư</button><button className="tutor-muted-btn" onClick={() => onConfirm(item, 'REJECTED')}>Từ chối</button></div> : <button className="outline-btn" onClick={onView}>Xem chi tiết</button>}</article>; }
function StudentTimetable({ weekStart, setWeekStart, weekDays, sessions, onViewClass }) {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);
  const weekSessionCount = sessions.filter((session) => weekDays.some((day) => day.dateKey === session.dateKey)).length;
  return <section className="tutor-card timetable-detail-card">
    <div className="section-head">
      <div>
        <h2>Thời khóa biểu tổng hợp</h2>
        <p className="muted">Tuần {formatWeekRange(weekStart)} · {weekSessionCount} buổi học</p>
      </div>
      <div className="suggest-actions wrap">
        <button className="outline-btn compact" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7))}>Tuần trước</button>
        <button className="outline-btn compact" onClick={() => setWeekStart(startOfWeek(new Date()))}>Tuần này</button>
        <button className="outline-btn compact" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7))}>Tuần sau</button>
      </div>
    </div>
    <div className="table-shell weekly-calendar-shell">
      <div className="timetable-grid weekly-calendar-grid" style={{ gridTemplateColumns: `84px repeat(${weekDays.length}, minmax(140px, 1fr))` }}>
        <div className="timetable-header-cell corner" />
        {weekDays.map((day) => <div key={day.code} className="timetable-header-cell day-header"><strong>{day.label}</strong><span>{day.dateLabel}</span></div>)}
        {hours.map((hour) => <React.Fragment key={hour}>
          <div className="timetable-hour-cell">{String(hour).padStart(2, '0')}:00</div>
          {weekDays.map((day) => {
            const currentStart = hour * 60;
            const currentEnd = (hour + 1) * 60;
            const cellSessions = sessions.filter((item) => item.dateKey === day.dateKey && item.start < currentEnd && item.end > currentStart);
            return <div key={`${day.code}-${hour}`} className={cellSessions.length ? 'timetable-cell state-class weekly-class-cell' : 'timetable-cell state-empty'}>
              {cellSessions.map((session) => <button key={`${session.classId}-${session.sessionNumber}-${hour}`} type="button" className="cell-class-label timetable-session-button" onClick={() => onViewClass(session.classId)}>
                <strong>{session.classTitle}</strong>
                <small>Buổi {session.sessionNumber}: {timeFromMinutes(session.start)}-{timeFromMinutes(session.end)}</small>
                <small>{session.student} · {session.tutor}</small>
                <small>{session.location}</small>
              </button>)}
            </div>;
          })}
        </React.Fragment>)}
      </div>
    </div>
    {!sessions.length && <p className="muted" style={{ marginTop: 12 }}>Chưa có lớp nào có lịch học.</p>}
  </section>;
}
export default ParentPortal;
