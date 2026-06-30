'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  buildClassSessions,
  buildMonthlyInvoices,
  buildWeekDays,
  formatDate,
  formatWeekRange,
  mapCustomerClass,
  money,
  parseScheduleSlots,
  startOfWeek,
  timeFromMinutes,
} from './customerClassUtils';
import './TutorPortal.css';

const tabLabels = {
  info: 'Thông tin khóa học',
  invoices: 'Hóa đơn theo tháng',
  review: 'Đánh giá gia sư',
};

function statusVi(status) {
  return ({ unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán', active: 'Đang học', completed: 'Hoàn thành', overdue: 'Quá hạn', STAFF_PENDING: 'Chờ nhân viên xử lý', PENDING_ADMIN: 'Chờ admin duyệt', OPEN: 'Đang tìm gia sư', WAITING_PARENT: 'Chờ phụ huynh xác nhận', WAITING_TUTOR: 'Chờ gia sư xác nhận', ASSIGNED: 'Đang học', TEACHING: 'Đang học', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', APPROVED: 'Đã duyệt', PENDING: 'Chờ duyệt', REJECTED: 'Từ chối' }[status] || status || 'Đang học');
}

function paymentRowsFromApi(payments) {
  return payments.map((p) => ({
    id: p.id,
    classId: p.enrollment_id?.class_id?.id,
    className: p.enrollment_id?.class_id?.subject_name || 'Lớp học',
    month: p.created_at?.slice(0, 7) || 'Tháng này',
    amount: p.amount,
    due: p.created_at?.slice(0, 10) || '-',
    status: p.status === 'success' ? 'Đã thanh toán' : 'Chưa thanh toán',
  }));
}

function CustomerClassDetail({ classId }) {
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [qrModal, setQrModal] = useState(null);
  const [reviewState, setReviewState] = useState({ stars: 0, comment: '' });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [classRes, paymentRes, reviewRes] = await Promise.all([
        axios.get('/v1/customer/classes'),
        axios.get('/v1/customer/payments'),
        axios.get('/v1/customer/reviews'),
      ]);
      setClasses(classRes.data.data || []);
      setPayments(paymentRes.data.data || []);
      setReviews(reviewRes.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không tải được chi tiết lớp học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const selectedClass = useMemo(() => {
    const found = classes.find((item) => String(item.classId) === String(classId));
    return found ? { ...mapCustomerClass(found), status: statusVi(found.status) } : null;
  }, [classes, classId]);

  const paymentRows = useMemo(() => paymentRowsFromApi(payments), [payments]);
  const invoices = useMemo(() => selectedClass ? buildMonthlyInvoices(selectedClass, paymentRows) : [], [selectedClass, paymentRows]);
  const review = useMemo(() => reviews.find((item) => String(item.classId || item.class_id) === String(classId)), [reviews, classId]);
  const scheduleSlots = useMemo(() => parseScheduleSlots({ schedule: selectedClass?.scheduleSlots, scheduleDetail: selectedClass?.scheduleDetail }), [selectedClass]);
  const classSessions = useMemo(() => selectedClass ? buildClassSessions(selectedClass, scheduleSlots) : [], [selectedClass, scheduleSlots]);
  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);

  const openQrPayment = (row) => setQrModal({ ...row, qrSeed: Math.random().toString(36).slice(2, 10) });
  const confirmQrPayment = async () => {
    if (!qrModal) return;
    try {
      await axios.post(`/v1/customer/payments/${qrModal.id}/pay`);
      toast.success('Đã ghi nhận thanh toán học phí');
      setQrModal(null);
      loadAll();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thanh toán được.');
    }
  };

  const sendReview = async () => {
    if (!reviewState.stars) {
      toast.warning('Vui lòng chọn số sao đánh giá.');
      return;
    }
    try {
      await axios.post(`/v1/customer/classes/${classId}/reviews`, {
        starRating: reviewState.stars,
        comment: reviewState.comment,
      });
      toast.success('Đã gửi đánh giá cho gia sư!');
      setReviewState({ stars: 0, comment: '' });
      loadAll();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không gửi được đánh giá.');
    }
  };

  if (loading) return <main className="tutor-figma-page parent-figma-page"><p>Đang tải chi tiết lớp học...</p></main>;

  if (!selectedClass) {
    return <main className="tutor-figma-page parent-figma-page"><Link className="outline-btn compact" href="/customer?tab=classes">← Quay lại</Link><section className="tutor-card"><h2>Không tìm thấy lớp học</h2><p className="muted">Lớp học không tồn tại hoặc bạn không có quyền xem.</p></section></main>;
  }

  return <main className="tutor-figma-page parent-figma-page customer-class-detail-page">
    <Link className="outline-btn compact" href="/customer?tab=classes">← Quay lại lớp đang học</Link>
    <div className="class-detail-header tutor-card">
      <div>
        <p className="muted">Chi tiết khóa học</p>
        <h1>{selectedClass.title}</h1>
        <p>{selectedClass.student} - {selectedClass.grade}</p>
      </div>
      <span className="tutor-badge green">{selectedClass.status}</span>
    </div>

    <div className="suggest-actions wrap detail-tab-row">
      {Object.entries(tabLabels).map(([key, label]) => <button key={key} type="button" className={activeTab === key ? 'tutor-primary compact' : 'outline-btn compact'} onClick={() => setActiveTab(key)}>{label}</button>)}
    </div>

    {activeTab === 'info' && <InfoTab selectedClass={selectedClass} weekStart={weekStart} setWeekStart={setWeekStart} weekDays={weekDays} classSessions={classSessions} />}
    {activeTab === 'invoices' && <InvoicesTab invoices={invoices} openQrPayment={openQrPayment} />}
    {activeTab === 'review' && <ReviewTab review={review} reviewState={reviewState} setReviewState={setReviewState} sendReview={sendReview} />}

    {qrModal && <QrPaymentModal qrModal={qrModal} onClose={() => setQrModal(null)} onConfirm={confirmQrPayment} />}
  </main>;
}

function InfoTab({ selectedClass, weekStart, setWeekStart, weekDays, classSessions }) {
  return <>
    <section className="tutor-card">
      <h2>Thông tin khóa học</h2>
      <div className="profile-grid two">
        <InfoField label="Học viên" value={`${selectedClass.student} - ${selectedClass.grade}`} />
        <InfoField label="Trường" value={selectedClass.school} />
        <InfoField label="Gia sư" value={selectedClass.tutor} />
        <InfoField label="Hình thức" value={selectedClass.teachingMode === 'online' ? 'Online' : selectedClass.teachingMode === 'offline' ? 'Offline' : '-'} />
        <InfoField label="Ngày bắt đầu" value={selectedClass.startDate ? formatDate(selectedClass.startDate) : '-'} />
        <InfoField label="Lịch học" value={selectedClass.schedule} />
        <InfoField label="Số buổi/tuần" value={`${selectedClass.sessionsPerWeek || 0} buổi`} />
        <InfoField label="Tổng số buổi" value={selectedClass.totalSessions ? `${selectedClass.totalSessions} buổi` : 'Chưa cập nhật'} />
        <InfoField label="Học phí tháng" value={money(selectedClass.tuition)} highlight />
        <InfoField label="Địa điểm" value={selectedClass.location} />
      </div>
      <div className="parent-field full-field"><span>Yêu cầu học tập</span><strong>{selectedClass.requirements}</strong></div>
    </section>

    <section className="tutor-card timetable-detail-card">
      <div className="section-head">
        <div>
          <h2>Thời khóa biểu theo tuần</h2>
          <p className="muted">Tuần {formatWeekRange(weekStart)}</p>
        </div>
        <div className="suggest-actions wrap">
          <button className="outline-btn compact" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7))}>Tuần trước</button>
          <button className="outline-btn compact" onClick={() => setWeekStart(startOfWeek(new Date()))}>Tuần này</button>
          <button className="outline-btn compact" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7))}>Tuần sau</button>
        </div>
      </div>
      <WeeklyTimetable weekDays={weekDays} classSessions={classSessions} classTitle={selectedClass.title} />
    </section>
  </>;
}

function WeeklyTimetable({ weekDays, classSessions, classTitle }) {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);
  return <div className="table-shell weekly-calendar-shell">
    <div className="timetable-grid weekly-calendar-grid class-detail-weekly-grid" style={{ gridTemplateColumns: `84px repeat(${weekDays.length}, minmax(130px, 1fr))`, gridTemplateRows: `auto repeat(${hours.length}, minmax(42px, 1fr))` }}>
      <div className="timetable-header-cell corner" style={{ gridColumn: 1, gridRow: 1 }} />
      {weekDays.map((day, dayIndex) => <div key={day.code} className="timetable-header-cell day-header" style={{ gridColumn: dayIndex + 2, gridRow: 1 }}><strong>{day.label}</strong><span>{day.dateLabel}</span></div>)}
      {hours.map((hour, hourIndex) => <div key={`h-${hour}`} className="timetable-hour-cell" style={{ gridColumn: 1, gridRow: hourIndex + 2 }}>{String(hour).padStart(2, '0')}:00</div>)}
      {weekDays.flatMap((day, dayIndex) => hours.flatMap((hour, hourIndex) => {
        const currentStart = hour * 60;
        const currentEnd = (hour + 1) * 60;
        const startedSessions = classSessions.filter((item) => item.dateKey === day.dateKey && item.start >= currentStart && item.start < currentEnd);
        const coveredByPrevious = classSessions.some((item) => item.dateKey === day.dateKey && item.start < currentStart && item.end > currentStart);
        if (!startedSessions.length) {
          if (coveredByPrevious) return [];
          return <div key={`${day.code}-${hour}`} className="timetable-cell state-empty" style={{ gridColumn: dayIndex + 2, gridRow: hourIndex + 2 }} />;
        }
        return startedSessions.map((session) => {
          const rowStart = Math.max(0, Math.floor((session.start - 7 * 60) / 60));
          const rowEnd = Math.min(hours.length, Math.ceil((session.end - 7 * 60) / 60));
          const rowSpan = Math.max(1, rowEnd - rowStart);
          return <div key={`${day.code}-${session.sessionNumber}`} className="timetable-cell state-class weekly-class-cell merged-class-cell" style={{ gridColumn: dayIndex + 2, gridRow: `${rowStart + 2} / span ${rowSpan}` }}>
            <div className="cell-class-label"><strong>{classTitle}</strong><small>Buổi {session.sessionNumber}: {timeFromMinutes(session.start)}-{timeFromMinutes(session.end)}</small></div>
          </div>;
        });
      }))}
    </div>
  </div>;
}


function InvoicesTab({ invoices, openQrPayment }) {
  return <section className="tutor-card">
    <h2>Hóa đơn theo tháng cần thanh toán</h2>
    <div className="table-shell"><table className="tutor-table-new"><thead><tr><th>Tháng</th><th>Số buổi</th><th>Hạn thanh toán</th><th>Số tiền</th><th>Trạng thái</th><th></th></tr></thead><tbody>{invoices.map((row, idx) => <tr key={`${row.month}-${idx}`}><td>{row.month}</td><td>{row.sessions} buổi</td><td>{row.due}</td><td>{money(row.amount)}</td><td>{row.status}</td><td>{row.status === 'Đã thanh toán' ? <span className="green-text">Đã xong</span> : row.payable ? <button className="outline-btn compact" onClick={() => openQrPayment(row)}>Thanh toán</button> : <span className="muted">Chưa mở</span>}</td></tr>)}</tbody></table></div>
  </section>;
}

function ReviewTab({ review, reviewState, setReviewState, sendReview }) {
  const stars = Number(review?.starRating || review?.star_rating || 0);
  if (review) {
    return <section className="tutor-card"><h2>Đánh giá đã gửi</h2><p className="review-stars">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</p><p>{review.comment || '-'}</p></section>;
  }

  return <section className="tutor-card">
    <h2>Đánh giá gia sư</h2>
    <div className="suggest-actions wrap">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" className={reviewState.stars >= star ? 'tutor-primary compact' : 'outline-btn compact'} onClick={() => setReviewState({ ...reviewState, stars: star })}>★</button>)}</div>
    <label className="parent-field"><span>Nhận xét</span><textarea className="profile-textarea" value={reviewState.comment || ''} placeholder="Nhập đánh giá sau khi học..." onChange={(e) => setReviewState({ ...reviewState, comment: e.target.value })} /></label>
    <button className="tutor-submit full-width" onClick={sendReview}>Gửi đánh giá</button>
  </section>;
}

function QrPaymentModal({ qrModal, onClose, onConfirm }) {
  const paymentCode = `HP-${String(qrModal.id || qrModal.qrSeed).toUpperCase()}-${String(qrModal.month || '').replace(/\s+/g, '')}`;

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="modal-card qr-payment-modal" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose}>×</button>
      <div className="qr-payment-head">
        <span>Hóa đơn học phí</span>
        <h2>Thanh toán học phí</h2>
        <p>Quét mã QR bằng ứng dụng ngân hàng, sau đó xác nhận để trung tâm ghi nhận thanh toán.</p>
      </div>
      <div className="qr-payment-content">
        <div className="qr-code-panel">
          <div className="qr-code-box" aria-label="Mã QR thanh toán học phí">
            <span className="qr-scan-corner top-left" />
            <span className="qr-scan-corner top-right" />
            <span className="qr-scan-corner bottom-left" />
            <span className="qr-scan-corner bottom-right" />
            <svg className="qr-code-svg" viewBox="0 0 200 200" width="200" height="200">
              {Array.from({ length: 400 }, (_, index) => {
                const x = index % 20;
                const y = Math.floor(index / 20);
                const seed = qrModal.qrSeed;
                const hash = ((x * 31 + y * 17 + seed.charCodeAt((x + y) % seed.length)) * 7) % 100;
                return ((x < 3 && y < 3) || (x > 16 && y < 3) || (x < 3 && y > 16) || hash < 40) ? <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width="10" height="10" rx="1.5" fill="#0f172a" /> : null;
              })}
            </svg>
          </div>
          <p className="qr-code-caption">Mã QR thanh toán</p>
          <strong>{paymentCode}</strong>
        </div>
        <div className="qr-payment-summary">
          <div className="qr-amount-card">
            <span>Số tiền cần thanh toán</span>
            <strong>{money(qrModal.amount)}</strong>
          </div>
          <div className="qr-info-list">
            <div className="qr-info-row"><span>Lớp học</span><strong>{qrModal.className}</strong></div>
            <div className="qr-info-row"><span>Tháng</span><strong>{qrModal.month}</strong></div>
            <div className="qr-info-row"><span>Nội dung chuyển khoản</span><strong>{paymentCode}</strong></div>
          </div>
          <div className="qr-payment-note">
            <strong>Lưu ý</strong>
            <span>Vui lòng giữ nguyên nội dung chuyển khoản để hệ thống đối soát nhanh hơn.</span>
          </div>
          <div className="qr-payment-actions">
            <button className="tutor-submit full-width" onClick={onConfirm}>Xác nhận đã thanh toán</button>
            <button className="outline-btn full-width" onClick={onClose}>Đóng</button>
          </div>
        </div>
      </div>
    </section>
  </div>;
}

function InfoField({ label, value, highlight = false }) {
  return <div className="parent-field"><span>{label}</span><strong className={highlight ? 'green-text' : ''}>{value || '-'}</strong></div>;
}

export default CustomerClassDetail;
