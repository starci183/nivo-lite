import "server-only";
import { createDataConnection, safeFetch, upsertRecords, type Connector, type Entity, type RecordInput } from "../data-hub";
import { supabaseAdmin } from "../supabase/admin";
import { buildRecords, CsvError, missingColumns, tableFromText, type Table } from "@/features/connections/wizard/data/csv/table";
import { MAX_FILE_BYTES, SCHEDULES, type CsvConfig, type CsvEntity, type CsvMapping } from "@/features/connections/wizard/data/csv/types";

/**
 * Excel / CSV import (provider csv_import). Four sources: an uploaded .csv/.xlsx, a public Google Sheets link, rows typed or
 * pasted, and documents (.docx .pdf .txt .md, Google Docs link). Uploads call commitRecords directly (trigger `upload`); only a
 * Google Sheets link has a schedule, and `sync` then re-reads it with the saved mapping. A workspace may hold many imports.
 */

export const ENTITY_LABEL: Readonly<Record<CsvEntity, string>> = {
  customer: "Khách hàng", order: "Đơn hàng", product: "Sản phẩm", transaction: "Giao dịch", other: "Dữ liệu khác", document: "Tài liệu",
};

const nf = new Intl.NumberFormat("vi-VN");
export const summaryOf = (entity: CsvEntity, total: number): string => `${ENTITY_LABEL[entity]} · ${nf.format(total)} ${entity === "document" ? "tài liệu" : "dòng"}`;

/* ------------------------------------------------------------------ saved config */

const ENTITIES: ReadonlyArray<string> = ["customer", "order", "product", "transaction", "other", "document"];
const SOURCES: ReadonlyArray<string> = ["file", "sheet", "manual", "document"];

/** The saved setup from a connection's public_meta (null when missing or damaged). */
export const readConfig = (meta: Readonly<Record<string, string>> | null | undefined): CsvConfig | null => {
  try {
    const c = JSON.parse(meta?.config ?? "") as Partial<CsvConfig>;
    if (!c || c.v !== 1 || !SOURCES.includes(c.source as string) || !ENTITIES.includes(c.entity as string)) return null;
    const text = (v: unknown) => (typeof v === "string" && v ? v : null);
    return {
      v: 1, source: c.source as CsvConfig["source"], entity: c.entity as CsvEntity,
      idColumn: text(c.idColumn), titleColumn: text(c.titleColumn), dateColumn: text(c.dateColumn),
      kinds: c.kinds && typeof c.kinds === "object" ? c.kinds : {}, columns: Array.isArray(c.columns) ? c.columns.filter((x) => typeof x === "string") : [],
      ...(typeof c.sheet === "string" ? { sheet: c.sheet } : {}), ...(typeof c.link === "string" ? { link: c.link } : {}),
    };
  } catch {
    return null;
  }
};

export const isSchedule = (v: unknown): v is number | null => v === null || (typeof v === "number" && SCHEDULES.includes(v));

/* ------------------------------------------------------------------ Google links */

const GOOGLE_ID = /^[A-Za-z0-9_-]{10,200}$/;

const googleLink = (raw: string, kind: "spreadsheets" | "document"): { id: string; gid: string } => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new CsvError(kind === "spreadsheets" ? "Đường liên kết Google Sheets không hợp lệ." : "Đường liên kết Google Docs không hợp lệ.");
  }
  const id = url.pathname.match(new RegExp(`^/${kind}/d/([^/]+)`))?.[1] ?? "";
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || !GOOGLE_ID.test(id)) {
    throw new CsvError(kind === "spreadsheets" ? "Hãy dán đường liên kết dạng docs.google.com/spreadsheets/d/..." : "Hãy dán đường liên kết dạng docs.google.com/document/d/...");
  }
  const gid = url.searchParams.get("gid") ?? url.hash.match(/gid=(\d+)/)?.[1] ?? "0";
  return { id, gid: /^\d{1,20}$/.test(gid) ? gid : "0" };
};

/** Pasted Google Sheets link -> the CSV export address of that tab. */
export const sheetExportUrl = (link: string): string => {
  const { id, gid } = googleLink(link, "spreadsheets");
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
};

/** Pasted Google Docs link -> the plain text export address, plus the document id. */
export const docExportUrl = (link: string): { url: string; id: string } => {
  const { id } = googleLink(link, "document");
  return { url: `https://docs.google.com/document/d/${id}/export?format=txt`, id };
};

const NOT_PUBLIC = "Link Google chưa được chia sẻ công khai: bấm Chia sẻ > Bất kỳ ai có đường liên kết.";

const fetchGoogle = async (url: string): Promise<string> => {
  let res: Awaited<ReturnType<typeof safeFetch>>;
  try {
    res = await safeFetch(url, { timeoutMs: 20_000, maxBytes: MAX_FILE_BYTES, headers: { accept: "text/csv,text/plain;q=0.9" } });
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (/lớn|Phản hồi quá/.test(m)) throw new CsvError("Dữ liệu từ Google lớn hơn 10 MB.");
    throw new CsvError("Không kết nối được tới Google. Hãy thử lại sau.");
  }
  const type = res.headers.get("content-type") ?? "";
  if (res.status === 401 || res.status === 403 || res.status === 404 || type.includes("text/html") || /^\s*<(!doctype|html)/i.test(res.text)) throw new CsvError(NOT_PUBLIC);
  if (res.status !== 200) throw new CsvError("Google không trả dữ liệu. Hãy thử lại sau.");
  return res.text;
};

/** The table of a public Google Sheets tab. */
export const fetchSheetTable = async (link: string): Promise<Table> => tableFromText(await fetchGoogle(sheetExportUrl(link)));

/** The text of a public Google Doc. */
export const fetchDocText = async (link: string): Promise<{ id: string; text: string }> => {
  const { url, id } = docExportUrl(link);
  return { id, text: await fetchGoogle(url) };
};

/* ------------------------------------------------------------------ writing to the hub */

const existingIds = async (connectionId: string, entity: Entity): Promise<Set<string>> => {
  const db = supabaseAdmin();
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("data_records").select("external_id").eq("connection_id", connectionId).eq("entity", entity)
      .order("external_id").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Array<{ external_id: string }>) ids.add(r.external_id);
    if (!data || data.length < 1000) break;
  }
  return ids;
};

const countRows = async (connectionId: string): Promise<number> => {
  const { count } = await supabaseAdmin().from("data_records").select("id", { count: "exact", head: true }).eq("connection_id", connectionId);
  return count ?? 0;
};

export type CommitInput = {
  readonly workspaceId: string;
  readonly userId: string;
  /** Existing import to upload into; omitted = create a new one. */
  readonly connectionId?: string;
  readonly name: string;
  readonly config: CsvConfig;
  readonly records: ReadonlyArray<RecordInput>;
  readonly skipped: number;
  readonly file: string;
  /** Link sources: the schedule in minutes (null = manual). Undefined keeps the saved one. */
  readonly schedule?: number | null;
};
export type CommitResult = { connectionId: string; added: number; updated: number; skipped: number; total: number; summary: string };

/** Verifies the import belongs to the workspace and returns its saved meta. */
export const ownImport = async (workspaceId: string, connectionId: string) => {
  const { data } = await supabaseAdmin().from("connections").select("id, name, public_meta, sync_every_minutes")
    .eq("id", connectionId).eq("workspace_id", workspaceId).eq("provider", "csv_import").neq("status", "disconnected")
    .maybeSingle<{ id: string; name: string; public_meta: Record<string, string> | null; sync_every_minutes: number | null }>();
  if (!data) throw new CsvError("Không tìm thấy lần nhập này.");
  return data;
};

/** Writes the rows (insert or update by external id), records an `upload` run and updates the connection. */
export const commitRecords = async (input: CommitInput): Promise<CommitResult> => {
  const db = supabaseAdmin();
  const { workspaceId, config } = input;
  const entity = config.entity as Entity;
  const meta = { config: JSON.stringify(config), summary: "", file: input.file.slice(0, 200) };
  let connectionId = input.connectionId;
  let created = false;
  if (connectionId) await ownImport(workspaceId, connectionId);
  else {
    connectionId = await createDataConnection({
      workspaceId, userId: input.userId, provider: "csv_import", name: input.name, meta, credential: "{}",
      syncEveryMinutes: config.source === "sheet" ? (input.schedule ?? null) : null,
    });
    created = true;
  }
  const { data: run } = await db.from("data_sync_runs").insert({ workspace_id: workspaceId, connection_id: connectionId, trigger: "upload" }).select("id").single<{ id: string }>();
  try {
    const have = await existingIds(connectionId, entity);
    const updated = input.records.filter((r) => have.has(String(r.externalId))).length;
    const written = await upsertRecords(workspaceId, connectionId, entity, input.records);
    const total = await countRows(connectionId);
    const summary = summaryOf(config.entity, total);
    const now = new Date();
    const schedule = config.source === "sheet" && input.schedule !== undefined ? input.schedule : undefined;
    await db.from("connections").update({
      public_meta: { config: meta.config, summary, file: meta.file }, status: "connected", last_error: null,
      last_sync_at: now.toISOString(), last_event_at: now.toISOString(),
      ...(schedule !== undefined ? { sync_every_minutes: schedule, next_sync_at: schedule ? new Date(now.getTime() + schedule * 60_000).toISOString() : null } : {}),
    }).eq("id", connectionId).eq("workspace_id", workspaceId);
    if (run) await db.from("data_sync_runs").update({ status: "ok", finished_at: now.toISOString(), rows_upserted: written }).eq("id", run.id);
    return { connectionId, added: written - updated, updated, skipped: input.skipped, total, summary };
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    if (created) await db.from("connections").delete().eq("id", connectionId);
    else if (run) await db.from("data_sync_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: message }).eq("id", run.id);
    throw e;
  }
};

/** Mapping stored in a config -> the pieces buildRecords needs. */
export const mappingOf = (c: CsvConfig): CsvMapping => ({ idColumn: c.idColumn, titleColumn: c.titleColumn, dateColumn: c.dateColumn, kinds: c.kinds, columns: c.columns });

/* ------------------------------------------------------------------ the connector */

export const connector: Connector = {
  sync: async (ctx) => {
    const config = readConfig(ctx.connection.meta);
    if (!config || config.source !== "sheet" || !config.link) return { rows: 0, note: "Tải file mới để cập nhật" };
    const table = await fetchSheetTable(config.link);
    const missing = missingColumns(config, table.headers);
    if (missing.length) throw new CsvError(`Trang tính đã đổi tên hoặc mất cột: ${missing.join(", ")}. Mở lại lần nhập để chọn cột mới.`);
    const { records } = buildRecords(table, mappingOf(config));
    const have = await existingIds(ctx.connection.id, config.entity as Entity);
    const updated = records.filter((r) => have.has(String(r.externalId))).length;
    const rows = await ctx.upsert(config.entity as Entity, records);
    const summary = summaryOf(config.entity, await countRows(ctx.connection.id));
    return { rows, note: `Đã nhập ${rows - updated} dòng, cập nhật ${updated} dòng`, meta: { summary } };
  },
};
