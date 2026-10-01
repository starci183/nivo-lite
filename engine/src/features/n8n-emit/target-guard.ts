import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** True for loopback, private, link-local, unique-local and unspecified addresses (IPv4 and IPv6). */
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
 * Webhook URLs are tenant-supplied, so the VPS must not be a way into its own network (OpenClaw, n8n admin, the database, cloud metadata).
 * A target must be http(s) and resolve only to public addresses, unless its host is on the explicit allow-list.
 * (A resolver that changes its answer between this check and the request is not covered; keep the VPS firewall tight as the second layer.)
 */
export const assertAllowedTarget = async (raw: string, allowedHosts: ReadonlyArray<string>): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("not a URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("only http(s) targets are allowed");
  if (url.username || url.password) throw new Error("credentials in the URL are not allowed");
  if (allowedHosts.includes(url.hostname)) return url;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new Error("target resolves to a private address");
  return url;
};
