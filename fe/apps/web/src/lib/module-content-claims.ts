/** Plain checks a post must pass before an owner sees it (pure, client-safe: the editor runs them live, the drafter runs them with the business knowledge). */

const PROMISE = [/cam kết/i, /đảm bảo (?:kết quả|hiệu quả|khỏi)/i, /chắc chắn (?:khỏi|hiệu quả|giảm|trắng|đẹp)/i, /100\s*%/, /khỏi hẳn|hết hẳn|vĩnh viễn/i];
const MONEY_OR_PCT = /(?:giảm|khuyến mãi|ưu đãi|tặng|sale)[^.\n]{0,24}?(\d{1,3}(?:[.,]\d{3})*\s*(?:%|k\b|đ\b|nghìn|triệu|tr\b))/gi;

/** `knowledge` = the business facts the post must stay inside; leave it out to check only for outcome promises. */
export const claimWarnings = (text: string, knowledge?: string): Array<string> => {
  const out: Array<string> = [];
  for (const re of PROMISE) {
    const m = re.exec(text);
    if (m) out.push(`Có cụm "${m[0]}" nghe như cam kết kết quả. Nên bỏ hoặc viết lại.`);
  }
  if (knowledge === undefined) return [...new Set(out)];
  const k = knowledge.replace(/\s+/g, "").toLowerCase();
  for (const m of text.matchAll(MONEY_OR_PCT)) {
    const fig = m[1].replace(/\s+/g, "").toLowerCase();
    if (!k.includes(fig)) out.push(`Con số "${m[1].trim()}" không thấy trong thông tin của doanh nghiệp. Kiểm tra lại trước khi đăng.`);
  }
  return [...new Set(out)];
};

