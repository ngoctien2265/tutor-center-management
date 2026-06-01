'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';
import './TutorPortal.css';

const tabKeys = ['dashboard', 'request', 'students', 'confirmations', 'classes', 'tutors', 'payments', 'reviews'];
const money = (value) => Number(value || 0).toLocaleString('vi-VN') + 'đ';
const desiredDays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const grades = Array.from({ length: 12 }, (_, i) => `Lớp ${i + 1}`);
const emptyStudent = { full_name: '', grade_level: '', school_name: '', birthday: '', gender: '', note: '' };

function StatusBadge({ children, tone = 'green' }) { return <span className={`tutor-badge ${tone}`}>{children}</span>; }
function scheduleText(s) { return s?.scheduleDetail || (s?.schedule || []).map((x) => `${x.dayLabel} ${x.startTime || ''}-${x.endTime || ''}`.trim()).join(', ') || '-'; }
function statusVi(status) { return ({ unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán', active: 'Đang học', completed: 'Hoàn thành', overdue: 'Quá hạn', STAFF_PENDING: 'Chờ nhân viên xử lý', PENDING_ADMIN: 'Chờ admin duyệt', OPEN: 'Đang tìm gia sư', WAITING_PARENT: 'Chờ phụ huynh xác nhận', WAITING_TUTOR: 'Chờ gia sư xác nhận', ASSIGNED: 'Đang học', TEACHING: 'Đang học', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', APPROVED: 'Đã duyệt', PENDING: 'Chờ duyệt', REJECTED: 'Từ chối', ABSENCE_ONLY: 'Nghỉ', RESCHEDULE: 'Dạy bù', ABSENCE_WITH_MAKEUP: 'Dạy bù' }[status] || status || 'Đang học'); }

function ParentPortal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab') || 'dashboard';
  const tab = tabKeys.includes(urlTab) ? urlTab : 'dashboard';
  const [profile, setProfile] = useState({ parent: {}, students: [] });
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [requestForm, setRequestForm] = useState({ studentId: '', subject: '', grade: '', area: '', note: '', days: {} });
  const [reviewState, setReviewState] = useState({});
  const [studentModal, setStudentModal] = useState(null);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [selectedClass, setSelectedClass] = useState(null);

  const setTab = (nextTab) => router.push(nextTab === 'dashboard' ? '/customer' : `/customer?tab=${nextTab}`);
  const pageTitle = { dashboard: 'Tổng quan', request: 'Đăng ký tìm gia sư', students: 'Quản lý học viên', confirmations: 'Xác nhận gia sư', classes: 'Lớp đang học', tutors: 'Thông tin gia sư', payments: 'Học phí', reviews: 'Đánh giá gia sư' }[tab];

  const loadAll = async () => {
    const [p, c, pay, r] = await Promise.allSettled([
      axios.get('/v1/customer/profile'),
      axios.get('/v1/customer/classes'),
      axios.get('/v1/customer/payments'),
      axios.get('/v1/customer/reviews'),
    ]);
    if (p.status === 'fulfilled') setProfile(p.value.data.data || { parent: {}, students: [] });
    if (c.status === 'fulfilled') setClasses(c.value.data.data || []);
    if (pay.status === 'fulfilled') setPayments(pay.value.data.data || []);
    if (r.status === 'fulfilled') setReviews(r.value.data.data || []);
  };
  useEffect(() => { loadAll(); }, []);

  const learningClasses = classes.map((c) => ({
    id: c.classId,
    title: c.subject,
    student: c.student?.full_name || c.student?.fullName || '-',
    grade: c.student?.grade_level || c.student?.gradeLevel || '-',
    school: c.student?.school_name || '-',
    tutor: c.tutor?.fullName || 'Chưa phân công',
    schedule: scheduleText(c), tuition: c.salaryPerMonth || 0, rawStatus: c.status, status: statusVi(c.status), tutorObj: c.tutor,
    location: c.location || '-', requirements: c.requirements || '-', notifications: c.absenceRequests || [], sessionsPerWeek: c.sessionsPerWeek || 1,
  }));
  const tutors = learningClasses.filter((c) => c.tutorObj).map((c) => ({ id: c.tutorObj.id, name: c.tutorObj.fullName, subject: c.title, experience: c.tutorObj.bio || c.tutorObj.major || 'Chưa cập nhật', rating: c.tutorObj.rating || 0, phone: c.tutorObj.phone || 'Chưa cập nhật', email: c.tutorObj.email || 'Chưa cập nhật', university: c.tutorObj.university || '-', area: c.tutorObj.teachingAreas || '-' }));
  const paymentRows = payments.map((p) => ({ id: p.id, classId: p.enrollment_id?.class_id?.id, className: p.enrollment_id?.class_id?.subject_name || 'Lớp học', month: p.created_at?.slice(0, 7) || 'Tháng này', amount: p.amount, due: p.created_at?.slice(0, 10) || '-', status: p.status === 'success' ? 'Đã thanh toán' : 'Chưa thanh toán' }));
  const unpaidTotal = useMemo(() => paymentRows.filter((row) => row.status !== 'Đã thanh toán').reduce((sum, row) => sum + Number(row.amount || 0), 0), [payments]);
  const weekSchedule = learningClasses.filter((c) => ['Đang học', 'Chờ phụ huynh xác nhận'].includes(c.status)).slice(0, 4).map((c, idx) => ({ id: c.id, title: c.title, subtitle: `${c.student} - ${c.tutor}`, day: c.schedule.split(' ')[0] || ['Thứ 2', 'Thứ 3', 'Thứ 4'][idx] || 'Thứ 2', time: c.schedule.match(/\d{1,2}:\d{2}/)?.[0] || '19:00', location: c.location }));
  const notifications = learningClasses.flatMap((c) => (c.notifications || []).map((n) => ({ ...n, className: c.title, tutor: c.tutor })));
  const pendingConfirmations = learningClasses.filter((c) => c.rawStatus === 'WAITING_PARENT' || c.status === 'Chờ phụ huynh xác nhận');

  const submitRequest = async (event) => {
    event.preventDefault();
    if (!requestForm.subject || !requestForm.grade || !requestForm.area) { toast.warning('Vui lòng nhập môn học, lớp và khu vực.'); return; }
    try {
      await axios.post('/v1/customer/class-requests', {
        studentId: requestForm.studentId || undefined,
        subject: requestForm.subject,
        gradeLevel: requestForm.grade,
        area: requestForm.area,
        desiredSchedule: Object.keys(requestForm.days).filter((day) => requestForm.days[day]).join(', '),
        requirements: requestForm.note,
        expectedFee: 0,
      });
      toast.success('Đã gửi yêu cầu tìm gia sư');
      setRequestForm({ studentId: '', subject: '', grade: '', area: '', note: '', days: {} });
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

  const pay = async (row) => { try { await axios.post(`/v1/customer/payments/${row.id}/pay`); toast.success('Đã ghi nhận thanh toán học phí'); loadAll(); } catch (error) { toast.error(error.response?.data?.message || 'Không thanh toán được.'); } };
  const confirmTutor = async (item, decision = 'APPROVED') => {
    const confirmMessage = decision === 'APPROVED' ? `Xác nhận gia sư ${item.tutor} cho lớp ${item.title}?` : `Từ chối gia sư ${item.tutor} và yêu cầu trung tâm tìm gia sư khác?`;
    if (!window.confirm(confirmMessage)) return;
    try {
      await axios.post(`/v1/customer/classes/${item.id}/confirm-tutor`, { decision });
      toast.success(decision === 'APPROVED' ? 'Đã xác nhận gia sư. Lớp chuyển sang Đang học.' : 'Đã từ chối gia sư. Trung tâm sẽ tìm gia sư khác.');
      await loadAll();
      setTab(decision === 'APPROVED' ? 'classes' : 'confirmations');
    } catch (error) { toast.error(error.response?.data?.message || 'Không xác nhận được gia sư.'); }
  };
  const sendReview = async (id) => { const current = reviewState[id] || { stars: 0, comment: '' }; if (!current.stars) { toast.warning('Vui lòng chọn số sao đánh giá.'); return; } try { await axios.post(`/v1/customer/classes/${id}/reviews`, { starRating: current.stars, comment: current.comment }); toast.success('Đã gửi đánh giá cho gia sư!'); loadAll(); } catch (error) { toast.error(error.response?.data?.message || 'Không gửi được đánh giá.'); } };

  return <main className="tutor-figma-page parent-figma-page"><h1>{pageTitle}</h1>
    {tab === 'dashboard' && <><section className="tutor-stat-row parent-stat-row"><article className="tutor-stat"><span className="tutor-icon blue">♙</span><p>Học viên</p><h3>{profile.students?.length || 0}</h3></article><article className="tutor-stat"><span className="tutor-icon green">▰</span><p>Lớp đang học</p><h3>{learningClasses.filter(c => c.status === 'Đang học').length}</h3></article><article className="tutor-stat"><span className="tutor-icon orange">✓</span><p>Cần xác nhận gia sư</p><h3>{pendingConfirmations.length}</h3></article><article className="tutor-stat"><span className="tutor-icon purple">$</span><p>Học phí chưa thanh toán</p><h3>{money(unpaidTotal)}</h3></article></section>{pendingConfirmations.length ? <section className="tutor-card parent-confirm-section"><div className="section-head"><div><h2>Cần phụ huynh xác nhận gia sư</h2><p className="muted">Nhân viên đã chấp thuận và gửi gia sư phù hợp. Vui lòng xác nhận để lớp chuyển sang Đang học.</p></div><button className="outline-btn compact" onClick={() => setTab('confirmations')}>Xem tất cả</button></div><div className="teaching-grid">{pendingConfirmations.slice(0, 2).map((item) => <ParentClassCard key={item.id} item={item} onConfirm={confirmTutor} onView={() => setSelectedClass(item)} />)}</div></section> : null}<section className="tutor-dashboard-grid"><div className="tutor-card"><h2>Lịch học tuần này</h2><div className="tutor-list">{weekSchedule.length ? weekSchedule.map((item) => <div className="schedule-item" key={item.id}><div><strong>{item.title}</strong><span>{item.subtitle}</span><span>Địa chỉ: {item.location}</span></div><div className="schedule-time"><b>{item.day}</b><span>{item.time}</span></div></div>) : <p className="muted">Chưa có lịch học.</p>}</div></div><div className="tutor-card"><h2>Thông báo</h2><div className="notice-list"><div className="parent-notice blue"><strong>Nhắc nhở thanh toán</strong><span>Còn {money(unpaidTotal)} học phí cần thanh toán</span></div>{notifications.length ? notifications.slice(0, 3).map((n) => <div className="parent-notice green" key={n.requestId}><strong>{statusVi(n.requestType)} - {n.className}</strong><span>{n.sessionDate}: {n.reason}</span></div>) : <div className="parent-notice green"><strong>Trạng thái lớp</strong><span>{learningClasses.filter((c) => c.status.includes('Chờ')).length} yêu cầu đang chờ trung tâm xử lý</span></div>}</div></div></section></>}

    {tab === 'request' && <form className="tutor-card parent-form-card big-parent-form" onSubmit={submitRequest}><h2>Đăng ký tìm gia sư</h2><p className="form-subtitle">Nhập đầy đủ nhu cầu học tập để nhân viên tìm gia sư phù hợp nhất.</p><div className="profile-grid two"><FieldSelect label="Học viên" value={requestForm.studentId} onChange={(v) => setRequestForm({ ...requestForm, studentId: v })} options={(profile.students || []).map((s) => ({ label: `${s.full_name} - ${s.grade_level || 'Chưa có lớp'}`, value: s.id }))} placeholder="Chọn học viên" /><FieldSelect label="Môn học" value={requestForm.subject} onChange={(v) => setRequestForm({ ...requestForm, subject: v })} options={['Toán', 'Vật lý', 'Hóa học', 'Tiếng Anh', 'Sinh học', 'Ngữ văn']} placeholder="Chọn môn học" /><FieldSelect label="Lớp" value={requestForm.grade} onChange={(v) => setRequestForm({ ...requestForm, grade: v })} options={grades} placeholder="Chọn lớp" /><TextField label="Khu vực" value={requestForm.area} placeholder="VD: Quận 1, TP.HCM" onChange={(v) => setRequestForm({ ...requestForm, area: v })} /></div><div className="day-checks-title">Thời gian mong muốn</div><div className="parent-day-grid">{desiredDays.map((day) => <label className="slot-check" key={day}><input type="checkbox" checked={!!requestForm.days[day]} onChange={() => setRequestForm((prev) => ({ ...prev, days: { ...prev.days, [day]: !prev.days[day] } }))} />{day}</label>)}</div><TextArea label="Ghi chú yêu cầu" value={requestForm.note} placeholder="VD: cần gia sư nữ, học tại nhà, ưu tiên buổi tối..." onChange={(v) => setRequestForm({ ...requestForm, note: v })} /><button className="tutor-submit full-width">Gửi yêu cầu tìm gia sư</button></form>}

    {tab === 'students' && <section className="tutor-card student-management-card"><div className="section-head"><div><h2>Quản lý học viên</h2><p className="muted">Quản lý thông tin cá nhân của con, lớp học và môn đang học.</p></div><button className="tutor-primary" type="button" onClick={() => openStudentModal('add')}>+ Thêm học viên</button></div><div className="student-grid polished-students">{(profile.students || []).map((student) => { const studentClasses = learningClasses.filter((c) => c.student === student.full_name); return <article className="student-card" key={student.id}><h3>{student.full_name}</h3><p><b>Lớp:</b> {student.grade_level || '-'}</p><p><b>Trường:</b> {student.school_name || '-'}</p><p><b>Số lớp đang học:</b> {studentClasses.length}</p><div className="tag-line compact-tags"><strong>Môn đang học:</strong>{studentClasses.length ? studentClasses.map((c) => <span className="light" key={c.id}>{c.title}</span>) : <span className="light">Chưa có</span>}</div><div className="student-action-row"><button className="outline-btn compact" onClick={() => openStudentModal('view', student)}>Xem</button><button className="outline-btn compact" onClick={() => openStudentModal('edit', student)}>Sửa</button><button className="outline-btn compact danger" onClick={() => deleteStudent(student)}>Xóa</button></div></article>; })}{!(profile.students || []).length && <p className="muted">Chưa có học viên. Hãy thêm học viên để đăng ký tìm gia sư.</p>}</div></section>}

    {tab === 'confirmations' && <section className="tutor-card parent-confirm-section"><h2>Xác nhận gia sư do nhân viên gửi</h2><p className="form-subtitle">Sau khi bạn đồng ý, lớp sẽ chuyển sang trạng thái Đang học. Nếu từ chối, lớp sẽ được mở lại để trung tâm tìm gia sư khác.</p><div className="teaching-grid">{pendingConfirmations.length ? pendingConfirmations.map((item) => <ParentClassCard key={item.id} item={item} onConfirm={confirmTutor} onView={() => setSelectedClass(item)} />) : <p className="muted">Chưa có gia sư nào đang chờ phụ huynh xác nhận.</p>}</div></section>}

    {tab === 'classes' && <section className="tutor-card"><h2>Lớp đang học</h2>{pendingConfirmations.length ? <div className="parent-notice yellow confirmation-reminder"><strong>Có {pendingConfirmations.length} gia sư đang chờ bạn xác nhận</strong><span>Vào mục Xác nhận gia sư để đồng ý hoặc từ chối trước khi lớp bắt đầu học.</span><button className="outline-btn compact" onClick={() => setTab('confirmations')}>Xác nhận ngay</button></div> : null}<div className="teaching-grid">{learningClasses.length ? learningClasses.map((item) => <ParentClassCard key={item.id} item={item} onConfirm={confirmTutor} onView={() => setSelectedClass(item)} />) : <p className="muted">Chưa có lớp học.</p>}</div></section>}
    {tab === 'tutors' && <section className="tutor-card"><h2>Thông tin gia sư</h2><div className="teaching-grid">{tutors.length ? tutors.map((tutor) => <article className="parent-tutor-card" key={`${tutor.id}-${tutor.subject}`}><h3>{tutor.name}</h3><p className="star-line">★ {Number(tutor.rating || 0).toFixed(1)}</p><span className="mini-tag">{tutor.subject}</span><p><b>Trường:</b> {tutor.university}</p><p><b>Kinh nghiệm:</b> {tutor.experience}</p><p><b>Khu vực:</b> {tutor.area}</p><p>♧ {tutor.phone}</p><p>✉ {tutor.email}</p></article>) : <p className="muted">Chưa có gia sư đang dạy.</p>}</div></section>}
    {tab === 'payments' && <><section className="tutor-stat-row income-row"><article className="tutor-stat"><span className="tutor-icon green">$</span><p>Tổng học phí tháng này</p><h3>{money(paymentRows.reduce((s, r) => s + Number(r.amount || 0), 0))}</h3><small>{paymentRows.length} khoản học phí</small></article><article className="tutor-stat"><span className="tutor-icon orange">$</span><p>Chưa thanh toán</p><h3>{money(unpaidTotal)}</h3><small>Cần thanh toán</small></article><article className="tutor-stat"><span className="tutor-icon blue">$</span><p>Đã thanh toán</p><h3>{money(paymentRows.filter((r) => r.status === 'Đã thanh toán').reduce((s, r) => s + Number(r.amount || 0), 0))}</h3><small>Lịch sử thanh toán</small></article></section><section className="tutor-card"><h2>Lịch sử học phí</h2><div className="table-shell"><table className="tutor-table-new"><thead><tr><th>Lớp học</th><th>Tháng</th><th>Số tiền</th><th>Hạn thanh toán</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{paymentRows.map((row) => <tr key={row.id}><td><b>{row.className}</b></td><td>{row.month}</td><td><b>{money(row.amount)}</b></td><td>{row.due}</td><td><StatusBadge tone={row.status === 'Đã thanh toán' ? 'green' : 'yellow'}>{row.status}</StatusBadge></td><td>{row.status !== 'Đã thanh toán' ? <button className="outline-btn compact" onClick={() => pay(row)}>Thanh toán</button> : <span className="muted">Đã thanh toán</span>}</td></tr>)}</tbody></table></div></section></>}
    {tab === 'reviews' && <section className="review-form-list">{learningClasses.filter((item) => item.tutorObj).map((item) => { const current = reviewState[item.id] || { stars: 0, comment: '' }; const old = reviews.find((r) => Number(r.class_id?.id || r.classId) === Number(item.id)); return <article className="tutor-card review-form-card" key={item.id}><h2>{item.tutor}</h2><p>{item.title}</p>{old && <p className="green-text">Đã đánh giá: {'★'.repeat(old.star_rating || old.starRating)} - {old.comment}</p>}<label>Chấm điểm:</label><div className="click-stars">{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} className={star <= current.stars ? 'active' : ''} onClick={() => setReviewState((prev) => ({ ...prev, [item.id]: { ...current, stars: star } }))}>☆</button>)}</div><label>Nhận xét:</label><textarea value={current.comment} onChange={(e) => setReviewState((prev) => ({ ...prev, [item.id]: { ...current, comment: e.target.value } }))} placeholder="Nhập nhận xét của bạn về gia sư..." /><button className="tutor-submit" onClick={() => sendReview(item.id)}>Gửi đánh giá</button></article>; })}</section>}

    {studentModal && <StudentModal mode={studentModal.mode} student={studentForm} setStudent={setStudentForm} onClose={closeStudentModal} onSave={saveStudent} />}
    {selectedClass && <div className="modal-backdrop" onClick={() => setSelectedClass(null)}><section className="modal-card large" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setSelectedClass(null)}>×</button><h2>Chi tiết lớp học</h2><div className="detail-grid"><p><b>Môn học:</b> {selectedClass.title}</p><p><b>Học viên:</b> {selectedClass.student}</p><p><b>Lớp:</b> {selectedClass.grade}</p><p><b>Trường:</b> {selectedClass.school}</p><p><b>Gia sư:</b> {selectedClass.tutor}</p><p><b>Lịch học:</b> {selectedClass.schedule}</p><p><b>Địa chỉ:</b> {selectedClass.location}</p><p><b>Học phí:</b> {money(selectedClass.tuition)}/tháng</p><p><b>Trạng thái:</b> {selectedClass.status}</p><p><b>Yêu cầu:</b> {selectedClass.requirements}</p></div><h3>Thông báo nghỉ / dạy bù</h3>{selectedClass.notifications?.length ? selectedClass.notifications.map((n) => <div className="parent-notice green" key={n.requestId}><strong>{statusVi(n.requestType)} - {statusVi(n.status)}</strong><span>{n.sessionDate}: {n.reason}</span></div>) : <p className="muted">Chưa có thông báo nghỉ/dạy bù.</p>}</section></div>}
  </main>;
}

function TextField({ label, value, onChange, placeholder, disabled = false, type = 'text' }) { return <label className="parent-field"><span>{label}</span><input type={type} value={value || ''} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>; }
function TextArea({ label, value, onChange, placeholder, disabled = false }) { return <label className="parent-field"><span>{label}</span><textarea className="profile-textarea" value={value || ''} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>; }
function FieldSelect({ label, value, onChange, options, placeholder, disabled = false }) { return <label className="parent-field"><span>{label}</span><select value={value || ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}><option value="">{placeholder}</option>{options.map((item) => typeof item === 'string' ? <option value={item} key={item}>{item}</option> : <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>; }
function StudentModal({ mode, student, setStudent, onClose, onSave }) { const readonly = mode === 'view'; const title = mode === 'add' ? 'Thêm học viên' : mode === 'edit' ? 'Cập nhật học viên' : 'Thông tin học viên'; return <div className="modal-backdrop" onClick={onClose}><section className="modal-card large student-modal-card" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><h2>{title}</h2><p className="form-subtitle">Thông tin này được dùng để đăng ký tìm gia sư và theo dõi lớp học của con.</p><div className="profile-grid two"><TextField label="Họ tên học viên" value={student.full_name} disabled={readonly} onChange={(v) => setStudent({ ...student, full_name: v })} placeholder="VD: Nguyễn Văn An" /><FieldSelect label="Lớp" value={student.grade_level} disabled={readonly} onChange={(v) => setStudent({ ...student, grade_level: v })} options={grades} placeholder="Chọn lớp" /><TextField label="Trường học" value={student.school_name} disabled={readonly} onChange={(v) => setStudent({ ...student, school_name: v })} placeholder="VD: THPT Nguyễn Trãi" /><FieldSelect label="Giới tính" value={student.gender} disabled={readonly} onChange={(v) => setStudent({ ...student, gender: v })} options={[{ label: 'Nam', value: 'male' }, { label: 'Nữ', value: 'female' }, { label: 'Khác', value: 'other' }]} placeholder="Chọn giới tính" /><TextField label="Ngày sinh" type="date" value={student.birthday} disabled={readonly} onChange={(v) => setStudent({ ...student, birthday: v })} /><TextArea label="Ghi chú học tập" value={student.note} disabled={readonly} onChange={(v) => setStudent({ ...student, note: v })} placeholder="VD: mất gốc Toán, cần học buổi tối..." /></div>{!readonly && <button className="tutor-submit full-width" onClick={onSave}>{mode === 'add' ? 'Thêm học viên' : 'Lưu thay đổi'}</button>}</section></div>; }
function ParentClassCard({ item, onConfirm, onView }) { const waitingParent = item.rawStatus === 'WAITING_PARENT' || item.status === 'Chờ phụ huynh xác nhận'; return <article className={`teaching-card parent-class-card ${waitingParent ? 'need-confirm' : ''}`}><div className="class-top"><h3>{item.title}</h3><StatusBadge tone={waitingParent ? 'yellow' : 'green'}>{item.status}</StatusBadge></div>{waitingParent ? <div className="confirm-callout"><strong>Nhân viên đã gửi gia sư phù hợp</strong><span>Vui lòng xác nhận để lớp chuyển sang Đang học.</span></div> : null}<p><b>Học viên:</b> {item.student} - {item.grade}</p><p><b>Gia sư:</b> {item.tutor}</p><p><b>Lịch:</b> {item.schedule}</p><p><b>Địa chỉ:</b> {item.location}</p><p className="green-text"><b>Học phí: {money(item.tuition)}/tháng</b></p>{item.notifications?.length ? <p className="muted">Có {item.notifications.length} thông báo nghỉ/dạy bù</p> : null}{waitingParent ? <div className="suggest-actions"><button className="tutor-primary" onClick={() => onConfirm(item, 'APPROVED')}>Đồng ý gia sư</button><button className="tutor-muted-btn" onClick={() => onConfirm(item, 'REJECTED')}>Từ chối</button></div> : <button className="outline-btn" onClick={onView}>Xem chi tiết</button>}</article>; }
export default ParentPortal;
