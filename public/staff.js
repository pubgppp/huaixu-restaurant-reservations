const form = document.querySelector('#staff-form');
const keyInput = document.querySelector('#staff-key');
const dateInput = document.querySelector('#staff-date');
const loadButton = document.querySelector('#staff-load');
const message = document.querySelector('#staff-message');
const results = document.querySelector('#staff-results');
const list = document.querySelector('#staff-list');
const empty = document.querySelector('#staff-empty');
let staffKey = '';
let restaurantToday = '';

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
  if (text) message.focus();
}

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'X-Staff-Key': staffKey, ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || '请求失败，请稍后再试。');
  return body;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderCard(booking) {
  const card = element('article', `staff-card ${booking.status || 'confirmed'}`);
  const time = element('div', 'staff-card-time', booking.time);
  const main = element('div', 'staff-card-main');
  main.append(element('strong', '', `${booking.name} · ${booking.partySize} 人`));
  main.append(element('p', '', `${booking.phone} · 手抓羊排 ${booking.lambQty} 份`));
  if (booking.note) main.append(element('small', '', `备注：${booking.note}`));
  const side = element('div', 'staff-card-side');
  const label = booking.status === 'cancelled' ? '已取消' : booking.status === 'arrived' ? '已到店' : '已确认';
  side.append(element('span', 'staff-status', label));
  if (booking.status !== 'cancelled' && booking.status !== 'arrived' && booking.date === restaurantToday) {
    const button = element('button', 'arrive-button', '标记到店');
    button.type = 'button';
    button.addEventListener('click', async () => {
      button.disabled = true;
      showMessage('');
      try {
        await request('/api/staff/arrive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: booking.code })
        });
        await loadBookings();
      } catch (error) {
        showMessage(error.message);
        button.disabled = false;
      }
    });
    side.append(button);
  }
  card.append(time, main, side);
  return card;
}

function renderBookings(bookings) {
  const active = bookings.filter((booking) => booking.status !== 'cancelled');
  document.querySelector('#stat-bookings').textContent = active.length;
  document.querySelector('#stat-seats').textContent = active.reduce((sum, booking) => sum + booking.partySize, 0);
  document.querySelector('#stat-lamb').textContent = active.reduce((sum, booking) => sum + booking.lambQty, 0);
  document.querySelector('#results-date').textContent = dateInput.value;
  list.replaceChildren(...bookings.map(renderCard));
  empty.hidden = bookings.length > 0;
  results.hidden = false;
}

async function loadBookings() {
  const data = await request(`/api/staff/bookings?date=${encodeURIComponent(dateInput.value)}`);
  renderBookings(data.bookings);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('');
  results.hidden = true;
  if (!keyInput.value || !dateInput.value) {
    showMessage('请输入店员密钥并选择查询日期。');
    return;
  }
  staffKey = keyInput.value;
  loadButton.disabled = true;
  try {
    await loadBookings();
  } catch (error) {
    showMessage(error.message);
  } finally {
    loadButton.disabled = false;
  }
});

dateInput.value = localDate();
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('无法获取餐厅日期。');
  const config = await response.json();
  restaurantToday = config.min;
  dateInput.value = restaurantToday;
} catch (error) {
  showMessage(error.message);
}
