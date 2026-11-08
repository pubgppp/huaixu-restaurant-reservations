import { randomUUID } from 'node:crypto';

export const TIMES = ['11:30', '12:00', '12:30', '13:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'];
export const DAILY_LAMB_LIMIT = 10;
export const SLOT_SEAT_LIMIT = 20;

export class BookingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateRange(now = new Date()) {
  const last = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
  return { min: localDate(now), max: localDate(last) };
}

export function isBookableDate(value, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (localDate(parsed) !== value) return false;
  const { min, max } = dateRange(now);
  return value >= min && value <= max;
}

export function availability(date, bookings, now = new Date()) {
  if (!isBookableDate(date, now)) throw new BookingError('请选择未来 30 天内的有效日期。');
  const dayBookings = bookings.filter((item) => item.date === date && item.status !== 'cancelled');
  const lambRemaining = Math.max(0, DAILY_LAMB_LIMIT - dayBookings.reduce((sum, item) => sum + item.lambQty, 0));
  const slots = Object.fromEntries(TIMES.map((time) => {
    const used = dayBookings.filter((item) => item.time === time).reduce((sum, item) => sum + item.partySize, 0);
    const hasPassed = `${date}T${time}:00` <= `${localDate(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    return [time, hasPassed ? 0 : Math.max(0, SLOT_SEAT_LIMIT - used)];
  }));
  return { date, lambRemaining, slots };
}

export function createBooking(input, bookings, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BookingError('请填写预约信息。');
  const { date, time } = input;
  if (!isBookableDate(date, now)) throw new BookingError('请选择未来 30 天内的有效日期。');
  if (!TIMES.includes(time)) throw new BookingError('请选择有效的到店时间。');

  const partySize = Number(input.partySize);
  const lambQty = Number(input.lambQty);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 8) throw new BookingError('每次预约人数须为 1 至 8 人。');
  if (!Number.isInteger(lambQty) || lambQty < 0 || lambQty > Math.min(4, partySize)) throw new BookingError('羊排预留数量须为 0 至 4 份，且不能超过用餐人数。');

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (!name || name.length > 40) throw new BookingError('请填写 40 字以内的称呼。');
  if (!/^\+?[\d\s()\-]{8,24}$/.test(phone) || (phone.match(/\d/g) || []).length < 7) throw new BookingError('请填写有效的联系电话。');
  if (note.length > 120) throw new BookingError('备注不能超过 120 字。');

  const stock = availability(date, bookings, now);
  if (stock.slots[time] < partySize) throw new BookingError('该时段剩余座位不足，请选择其他时间或减少人数。', 409);
  if (stock.lambRemaining < lambQty) throw new BookingError('当日手抓羊排余量不足，请调整份数。', 409);

  return {
    id: randomUUID(),
    code: `HX-${date.replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
    date, time, partySize, lambQty, name, phone, note,
    status: 'confirmed',
    createdAt: now.toISOString()
  };
}

export function findBooking(input, bookings) {
  const code = typeof input?.code === 'string' ? input.code.trim().toUpperCase() : '';
  const phone = typeof input?.phone === 'string' ? input.phone.replace(/\D/g, '') : '';
  if (!/^HX-\d{8}-[A-F0-9]{6,16}$/.test(code) || phone.length < 7) {
    throw new BookingError('预约编号或联系电话不正确。', 404);
  }
  const booking = bookings.find((item) => item.code === code && item.phone.replace(/\D/g, '') === phone);
  if (!booking) throw new BookingError('预约编号或联系电话不正确。', 404);
  return booking;
}

export function canCancelBooking(booking, now = new Date()) {
  if (booking.status && booking.status !== 'confirmed') return false;
  const today = localDate(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return booking.date > today || (booking.date === today && booking.time > currentTime);
}

export function listBookingsForDate(date, bookings) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BookingError('请选择有效的查询日期。');
  }
  const [year, month, day] = date.split('-').map(Number);
  if (localDate(new Date(year, month - 1, day)) !== date) {
    throw new BookingError('请选择有效的查询日期。');
  }
  return bookings.filter((item) => item.date === date).sort((a, b) => a.time.localeCompare(b.time));
}

export function markArrived(code, bookings, now = new Date()) {
  const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
  const booking = bookings.find((item) => item.code === normalized);
  if (!booking) throw new BookingError('没有找到这笔预约。', 404);
  if (booking.status === 'cancelled') throw new BookingError('已取消的预约不能标记到店。', 409);
  if (booking.status === 'arrived') throw new BookingError('这笔预约已标记到店。', 409);
  if (booking.date !== localDate(now)) throw new BookingError('只能标记今天的预约到店。', 409);
  const arrived = { ...booking, status: 'arrived', arrivedAt: now.toISOString() };
  return {
    booking: arrived,
    bookings: bookings.map((item) => item.id === booking.id ? arrived : item)
  };
}

export function cancelBooking(input, bookings, now = new Date()) {
  const booking = findBooking(input, bookings);
  if (booking.status === 'cancelled') throw new BookingError('这笔预约已经取消。', 409);
  if (!canCancelBooking(booking, now)) throw new BookingError('到店时间已到，无法在线取消。', 409);
  const cancelled = { ...booking, status: 'cancelled', cancelledAt: now.toISOString() };
  return {
    booking: cancelled,
    bookings: bookings.map((item) => item.id === booking.id ? cancelled : item)
  };
}
