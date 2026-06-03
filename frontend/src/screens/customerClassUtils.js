export const WEEK_DAYS = [
  { code: 'MONDAY', label: 'Thứ 2', index: 1 },
  { code: 'TUESDAY', label: 'Thứ 3', index: 2 },
  { code: 'WEDNESDAY', label: 'Thứ 4', index: 3 },
  { code: 'THURSDAY', label: 'Thứ 5', index: 4 },
  { code: 'FRIDAY', label: 'Thứ 6', index: 5 },
  { code: 'SATURDAY', label: 'Thứ 7', index: 6 },
  { code: 'SUNDAY', label: 'Chủ nhật', index: 0 },
];

const DAY_CODE_BY_LABEL = {
  'Thứ 2': 'MONDAY',
  'Thứ 3': 'TUESDAY',
  'Thứ 4': 'WEDNESDAY',
  'Thứ 5': 'THURSDAY',
  'Thứ 6': 'FRIDAY',
  'Thứ 7': 'SATURDAY',
  'Chủ nhật': 'SUNDAY',
  Monday: 'MONDAY',
  Tuesday: 'TUESDAY',
  Wednesday: 'WEDNESDAY',
  Thursday: 'THURSDAY',
  Friday: 'FRIDAY',
  Saturday: 'SATURDAY',
  Sunday: 'SUNDAY',
};

export const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

export function minutesFromTime(value) {
  const [hour = '0', minute = '0'] = String(value || '').split(':');
  const h = Number(hour);
  const m = Number(minute);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

export function timeFromMinutes(total) {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function dayLabelToCode(label) {
  return DAY_CODE_BY_LABEL[label] || null;
}

export function mergeScheduleSlots(schedule) {
  if (!schedule || !schedule.length) return '';
  const byDay = {};
  schedule.forEach((x) => {
    const day = x.dayLabel || x.dayOfWeek || '';
    const start = minutesFromTime(x.startTime);
    const end = minutesFromTime(x.endTime);
    if (!day || start === null || end === null || end <= start) return;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({ start, end });
  });
  const result = [];
  Object.keys(byDay).forEach((day) => {
    const ranges = byDay[day].sort((a, b) => a.start - b.start);
    if (!ranges.length) return;
    let current = { ...ranges[0] };
    for (let i = 1; i < ranges.length; i += 1) {
      if (ranges[i].start <= current.end) current.end = Math.max(current.end, ranges[i].end);
      else {
        result.push(`${day} ${timeFromMinutes(current.start)}-${timeFromMinutes(current.end)}`);
        current = { ...ranges[i] };
      }
    }
    result.push(`${day} ${timeFromMinutes(current.start)}-${timeFromMinutes(current.end)}`);
  });
  return result.join(', ');
}

export function scheduleText(cls) {
  return mergeScheduleSlots(cls?.schedule) || cls?.scheduleDetail || '-';
}

export function monthLabel(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'Tháng này';
  return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
}

export function addMonths(date, count) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return next;
}

export function buildMonthlyInvoices(cls, paymentRows) {
  const classPayments = paymentRows.filter((row) => row.classId === cls.id);
  const totalSessions = Number(cls.totalSessions || 0);
  const sessionsPerWeek = Math.max(Number(cls.sessionsPerWeek || 1), 1);
  const monthlySessions = Math.max(sessionsPerWeek * 4, 1);
  const totalMonths = Math.max(Math.ceil((totalSessions || monthlySessions) / monthlySessions), classPayments.length || 1);
  const start = cls.startDate ? new Date(cls.startDate) : new Date();
  const baseAmount = Number(cls.tuition || classPayments[0]?.amount || 0);
  const rows = [];
  let remaining = totalSessions || totalMonths * monthlySessions;
  for (let i = 0; i < totalMonths; i += 1) {
    const payment = classPayments[i];
    const sessions = Math.min(monthlySessions, Math.max(remaining, 0)) || monthlySessions;
    const amount = payment?.amount || Math.round((baseAmount / monthlySessions) * sessions);
    const dueDate = addMonths(Number.isNaN(start.getTime()) ? new Date() : start, i);
    rows.push({
      id: payment?.id,
      classId: cls.id,
      className: cls.title,
      month: payment?.month ? monthLabel(`${payment.month}-01`) : monthLabel(dueDate),
      sessions,
      amount,
      due: payment?.due || dueDate.toISOString().slice(0, 10),
      status: payment?.status || (i === 0 ? 'Chưa thanh toán' : 'Chưa đến hạn'),
      payable: Boolean(payment?.id),
    });
    remaining -= sessions;
  }
  return rows;
}

export function parseLocalDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(value);
}

export function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function startOfWeek(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + diff);
  return next;
}

export function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function formatDate(value) {
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN');
}

export function formatWeekRange(weekStart) {
  return `${formatDate(weekStart)} - ${formatDate(addDays(weekStart, 6))}`;
}

export function parseScheduleSlots(cls) {
  if (cls?.schedule?.length) {
    return cls.schedule.map((item) => ({
      dayCode: item.dayOfWeek || dayLabelToCode(item.dayLabel),
      dayLabel: item.dayLabel || WEEK_DAYS.find((day) => day.code === item.dayOfWeek)?.label || item.dayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime,
      start: minutesFromTime(item.startTime),
      end: minutesFromTime(item.endTime),
    })).filter((item) => item.dayCode && item.start !== null && item.end !== null && item.end > item.start);
  }

  return String(cls?.scheduleDetail || '').split(',').map((raw) => {
    const text = raw.trim();
    const match = text.match(/^(Thứ 2|Thứ 3|Thứ 4|Thứ 5|Thứ 6|Thứ 7|Chủ nhật)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/i);
    if (!match) return null;
    const [, dayLabel, startTime, endTime] = match;
    const start = minutesFromTime(startTime);
    const end = minutesFromTime(endTime);
    return { dayCode: dayLabelToCode(dayLabel), dayLabel, startTime, endTime, start, end };
  }).filter(Boolean);
}

export function buildWeekDays(weekStart) {
  return WEEK_DAYS.map((day, index) => ({
    ...day,
    date: addDays(weekStart, index),
    dateLabel: formatDate(addDays(weekStart, index)),
    dateKey: localDateKey(addDays(weekStart, index)),
  }));
}

export function buildClassSessions(cls, scheduleSlots) {
  const totalSessions = Number(cls?.totalSessions || 0);
  if (!cls?.startDate || !totalSessions || !scheduleSlots.length) return [];

  const startDate = parseLocalDate(cls.startDate);
  if (Number.isNaN(startDate.getTime())) return [];

  const sessions = [];
  const slotsByDay = scheduleSlots.reduce((acc, slot) => {
    if (!acc[slot.dayCode]) acc[slot.dayCode] = [];
    acc[slot.dayCode].push(slot);
    return acc;
  }, {});
  Object.values(slotsByDay).forEach((slots) => slots.sort((a, b) => a.start - b.start));

  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const maxDays = Math.max(totalSessions * 14, 365);

  for (let dayOffset = 0; sessions.length < totalSessions && dayOffset < maxDays; dayOffset += 1) {
    const day = WEEK_DAYS.find((item) => item.index === current.getDay());
    const daySlots = day ? slotsByDay[day.code] || [] : [];
    daySlots.forEach((slot) => {
      if (sessions.length < totalSessions) {
        sessions.push({
          ...slot,
          date: new Date(current),
          dateKey: localDateKey(current),
          sessionNumber: sessions.length + 1,
        });
      }
    });
    current.setDate(current.getDate() + 1);
  }

  return sessions;
}

export function mapCustomerClass(c) {
  return {
    id: c.classId,
    enrollmentId: c.enrollmentId,
    title: c.subject,
    student: c.student?.full_name || c.student?.fullName || '-',
    grade: c.student?.grade_level || c.student?.gradeLevel || '-',
    school: c.student?.school_name || c.student?.schoolName || '-',
    tutor: c.tutor?.fullName || 'Chưa phân công',
    schedule: scheduleText(c),
    scheduleSlots: c.schedule || [],
    scheduleDetail: c.scheduleDetail || '',
    tuition: c.salaryPerMonth || c.tuitionFee || 0,
    rawStatus: c.status,
    tutorObj: c.tutor,
    location: c.location || '-',
    requirements: c.requirements || '-',
    notifications: c.absenceRequests || [],
    confirmedTeachingLogs: c.confirmedTeachingLogs || [],
    sessionsPerWeek: c.sessionsPerWeek || 1,
    totalSessions: c.totalSessions || 0,
    startDate: c.startDate || c.start_date || '',
    teachingMode: c.teachingMode || c.teaching_mode || '',
  };
}
