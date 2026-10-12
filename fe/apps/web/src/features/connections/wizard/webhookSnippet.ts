/** The n8n Code node that verifies a NIVO delivery (Webhook node with Options > Raw Body on). */
export const N8N_VERIFY_SNIPPET = `const crypto = require('crypto');
const secret = 'DÁN_KHOÁ_KÝ_VÀO_ĐÂY';

const headers = $input.first().json.headers;
const raw = (await this.helpers.getBinaryDataBuffer(0, 'data')).toString('utf8');
const ts = String(headers['x-nivo-timestamp'] || '');

// Chỉ nhận tin trong vòng 5 phút
if (!ts || Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) throw new Error('Tin quá cũ');

const expected = Buffer.from(crypto.createHmac('sha256', secret).update(ts + '.' + raw).digest('hex'));
const got = Buffer.from(String(headers['x-nivo-signature'] || ''));
if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) throw new Error('Sai chữ ký');

// headers['x-nivo-delivery'] giữ nguyên khi gửi lại: dùng để bỏ qua tin trùng
return [{ json: JSON.parse(raw) }];`
