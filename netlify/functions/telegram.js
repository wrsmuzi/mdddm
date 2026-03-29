const RATE_LIMIT = 10;
const RATE_WIN   = 60_000;
const RATE_MAP   = {};        // ← ЭТО БЫЛО ПРОПУЩЕНО

function isRateLimited(ip) {
  const now = Date.now();
  if (!RATE_MAP[ip]) RATE_MAP[ip] = [];
  RATE_MAP[ip] = RATE_MAP[ip].filter(t => now - t < RATE_WIN);
  if (RATE_MAP[ip].length >= RATE_LIMIT) return true;
  RATE_MAP[ip].push(now);
  return false;
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const Busboy = require('busboy');
    const bb = Busboy({ headers: event.headers });
    const fields = {};
    const files  = [];

    bb.on('field', (name, val) => { fields[name] = val; });
    bb.on('file',  (name, file, info) => {
      const chunks = [];
      file.on('data', d => chunks.push(d));
      file.on('end',  () => files.push({
        fieldname:   name,
        content:     Buffer.concat(chunks),
        contentType: info.mimeType,
        filename:    info.filename || 'file',
      }));
    });
    bb.on('finish', () => resolve({ fields, files }));
    bb.on('error',  reject);

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body || '');
    bb.write(body);
    bb.end();
  });
}

exports.handler = async (event) => {

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown';

  if (isRateLimited(ip)) {
    return { statusCode: 429, body: 'Too Many Requests' };
  }

  const TGT = process.env.TG_TOKEN;
  const TGC = process.env.TG_CHAT_ID;

  if (!TGT || !TGC) {
    console.error('TG_TOKEN или TG_CHAT_ID не заданы!');
    return { statusCode: 500, body: 'Bot not configured' };
  }

  const ct = event.headers['content-type'] || '';

  try {

    if (ct.includes('application/json')) {
      const { text } = JSON.parse(event.body);
      if (!text) return { statusCode: 400, body: 'Missing text' };

      console.log('TOKEN prefix:', TGT.substring(0, 10));
      console.log('CHAT_ID:', TGC);
      const res  = await fetch(`https://api.telegram.org/bot${TGT}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: TGC, text, parse_mode: 'HTML' }),
      });
      const data = await res.json();
      console.log('sendMessage full:', JSON.stringify(data));
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (ct.includes('multipart/form-data')) {
      const { fields, files } = await parseMultipart(event);
      const file    = files[0];
      const caption = fields.caption || '';

      if (!file) return { statusCode: 400, body: 'Missing file' };

      const isImg    = file.contentType.startsWith('image/');
      const endpoint = isImg ? 'sendPhoto' : 'sendDocument';
      const field    = isImg ? 'photo'     : 'document';

      const fd = new FormData();
      fd.append('chat_id', TGC);
      fd.append('caption', caption);
      fd.append(field, new Blob([file.content], { type: file.contentType }), file.filename);

      const res  = await fetch(`https://api.telegram.org/bot${TGT}/${endpoint}`, {
        method: 'POST',
        body:   fd,
      });
      const data = await res.json();
      console.log(`${endpoint}:`, data.ok, data.description || '');
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    return { statusCode: 400, body: 'Unsupported Content-Type' };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: String(err) };
  }
};
