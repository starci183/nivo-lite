// PORTED from src/lib/knowledge/index.ts (fetchUrlDoc, fetchPublicDoc, htmlToText, isPublicHost, pageTitle). Keep in sync by hand.
// Differences: the Drive grant helpers take the db client and the engine options; a 4xx answer from a plain web page is marked permanent
// (status on the error) so the job does not retry a link that will not change.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeJobsOptions } from "../../knowledge-jobs.config";
import { linkError, linkErrorCode, LINK_ERROR, resolveLink } from "./drive";
import { fetchFile } from "./drive-api";
import { driveGrantOf, withDriveToken } from "./drive-grant";
import { sniffTextKind, textFromBytes } from "./extract";
import { MAX_SOURCE_CHARS } from "./limits";

/** Private/loopback hosts are never fetched for a URL source. */
const isPublicHost = (host: string): boolean =>
  !/^(localhost|0\.0\.0\.0|\[?::1\]?)$/i.test(host) && !/\.(local|internal|localhost)$/i.test(host) &&
  !/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);

const htmlToText = (html: string): string =>
  html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();

export const MAX_DOWNLOAD_BYTES = 12_000_000;
const pageTitle = (html: string): string | null => {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? htmlToText(m[1] as string).slice(0, 160) || null : null;
};

/** An HTTP status attached to an error: 0 = network, 4xx = will not change, 5xx/429 = try again. */
export type HttpStatusError = Error & { status?: number };

type Ctx = { readonly db: SupabaseClient; readonly options: KnowledgeJobsOptions };

/**
 * The text of a link (http/https, public hosts, 10 seconds, 12 MB). Google share links become their public export URL; a Google file that is not
 * public is read with the workspace's Drive grant when `workspaceId` is given (the web passes it only for sources added by a signed-in person).
 */
export const fetchUrlDoc = async (c: Ctx, raw: string, workspaceId?: string): Promise<{ text: string; title: string | null }> => {
  const target = resolveLink(raw);
  if (target.kind === "drive-folder") {
    if (workspaceId && (await driveGrantOf(c.db, workspaceId)).state === "connected") throw linkError(LINK_ERROR.folder, "Hãy thêm thư mục từ hộp 'Thêm tài liệu' để nhập từng tệp trong đó.");
    throw linkError(LINK_ERROR.needGrant, "Cần cấp quyền Google Drive để đọc thư mục.");
  }
  try {
    return await fetchPublicDoc(raw);
  } catch (e) {
    const driveId = target.kind === "google" || target.kind === "drive-file" ? target.driveId : undefined;
    if (!workspaceId || !driveId || linkErrorCode(e instanceof Error ? e.message : "") !== LINK_ERROR.notPublic) throw e;
    const grant = await driveGrantOf(c.db, workspaceId);
    if (grant.state === "none") throw linkError(LINK_ERROR.needGrant, "Cần cấp quyền Google Drive để đọc tệp riêng tư.");
    const file = await withDriveToken(c.db, c.options, workspaceId, (token) => fetchFile(c.options.driveBase, token, driveId));
    return { text: file.text, title: file.name.slice(0, 160) };
  }
};

const fetchPublicDoc = async (raw: string): Promise<{ text: string; title: string | null }> => {
  const target = resolveLink(raw);
  if (target.kind === "invalid") throw new Error("Link không hợp lệ.");
  if (target.kind === "drive-folder") throw linkError(LINK_ERROR.folder, "Chưa đọc được thư mục Google Drive. Hãy chia sẻ từng tệp (hoặc một tài liệu công khai).");
  const url = new URL(target.fetchUrl);
  if (!isPublicHost(url.hostname)) throw new Error("Chỉ lấy được liên kết công khai (http/https).");
  const google = target.kind !== "web";
  const notPublic = () => linkError(LINK_ERROR.notPublic, "Hãy chia sẻ tệp ở chế độ 'Bất kỳ ai có đường liên kết'.");
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "NIVO-OS-Knowledge/1.0" }, redirect: "follow" });
  } catch (e) {
    throw Object.assign(new Error(`Không mở được liên kết (${e instanceof Error ? e.message : "lỗi mạng"}).`), { status: 0 });
  }
  const finalHost = new URL(res.url || url).hostname;
  if (google && (res.status === 401 || res.status === 403 || res.status === 404 || finalHost === "accounts.google.com")) throw notPublic();
  if (!res.ok) throw Object.assign(new Error(`Không mở được liên kết (${res.status}).`), { status: res.status });
  const type = res.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_DOWNLOAD_BYTES) throw new Error("Tệp quá lớn để đọc.");
  const kind = sniffTextKind(bytes, type);
  let text: string;
  let title: string | null = null;
  if (kind) {
    text = await textFromBytes(kind, bytes);
  } else if (/html/i.test(type)) {
    const html = new TextDecoder("utf-8").decode(bytes.subarray(0, 1_000_000));
    if (google) throw notPublic();
    title = pageTitle(html);
    text = htmlToText(html);
  } else {
    throw linkError(LINK_ERROR.unsupported, `Chưa đọc được loại tệp này (${type.split(";")[0] || "không rõ"}). Hỗ trợ trang web, văn bản, PDF và Word.`);
  }
  return { text: text.slice(0, MAX_SOURCE_CHARS), title };
};
