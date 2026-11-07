import test from 'node:test';
import assert from 'node:assert/strict';
import { availability, canCancelBooking, cancelBooking, createBooking, dateRange, findBooking, isBookableDate, BookingError } from '../booking.js';

const now = new Date(2026, 10, 5, 9, 0);
const bookingInput = { date: '2026-11-06', time: '18:00', partySize: 2, lambQty: 1, name: '李女士', phone: '138 0011 2233', note: '' };

test('date range is 30 calendar days and rejects impossible dates', () => {
  assert.deepEqual(dateRange(now), { min: '2026-11-05', max: '2026-12-05' });
  assert.equal(isBookableDate('2026-11-31', now), false);
  assert.equal(isBookableDate('2026-12-06', now), false);
});

test('daily lamb stock is shared across meal times', () => {
  const bookings = [
    createBooking({ ...bookingInput, time: '12:00', partySize: 4, lambQty: 4 }, [], now),
    createBooking({ ...bookingInput, time: '18:00', partySize: 4, lambQty: 4 }, [], now)
  ];
  assert.equal(availability('2026-11-06', bookings, now).lambRemaining, 2);
  assert.throws(() => createBooking({ ...bookingInput, lambQty: 3, partySize: 3 }, bookings, now), (error) => error instanceof BookingError && error.status === 409);
  const last = createBooking({ ...bookingInput, lambQty: 2 }, bookings, now);
  assert.equal(availability('2026-11-06', [...bookings, last], now).lambRemaining, 0);
});

test('seat capacity applies to each time slot', () => {
  const bookings = Array.from({ length: 3 }, () => createBooking({ ...bookingInput, partySize: 6, lambQty: 0 }, [], now));
  assert.equal(availability('2026-11-06', bookings, now).slots['18:00'], 2);
  assert.throws(() => createBooking({ ...bookingInput, partySize: 3, lambQty: 0 }, bookings, now), (error) => error instanceof BookingError && error.status === 409);
  assert.equal(availability('2026-11-06', bookings, now).slots['12:00'], 20);
});

test('rejects invalid contact details and past times', () => {
  assert.throws(() => createBooking({ ...bookingInput, phone: 'abc' }, [], now), BookingError);
  assert.throws(() => createBooking({ ...bookingInput, date: '2026-11-05', time: '11:30' }, [], new Date(2026, 10, 5, 12, 0)), BookingError);
});

test('lookup requires both booking code and matching phone', () => {
  const booking = createBooking(bookingInput, [], now);
  assert.equal(findBooking({ code: booking.code.toLowerCase(), phone: '13800112233' }, [booking]).id, booking.id);
  assert.throws(() => findBooking({ code: booking.code, phone: '13900112233' }, [booking]), (error) => error.status === 404);
});

test('cancellation releases both seats and daily lamb stock', () => {
  const booking = createBooking(bookingInput, [], now);
  const before = availability(booking.date, [booking], now);
  assert.equal(before.slots['18:00'], 18);
  assert.equal(before.lambRemaining, 9);
  const result = cancelBooking({ code: booking.code, phone: booking.phone }, [booking], now);
  assert.equal(result.booking.status, 'cancelled');
  const after = availability(booking.date, result.bookings, now);
  assert.equal(after.slots['18:00'], 20);
  assert.equal(after.lambRemaining, 10);
  assert.throws(() => cancelBooking({ code: booking.code, phone: booking.phone }, result.bookings, now), (error) => error.status === 409);
});

test('cannot cancel after dining time begins', () => {
  const booking = createBooking(bookingInput, [], now);
  assert.equal(canCancelBooking(booking, new Date(2026, 10, 6, 17, 59)), true);
  assert.equal(canCancelBooking(booking, new Date(2026, 10, 6, 18, 0)), false);
  assert.throws(() => cancelBooking({ code: booking.code, phone: booking.phone }, [booking], new Date(2026, 10, 6, 18, 0)), (error) => error.status === 409);
});
