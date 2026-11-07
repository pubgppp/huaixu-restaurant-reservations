const form = document.querySelector('#booking-form');
const dateInput = document.querySelector('#date');
const timeInput = document.querySelector('#time');
const partyInput = document.querySelector('#partySize');
const lambInput = document.querySelector('#lambQty');
const stockHint = document.querySelector('#stock-hint');
const seatHint = document.querySelector('#seat-hint');
const message = document.querySelector('#form-message');
const submitButton = document.querySelector('#submit-button');
const dialog = document.querySelector('#confirmation');
const closeButton = document.querySelector('#close-dialog');
const doneButton = document.querySelector('#done-button');
const manageLink = document.querySelector('#manage-link');
const lookupForm = document.querySelector('#lookup-form');
const lookupCode = document.querySelector('#lookup-code');
const lookupPhone = document.querySelector('#lookup-phone');
const lookupButton = document.querySelector('#lookup-button');
const lookupMessage = document.querySelector('#lookup-message');
const lookupResult = document.querySelector('#lookup-result');
const cancelButton = document.querySelector('#cancel-button');
let config;
let stock;
let requestNumber = 0;
let currentBooking;
let verifiedPhone;

async function api(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || '网络暂时不可用，请稍后重试。');
  return body;
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function showLookupMessage(text, success = false) {
  lookupMessage.textContent = text;
  lookupMessage.hidden = !text;
  lookupMessage.classList.toggle('success', success);
}

function renderBooking(booking) {
  currentBooking = booking;
  document.querySelector('#result-code').textContent = booking.code;
  document.querySelector('#result-datetime').textContent = `${booking.date} ${booking.time}`;
  document.querySelector('#result-party').textContent = `${booking.partySize} 人`;
  document.querySelector('#result-lamb').textContent = booking.lambQty ? `${booking.lambQty} 份` : '未预留';
  const status = document.querySelector('#lookup-status');
  status.textContent = booking.status === 'cancelled' ? '已取消' : '已确认';
  status.classList.toggle('cancelled', booking.status === 'cancelled');
  cancelButton.hidden = !booking.canCancel;
  lookupResult.hidden = false;
}

function renderAvailability() {
  const selectedTime = timeInput.value;
  const selectedLamb = Number(lambInput.value);
  const partySize = Number(partyInput.value);
  timeInput.replaceChildren(new Option('请选择时间', ''));
  for (const time of config.times) {
    const remaining = stock?.slots[time] ?? 0;
    const option = new Option(`${time} · ${remaining ? `余 ${remaining} 位` : '已满或已过时'}`, time);
    option.disabled = !remaining || (partySize > 0 && remaining < partySize);
    timeInput.add(option);
  }
  if ([...timeInput.options].some((option) => option.value === selectedTime && !option.disabled)) timeInput.value = selectedTime;

  const remaining = stock?.lambRemaining ?? 0;
  const maxQty = Math.min(4, remaining, partySize || 0);
  lambInput.replaceChildren(new Option('暂不预留', '0'));
  for (let qty = 1; qty <= maxQty; qty++) lambInput.add(new Option(`${qty} 份`, String(qty)));
  if (selectedLamb <= maxQty) lambInput.value = String(selectedLamb);
  stockHint.textContent = stock ? `当日剩余 ${remaining} / ${config.dailyLambLimit} 份` : '选择日期后查看当日余量';
  seatHint.textContent = stock ? '每时段最多接待 20 位客人' : '先选择日期查看时段';
}

async function loadAvailability() {
  const currentRequest = ++requestNumber;
  stock = null;
  renderAvailability();
  if (!dateInput.value) return;
  stockHint.textContent = '正在查看当日余量…';
  try {
    const result = await api(`/api/availability?date=${encodeURIComponent(dateInput.value)}`);
    if (currentRequest !== requestNumber) return;
    stock = result;
    renderAvailability();
    showMessage('');
  } catch (error) {
    if (currentRequest !== requestNumber) return;
    stockHint.textContent = '暂时无法查看余量';
    showMessage(error.message);
  }
}

function closeDialog() {
  dialog.hidden = true;
  document.body.style.overflow = '';
  submitButton.focus();
}

dateInput.addEventListener('change', loadAvailability);
partyInput.addEventListener('change', renderAvailability);
closeButton.addEventListener('click', closeDialog);
doneButton.addEventListener('click', closeDialog);
manageLink.addEventListener('click', closeDialog);
dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !dialog.hidden) closeDialog(); });

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('');
  const input = Object.fromEntries(new FormData(form));
  if (!input.date || !input.time || !input.partySize || !input.name?.trim() || !input.phone?.trim()) {
    showMessage('请填写用餐日期、时间、人数、称呼和联系电话。');
    return;
  }
  submitButton.disabled = true;
  submitButton.firstChild.textContent = '正在确认… ';
  try {
    const result = await api('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    document.querySelector('#confirmation-summary').textContent = `${result.date} ${result.time} · ${result.partySize} 位${result.lambQty ? ` · 手抓羊排 ${result.lambQty} 份` : ''}`;
    document.querySelector('#confirmation-code').textContent = `预约编号：${result.code}`;
    lookupCode.value = result.code;
    lookupPhone.value = input.phone;
    dialog.hidden = false;
    document.body.style.overflow = 'hidden';
    closeButton.focus();
    form.reset();
    dateInput.value = config.min;
    await loadAvailability();
  } catch (error) {
    showMessage(error.message);
    if (error.message.includes('余量') || error.message.includes('座位')) await loadAvailability();
  } finally {
    submitButton.disabled = false;
    submitButton.firstChild.textContent = '确认预约 ';
  }
});

lookupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showLookupMessage('');
  lookupResult.hidden = true;
  currentBooking = null;
  verifiedPhone = null;
  const input = Object.fromEntries(new FormData(lookupForm));
  if (!input.code?.trim() || !input.phone?.trim()) {
    showLookupMessage('请填写预约编号和预留的联系电话。');
    return;
  }
  lookupButton.disabled = true;
  try {
    const booking = await api('/api/reservations/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    verifiedPhone = input.phone;
    renderBooking(booking);
  } catch (error) {
    showLookupMessage(error.message);
  } finally {
    lookupButton.disabled = false;
  }
});

cancelButton.addEventListener('click', async () => {
  if (!currentBooking?.canCancel) return;
  if (!window.confirm('确定取消这笔预约吗？取消后，座位和预留菜品会重新开放。')) return;
  cancelButton.disabled = true;
  showLookupMessage('');
  try {
    const booking = await api('/api/reservations/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: currentBooking.code, phone: verifiedPhone })
    });
    renderBooking(booking);
    showLookupMessage('预约已取消，座位和限量菜品余量已恢复。', true);
    if (dateInput.value === booking.date) await loadAvailability();
  } catch (error) {
    showLookupMessage(error.message);
  } finally {
    cancelButton.disabled = false;
  }
});

try {
  config = await api('/api/config');
  dateInput.min = config.min;
  dateInput.max = config.max;
  dateInput.value = config.min;
  await loadAvailability();
} catch (error) {
  showMessage(`无法载入预约服务：${error.message}`);
  submitButton.disabled = true;
}
