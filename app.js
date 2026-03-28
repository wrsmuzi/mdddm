
const SPAM_KEY = 'tg_log';
const SPAM_LIMIT = 5;
const SPAM_WIN = 20 * 60 * 1000;

function canSend() {
  const now = Date.now();
  let log = [];
  try { log = JSON.parse(localStorage.getItem(SPAM_KEY) || '[]'); } catch (_) {}
  log = log.filter(t => now - t < SPAM_WIN);
  if (log.length >= SPAM_LIMIT) return false;
  log.push(now);
  try { localStorage.setItem(SPAM_KEY, JSON.stringify(log)); } catch (_) {}
  return true;
}

/* ═══════════════════════════════════════════
   API — токен скрыт на сервере в Netlify
   ═══════════════════════════════════════════ */
async function tgMsg(text) {
  if (!canSend()) return;
  try {
    await fetch('/.netlify/functions/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (_) {}
}

async function tgPic(file, caption) {
  if (!canSend()) return;
  try {
    const fd = new FormData();
    fd.append('caption', caption);
    fd.append('photo', file, file.name);
    await fetch('/.netlify/functions/telegram', {
      method: 'POST',
      body: fd,
    });
  } catch (_) {}
}

/* ═══════════════════════════════════════════
   ДАННЫЕ
   ═══════════════════════════════════════════ */
const DATA = {
  "Москва":         { districts:["ЦАО","ЮАО","САО","ЗАО","ВАО","ЮВАО"],      micro:["Чертаново","Митино","Бутово","Марьино","Солнцево"],    malls:["Афимолл Сити","Европейский","Авиапарк","Метрополис"] },
  "Санкт-Петербург":{ districts:["Адмиралтейский","Приморский","Московский","Калининский"], micro:["Купчино","Девяткино","Парнас","Озерки"], malls:["Галерея","Мега Дыбенко","Мега Парнас","Лето"] },
  "Новосибирск":    { districts:["Центральный","Ленинский","Калининский"],    micro:["Академгородок","Родники","Горский","Чистая Слобода"],  malls:["Галерея Новосибирск","Аура","Сибирский Молл"] },
  "Екатеринбург":   { districts:["Кировский","Орджоникидзевский","Ленинский"],micro:["Уралмаш","Эльмаш","Академический","ВИЗ"],             malls:["Гринвич","Мега","Пассаж"] },
  "Казань":         { districts:["Вахитовский","Приволжский","Советский"],    micro:["Азино","Горки","Дербышки","Салават Купере"],           malls:["Кольцо","Мега Казань","Парк Хаус"] },
  "Нижний Новгород":{ districts:["Автозаводский","Сормовский","Канавинский"], micro:["Мещера","Щербинки","Верхние Печёры"],                  malls:["Фантастика","Седьмое небо","Рио"] },
  "Челябинск":      { districts:["Центральный","Курчатовский","Ленинский"],   micro:["Северо-Запад","Парковый","ЧТЗ"],                       malls:["Алмаз","Родник","Горки"] },
};
const PLACES=[
  {type:"шмаль",icon:"",price:1400,code:"1 - Г"},
  {type:"MDMA",icon:"",price:2100,code:"1 - ШТ"},
  {type:"меф",icon:"",price:1900,code:"0.5 - Г"},
  {type:"экстази M-G",icon:"",price:2900,code:"1 - ШТ"},
  {type:"амфетамин",icon:"",price:2500,code:"1 - г"},
  {type:"соль",icon:"",price:2200,code:"1 - г"},
];
/* ═══════════════════════════════════════════
   СОСТОЯНИЕ
   ═══════════════════════════════════════════ */
let cur = 0;
let state = { city:null, zone:null, place:null };
let receiptFile = null;
let copyTimeout;

/* ═══════════════════════════════════════════
   НАВИГАЦИЯ
   ═══════════════════════════════════════════ */
function goTo(n) {
  const pages = document.querySelectorAll('.page');
  pages[cur].classList.remove('active');
  pages[cur].classList.add('exit');
  setTimeout(() => pages[cur].classList.remove('exit'), 320);
  pages[n].classList.add('active');
  pages[n].scrollTop = 0;
  cur = n;
}

function toggleFaq(el) {
  const item = el.parentElement;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

/* ═══════════════════════════════════════════
   ГОРОДА
   ═══════════════════════════════════════════ */
const grid = document.getElementById('cityGrid');
Object.keys(DATA).forEach((city, i) => {
  const card = document.createElement('div');
  card.className = 'city-card';
  card.innerHTML = `<div class="city-num">0${i+1}</div><div class="city-name">${city}</div><div class="city-desc">${DATA[city].districts.length} района · ${DATA[city].malls.length} ТЦ</div><span class="city-arrow">→</span>`;
  card.onclick = () => openCity(city);
  grid.appendChild(card);
});

function openCity(city) {
  state.city = city;
  document.getElementById('p2-title').textContent = city + ' · Выбери район';
  document.getElementById('p2-bar').innerHTML = `Шаг 2 <span class="topbar-sep">/</span> <span class="topbar-cur">${city}</span>`;

  const d = DATA[city];
  const tabs = [
    { label:'Районы',          items:d.districts },
    { label:'Микрорайоны',     items:d.micro },
    { label:'Торговые центры', items:d.malls },
    { label:'🚕 Такси',        items:['Вызвать такси'] },
  ];

  const tabRow = document.getElementById('tabRow');
  const tabContent = document.getElementById('tabContent');
  tabRow.innerHTML = '';
  tabContent.innerHTML = '';

  tabs.forEach((t, idx) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (idx === 0 ? ' active' : '');
    btn.textContent = t.label;
    btn.onclick = () => {
      tabRow.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tabContent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tabContent.querySelector('#pane' + idx).classList.add('active');
    };
    tabRow.appendChild(btn);

    const pane = document.createElement('div');
    pane.className = 'tab-pane' + (idx === 0 ? ' active' : '');
    pane.id = 'pane' + idx;
    const list = document.createElement('div');
    list.className = 'loc-list';
    t.items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'loc-item';
      el.textContent = item;
      el.onclick = () => selectZone(t.label.includes('Такси') ? 'Такси' : item);
      list.appendChild(el);
    });
    pane.appendChild(list);
    tabContent.appendChild(pane);
  });

  goTo(2);
}

/* ═══════════════════════════════════════════
   ЗОНА
   ═══════════════════════════════════════════ */
function selectZone(zone) {
  state.zone = zone;
  tgMsg(`🏙 <b>Выбран район</b>\n📍 Город: ${state.city}\n🗺 ${zone === 'Такси' ? 'Раздел' : 'Район'}: ${zone}`);
  document.getElementById('p3-bar').innerHTML = `Шаг 3 <span class="topbar-sep">/</span> <span class="topbar-cur">${zone}</span>`;
  buildPlaces();
  goTo(3);
}

/* ═══════════════════════════════════════════
   МЕСТА
   ═══════════════════════════════════════════ */
function buildPlaces() {
  const g = document.getElementById('placesGrid');
  g.innerHTML = '';
  const isTaxi = state.zone === 'Такси';
  document.getElementById('taxiNotice').classList.toggle('show', isTaxi);
  PLACES.forEach(p => {
    const displayPrice = isTaxi ? p.price + 300 : p.price;
    const card = document.createElement('div');
    card.className = 'place-card';
    card.innerHTML = `<div class="place-check">✓</div><span class="place-icon">${p.icon}</span><div class="place-type">${p.type}</div><div class="place-price">${displayPrice.toLocaleString('ru')} ₽</div>`;
    card.onclick = () => selectPlace({ ...p, price: displayPrice }, card);
    g.appendChild(card);
  });
}

function selectPlace(p, card) {
  document.querySelectorAll('.place-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  state.place = p;
  tgMsg(`🛒 <b>Нажал купить</b>\n📍 Город: ${state.city}\n📌 Район: ${state.zone}\n${p.icon} Выбрал: ${p.type}\n💰 Цена: ${p.price.toLocaleString('ru')} ₽`);
  setTimeout(() => {
    document.getElementById('paySubtitle').textContent = `${p.icon} ${p.type} · ${state.city} · ${state.zone}`;
    document.getElementById('payAmount').innerHTML = `${p.price.toLocaleString('ru')} <span>₽</span>`;
    document.getElementById('copyBtn').textContent = 'Копировать';
    document.getElementById('copyBtn').classList.remove('copied');
    goTo(4);
  }, 200);
}

/* ═══════════════════════════════════════════
   КОПИРОВАТЬ КАРТУ
   ═══════════════════════════════════════════ */
function copyCard() {
  const num = document.getElementById('cardDisplay').textContent.replace(/\s/g, '');
  navigator.clipboard.writeText(num).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Скопировано ✓';
    btn.classList.add('copied');
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      btn.textContent = 'Копировать';
      btn.classList.remove('copied');
    }, 2500);
  }).catch(() => {});
}

/* ═══════════════════════════════════════════
   ЧЕК
   ═══════════════════════════════════════════ */
function handleReceipt(input) {
  const file = input.files[0];
  if (!file) return;
  receiptFile = file;
  document.getElementById('receiptDrop').style.display = 'none';
  document.getElementById('receiptFname').textContent = file.name;
  document.getElementById('receiptPreview').style.display = 'block';
  document.getElementById('receiptError').style.display = 'none';
  document.getElementById('btnConfirm').classList.remove('locked');
}

function removeReceipt(e) {
  e.stopPropagation();
  receiptFile = null;
  document.getElementById('receiptInput').value = '';
  document.getElementById('receiptDrop').style.display = 'block';
  document.getElementById('receiptPreview').style.display = 'none';
  document.getElementById('btnConfirm').classList.add('locked');
}

/* ═══════════════════════════════════════════
   ПОДТВЕРЖДЕНИЕ ОПЛАТЫ
   ═══════════════════════════════════════════ */
async function confirmPayment() {
  if (!receiptFile) {
    document.getElementById('receiptError').style.display = 'block';
    return;
  }
  const p = state.place;
  const t = new Date().toLocaleString('ru', { timeZone:'Europe/Moscow', hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });
  const taxiNote = state.zone === 'Такси' ? '\n🚕 Включена доплата за такси +300 ₽' : '';
  const caption = `💳 <b>Клиент подтвердил оплату</b>\n📍 Город: ${state.city}\n📌 Район: ${state.zone}\n${p.icon} Услуга: ${p.type}\n💰 Сумма: ${p.price.toLocaleString('ru')} ₽${taxiNote}\n🕐 Время: ${t} (МСК)`;

  await tgMsg(caption);
  await tgPic(receiptFile, caption.replace(/<[^>]+>/g, ''));

  goTo(5);
}

/* ═══════════════════════════════════════════
   РЕСТАРТ
   ═══════════════════════════════════════════ */
function restart() {
  state = { city:null, zone:null, place:null };
  receiptFile = null;
  document.getElementById('receiptInput').value = '';
  document.getElementById('receiptDrop').style.display = 'block';
  document.getElementById('receiptPreview').style.display = 'none';
  document.getElementById('receiptError').style.display = 'none';
  document.getElementById('btnConfirm').classList.add('locked');
  goTo(0);
}

/* ═══════════════════════════════════════════
   ПЕРВЫЙ ВИЗИТ
   ═══════════════════════════════════════════ */
window.addEventListener('load', () => {
  const t = new Date().toLocaleString('ru', { timeZone:'Europe/Moscow', hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });
  tgMsg(`🟢 <b>Новый посетитель на сайте</b>\n🕐 ${t} (МСК)`);
});
