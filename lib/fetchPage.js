const dns = require('node:dns/promises');
const net = require('node:net');

function isPrivate(ip) {
  if (net.isIPv6(ip)) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || /^::ffff:/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h\d|br|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

// Fetches a public job-description page and returns its text. Throws on any problem.
async function fetchPageText(rawUrl) {
  const url = new URL(rawUrl);
  if (!/^https?:$/.test(url.protocol)) throw new Error('URL must be http(s)');
  const { address } = await dns.lookup(url.hostname);
  if (isPrivate(address)) throw new Error('URL points to a private address');
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'InterviewPracticeBot/1.0' } });
  if (!res.ok) throw new Error(`Page returned ${res.status}`);
  const text = htmlToText((await res.text()).slice(0, 1_000_000));
  if (text.length < 50) throw new Error('Page had no readable text');
  return text.slice(0, 15000);
}

module.exports = { fetchPageText, htmlToText };
