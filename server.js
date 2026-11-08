import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { availability, BookingError, canCancelBooking, cancelBooking, createBooking, dateRange, findBooking, listBookingsForDate, markArrived, DAILY_LAMB_LIMIT, RESTAURANT_TIME_ZONE, TIMES, SLOT_SEAT_LIMIT } from './booking.js';
import { isStaffAuthorized, isStaffKeyConfigured } from './staff-auth.js';
import { createRateLimiter } from './rate-limit.js';
import { readBookings, saveBookings } from './storage.js';
import { readJson, securityHeaders } from './http-utils.js';

const root = dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.DATA_FILE || join(root, 'data', 'reservations.json');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const staffKey = process.env.STAFF_KEY;
const customerLookupLimit = createRateLimiter({ maxAttempts: 10, windowMs: 10 * 60 * 1000 });
const reservationLimit = createRateLimiter({ maxAttempts: 20, windowMs: 10 * 60 * 1000 });

function json(res, status, body) {
  res.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function publicBooking(booking) {
  return {
    code: booking.code,
    date: booking.date,
    time: booking.time,
    partySize: booking.partySize,
    lambQty: booking.lambQty,
    status: booking.status || 'confirmed',
    canCancel: canCancelBooking(booking)
  };
}

function requireStaff(req) {
  if (!isStaffKeyConfigured(staffKey)) throw new BookingError('店员后台尚未配置。', 503);
  if (!isStaffAuthorized(staffKey, req.headers['x-staff-key'])) throw new BookingError('店员密钥不正确。', 401);
}

function requireRateLimit(req, limiter) {
  if (!limiter.consume(req.socket.remoteAddress || 'unknown')) {
    throw new BookingError('操作过于频繁，请稍后再试。', 429);
  }
}

const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/staff', ['staff.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/staff.js', ['staff.js', 'text/javascript; charset=utf-8']],
  ['/staff.css', ['staff.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]
]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/api/health') {
      readBookings(dataFile);
      return json(res, 200, { status: 'ok', timeZone: RESTAURANT_TIME_ZONE });
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return json(res, 200, { ...dateRange(), times: TIMES, dailyLambLimit: DAILY_LAMB_LIMIT, slotSeatLimit: SLOT_SEAT_LIMIT, timeZone: RESTAURANT_TIME_ZONE });
    }
    if (req.method === 'GET' && url.pathname === '/api/availability') {
      return json(res, 200, availability(url.searchParams.get('date'), readBookings(dataFile)));
    }
    if (req.method === 'POST' && url.pathname === '/api/reservations') {
      requireRateLimit(req, reservationLimit);
      const input = await readJson(req);
      // The check and write run synchronously in one event loop turn, so simultaneous
      // requests handled by this server cannot spend the same remaining stock.
      const bookings = readBookings(dataFile);
      const booking = createBooking(input, bookings);
      saveBookings(dataFile, [...bookings, booking]);
      return json(res, 201, { code: booking.code, date: booking.date, time: booking.time, partySize: booking.partySize, lambQty: booking.lambQty });
    }
    if (req.method === 'POST' && url.pathname === '/api/reservations/lookup') {
      requireRateLimit(req, customerLookupLimit);
      const input = await readJson(req);
      return json(res, 200, publicBooking(findBooking(input, readBookings(dataFile))));
    }
    if (req.method === 'POST' && url.pathname === '/api/reservations/cancel') {
      requireRateLimit(req, customerLookupLimit);
      const input = await readJson(req);
      const result = cancelBooking(input, readBookings(dataFile));
      saveBookings(dataFile, result.bookings);
      return json(res, 200, publicBooking(result.booking));
    }
    if (req.method === 'GET' && url.pathname === '/api/staff/bookings') {
      requireStaff(req);
      return json(res, 200, { bookings: listBookingsForDate(url.searchParams.get('date'), readBookings(dataFile)) });
    }
    if (req.method === 'POST' && url.pathname === '/api/staff/arrive') {
      requireStaff(req);
      const input = await readJson(req);
      const result = markArrived(input?.code, readBookings(dataFile));
      saveBookings(dataFile, result.bookings);
      return json(res, 200, { booking: result.booking });
    }
    if (req.method === 'GET' && staticFiles.has(url.pathname)) {
      const [filename, contentType] = staticFiles.get(url.pathname);
      res.writeHead(200, { ...securityHeaders, 'Content-Type': contentType });
      return res.end(readFileSync(join(root, 'public', filename)));
    }
    return json(res, 404, { error: '页面不存在。' });
  } catch (error) {
    if (error instanceof BookingError) return json(res, error.status, { error: error.message });
    console.error(error);
    return json(res, 500, { error: '服务暂时不可用，请稍后再试。' });
  }
});

server.listen(port, host, () => console.log(`槐序小馆运行中：http://${host}:${server.address().port}`));
