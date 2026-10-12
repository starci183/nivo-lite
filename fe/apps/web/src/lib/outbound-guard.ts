import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { publicSiteUrl } from "./channels";

/** True for loopback, private, link-local, unique-local and unspecified addresses (IPv4 and IPv6). Same rules as engine/src/features/n8n-emit/target-guard.ts. */
export const isPrivateAddress = (address: string): boolean => {
  const a = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(a) === 6) {
    if (a === "::1" || a === "::") return true;
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe[89ab])/.test(a);
  }
  const p = a.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return true;
  const [x, y] = p;
  return x === 0 || x === 10 || x === 127 || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 100 && y >= 64 && y <= 127);
};

/**
 * A webhook URL is tenant-supplied, so the server must not be a way into its own network. http(s) only, no credentials in the URL, and the host must resolve to
 * public addresses. On a local development site (no public https origin) private targets are allowed, so a mock receiver on localhost can be used.
 */
export const assertPublicTarget = async (raw: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Địa chỉ webhook không hợp lệ. Hãy dán cả địa chỉ, bắt đầu bằng https://");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Địa chỉ webhook phải bắt đầu bằng https:// (hoặc http://).");
  if (url.username || url.password) throw new Error("Địa chỉ webhook không được chứa tên đăng nhập hoặc mật khẩu.");
  if (publicSiteUrl() === null) return url;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (addresses.length === 0) throw new Error("Không tìm thấy máy chủ của địa chỉ này. Kiểm tra lại địa chỉ webhook.");
  if (addresses.some(isPrivateAddress)) throw new Error("Địa chỉ này nằm trong mạng nội bộ nên NIVO không gửi tới được. Dùng địa chỉ công khai của n8n, Make hoặc Zapier.");
  return url;
};
