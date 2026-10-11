import "server-only";
import { isIP } from "node:net";
import { assertPublicHost, type Connector, type Entity, type RecordInput } from "../data-hub";
import {
  DEFAULT_PORT, ENGINES, DB_ENTITIES, MAX_COLUMNS, MAX_ROWS, tableKey,
  type DbConfig, type DbEntity, type DbTarget, type Engine, type TableInfo, type TableMapping,
} from "@/features/connections/wizard/data/database/types";

/**
 * Database (PostgreSQL, MySQL, SQL Server), read only. The owner's SQL is never run: every statement here is a SELECT built from
 * the picked table and columns with quoted identifiers. The host is resolved once with assertPublicHost and the connection goes to
 * that address (the host name only travels as the TLS server name), the session is read only where the engine supports it, and
 * every call has a time limit.
 */

const CONNECT_MS = 10_000;
const QUERY_MS = 15_000;
const CURSOR = "__nivo_cursor";
const MAX_TABLES = 500;
const MAX_LISTED_COLUMNS = 20_000;

type Row = Record<string, unknown>;
export type Session = { readonly engine: Engine; readonly query: (sql: string, params?: ReadonlyArray<string>) => Promise<Row[]>; readonly close: () => Promise<void> };

/* ------------------------------------------------------------------ credential */

export const parseTarget = (raw: string): DbTarget => {
  let j: Partial<DbTarget>;
  try { j = JSON.parse(raw) as Partial<DbTarget>; } catch { throw new Error("Thông tin kết nối đã lưu bị hỏng; hãy mở lại và nhập lại mật khẩu."); }
  if (!j.engine || !ENGINES.includes(j.engine) || !j.host || !j.database || !j.user) throw new Error("Thông tin kết nối chưa đầy đủ.");
  return { engine: j.engine, host: j.host, port: Number(j.port) || DEFAULT_PORT[j.engine], database: j.database, user: j.user, password: j.password ?? "", ssl: j.ssl !== false };
};

/** Checks what the owner typed (shape only; reaching the server is the connection test). */
export const checkTarget = (t: DbTarget): string | null => {
  if (!ENGINES.includes(t.engine)) return "Loại cơ sở dữ liệu không hợp lệ.";
  if (!t.host.trim() || t.host.length > 253) return "Nhập địa chỉ máy chủ.";
  if (!Number.isInteger(t.port) || t.port < 1 || t.port > 65535) return "Cổng phải từ 1 đến 65535.";
  if (!t.database.trim() || t.database.length > 128) return "Nhập tên cơ sở dữ liệu.";
  if (!t.user.trim() || t.user.length > 128) return "Nhập tên người dùng.";
  if (t.password.length > 512) return "Mật khẩu quá dài.";
  return null;
};

/* ------------------------------------------------------------------ errors */

type DriverError = { name?: string; code?: string; errno?: number; message?: string; number?: number };

const errorText = (e: unknown): string => {
  const x = (e ?? {}) as DriverError;
  const msg = String(x.message ?? e);
  const code = String(x.code ?? "");
  if (x.name === "AbortError") return "Đã dừng vì hết thời gian đồng bộ.";
  if (code === "28P01" || code === "28000" || code === "ER_ACCESS_DENIED_ERROR" || x.errno === 1045 || code === "ELOGIN" || x.number === 18456 || /password authentication failed|Login failed/i.test(msg)) return "Sai mật khẩu hoặc người dùng.";
  if (code === "3D000" || code === "ER_BAD_DB_ERROR" || x.errno === 1049 || x.number === 4060 || /Unknown database|Cannot open database/i.test(msg) || (/database .* does not exist/i.test(msg))) return "Không tìm thấy cơ sở dữ liệu này trên máy chủ.";
  if (code === "57014" || code === "ER_QUERY_TIMEOUT" || x.errno === 3024 || /statement timeout|canceling statement|maximum statement execution time|Query read timeout/i.test(msg)) return "Câu truy vấn chạy quá 15 giây; hãy chọn ít cột hơn hoặc thêm cột cập nhật lúc.";
  if (code === "ETIMEDOUT" || code === "ETIMEOUT" || /timeout|timed out|Connection terminated/i.test(msg)) return "Không kết nối được tới máy chủ trong 10 giây.";
  if (code === "ECONNREFUSED") return "Máy chủ từ chối kết nối; kiểm tra cổng và tường lửa.";
  if (code === "ENOTFOUND") return "Không tìm thấy máy chủ.";
  if (code === "ECONNRESET") return "Máy chủ ngắt kết nối giữa chừng.";
  if (/does not support SSL|SSL/i.test(msg)) return "Máy chủ không chấp nhận kết nối mã hóa SSL; thử tắt SSL hoặc kiểm tra cấu hình máy chủ.";
  if (code === "42501" || code === "ER_TABLEACCESS_DENIED_ERROR" || x.errno === 1142 || x.number === 229) return "Người dùng không có quyền đọc bảng này.";
  if (code === "42P01" || code === "ER_NO_SUCH_TABLE" || x.errno === 1146 || x.number === 208) return "Bảng không còn tồn tại.";
  if (code === "42703" || code === "ER_BAD_FIELD_ERROR" || x.errno === 1054 || x.number === 207) return "Một cột đã chọn không còn tồn tại.";
  return `Không đọc được cơ sở dữ liệu: ${msg.replace(/\s+/g, " ").slice(0, 200)}`;
};

/** Our own plain-Vietnamese errors pass through; driver errors are translated. */
export const asPlainError = (e: unknown): Error => (e instanceof Error && e.cause === PLAIN ? e : new Error(errorText(e), { cause: PLAIN }));
const PLAIN = Symbol("plain");
const plainError = (message: string): Error => new Error(message, { cause: PLAIN });

/* ------------------------------------------------------------------ sessions */

const withTimeout = async <T,>(p: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<never>((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error("connect timeout"), { code: "ETIMEDOUT" })), ms); })]);
  } finally { if (timer) clearTimeout(timer); }
};

const tls = (t: DbTarget) => ({ rejectUnauthorized: false, ...(isIP(t.host) ? {} : { servername: t.host }) });

const openPostgres = async (t: DbTarget, address: string): Promise<Session> => {
  const pg = (await import("pg")).default;
  const client = new pg.Client({
    host: address, port: t.port, user: t.user, password: t.password, database: t.database,
    ssl: t.ssl ? tls(t) : false,
    connectionTimeoutMillis: CONNECT_MS, statement_timeout: QUERY_MS, query_timeout: QUERY_MS,
    options: "-c default_transaction_read_only=on",
  });
  client.on("error", () => undefined);
  await withTimeout(client.connect(), CONNECT_MS + 1_000);
  try {
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
  } catch (e) { await client.end().catch(() => undefined); throw e; }
  return {
    engine: "postgres",
    query: async (sql, params) => (await client.query(sql, params ? [...params] : undefined)).rows as Row[],
    close: () => client.end().catch(() => undefined),
  };
};

const openMysql = async (t: DbTarget, address: string): Promise<Session> => {
  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: address, port: t.port, user: t.user, password: t.password, database: t.database, connectTimeout: CONNECT_MS,
    ssl: t.ssl ? tls(t) : undefined,
    supportBigNumbers: true, bigNumberStrings: true, multipleStatements: false,
  });
  conn.on("error", () => undefined);
  try {
    await conn.query("SET SESSION TRANSACTION READ ONLY");
    await conn.query(`SET SESSION MAX_EXECUTION_TIME=${QUERY_MS}`).catch(() => undefined);
  } catch (e) { conn.destroy(); throw e; }
  return {
    engine: "mysql",
    query: async (sql, params) => {
      const [rows] = await conn.query({ sql, values: params ? [...params] : [], timeout: QUERY_MS });
      return Array.isArray(rows) ? (rows as unknown as Row[]) : [];
    },
    close: async () => { try { await conn.end(); } catch { conn.destroy(); } },
  };
};

const openMssql = async (t: DbTarget, address: string): Promise<Session> => {
  const mssql = (await import("mssql")).default;
  const pool = new mssql.ConnectionPool({
    server: address, port: t.port, user: t.user, password: t.password, database: t.database,
    connectionTimeout: CONNECT_MS, requestTimeout: QUERY_MS, pool: { max: 1, min: 0 },
    options: { encrypt: t.ssl, trustServerCertificate: true, readOnlyIntent: true, ...(t.ssl && !isIP(t.host) ? { serverName: t.host } : {}) },
  });
  pool.on("error", () => undefined);
  await withTimeout(pool.connect(), CONNECT_MS + 1_000);
  return {
    engine: "mssql",
    query: async (sql, params) => {
      const req = pool.request();
      (params ?? []).forEach((v, i) => req.input(`p${i}`, mssql.NVarChar, v));
      return (await req.query(sql)).recordset as unknown as Row[];
    },
    close: () => pool.close().catch(() => undefined),
  };
};

/** Resolves the host (refusing private addresses), connects to the returned address and opens a read only session. */
export const openSession = async (t: DbTarget): Promise<Session> => {
  const bad = checkTarget(t);
  if (bad) throw plainError(bad);
  const { address } = await assertPublicHost(t.host).catch((e: unknown) => { throw plainError(e instanceof Error ? e.message : "Địa chỉ máy chủ không hợp lệ."); });
  try {
    return t.engine === "postgres" ? await openPostgres(t, address) : t.engine === "mysql" ? await openMysql(t, address) : await openMssql(t, address);
  } catch (e) { throw asPlainError(e); }
};

/** Runs `fn` on a fresh session and always closes it. */
export const withSession = async <T,>(t: DbTarget, fn: (s: Session) => Promise<T>): Promise<T> => {
  const s = await openSession(t);
  try { return await fn(s); } catch (e) { throw asPlainError(e); } finally { await s.close(); }
};

/* ------------------------------------------------------------------ SQL (generated, never typed by the owner) */

export const quoteId = (engine: Engine, id: string): string => {
  if (!id || id.length > 200 || id.includes("\u0000")) throw plainError("Tên cột hoặc bảng không hợp lệ.");
  return engine === "mysql" ? `\`${id.replace(/`/g, "``")}\`` : engine === "mssql" ? `[${id.replace(/]/g, "]]")}]` : `"${id.replace(/"/g, '""')}"`;
};

const tableRef = (engine: Engine, m: Pick<TableMapping, "schema" | "table">): string => `${quoteId(engine, m.schema)}.${quoteId(engine, m.table)}`;
const castText = (engine: Engine, col: string): string =>
  engine === "mysql" ? `CAST(${col} AS CHAR)` : engine === "mssql" ? `CONVERT(nvarchar(40), ${col}, 126)` : `(${col})::text`;
const wanted = (m: TableMapping): string[] => [...new Set([m.idColumn, ...(m.titleColumn ? [m.titleColumn] : []), ...(m.updatedColumn ? [m.updatedColumn] : []), ...m.columns])];

/** SELECT of the mapped columns. `cursor` set means only rows whose updated-at is at or after it (re-reading the boundary row is harmless). */
export const buildSelect = (engine: Engine, m: TableMapping, opts: { limit: number; cursor?: string | null; ordered?: boolean }): { sql: string; params: string[] } => {
  const q = (c: string) => quoteId(engine, c);
  const cols = wanted(m).map(q);
  if (m.updatedColumn) cols.push(`${castText(engine, q(m.updatedColumn))} AS ${q(CURSOR)}`);
  const incremental = Boolean(m.updatedColumn && opts.cursor);
  const marker = engine === "postgres" ? "$1" : engine === "mysql" ? "?" : "@p0";
  const where = incremental ? ` WHERE ${q(m.updatedColumn)} >= ${marker}` : "";
  const order = opts.ordered === false ? "" : ` ORDER BY ${q(m.updatedColumn || m.idColumn)} ASC`;
  const n = Math.max(1, Math.min(Math.floor(opts.limit), MAX_ROWS));
  const from = ` FROM ${tableRef(engine, m)}${where}${order}`;
  const sql = engine === "mssql" ? `SELECT TOP (${n}) ${cols.join(", ")}${from}` : `SELECT ${cols.join(", ")}${from} LIMIT ${n}`;
  return { sql, params: incremental ? [opts.cursor as string] : [] };
};

/** Tables and views the user can see, with their columns. */
export const listTables = async (s: Session): Promise<TableInfo[]> => {
  const sql = s.engine === "postgres"
    ? `SELECT c.table_schema AS s, c.table_name AS t, c.column_name AS c, c.data_type AS d FROM information_schema.columns c JOIN information_schema.tables x ON x.table_schema = c.table_schema AND x.table_name = c.table_name WHERE x.table_type IN ('BASE TABLE','VIEW') AND c.table_schema NOT IN ('pg_catalog','information_schema') ORDER BY c.table_schema, c.table_name, c.ordinal_position LIMIT ${MAX_LISTED_COLUMNS}`
    : s.engine === "mysql"
      ? `SELECT c.TABLE_SCHEMA AS s, c.TABLE_NAME AS t, c.COLUMN_NAME AS c, c.DATA_TYPE AS d FROM information_schema.COLUMNS c JOIN information_schema.TABLES x ON x.TABLE_SCHEMA = c.TABLE_SCHEMA AND x.TABLE_NAME = c.TABLE_NAME WHERE x.TABLE_TYPE IN ('BASE TABLE','VIEW') AND c.TABLE_SCHEMA = DATABASE() ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION LIMIT ${MAX_LISTED_COLUMNS}`
      : `SELECT TOP (${MAX_LISTED_COLUMNS}) c.TABLE_SCHEMA AS s, c.TABLE_NAME AS t, c.COLUMN_NAME AS c, c.DATA_TYPE AS d FROM INFORMATION_SCHEMA.COLUMNS c JOIN INFORMATION_SCHEMA.TABLES x ON x.TABLE_SCHEMA = c.TABLE_SCHEMA AND x.TABLE_NAME = c.TABLE_NAME WHERE x.TABLE_TYPE IN ('BASE TABLE','VIEW') AND c.TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA','sys') ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`;
  const rows = await s.query(sql);
  const map = new Map<string, { schema: string; name: string; columns: Array<{ name: string; type: string }> }>();
  for (const r of rows) {
    const schema = String(r.s ?? r.S), name = String(r.t ?? r.T);
    const k = `${schema}\u0000${name}`;
    let t = map.get(k);
    if (!t) {
      if (map.size >= MAX_TABLES) continue;
      t = { schema, name, columns: [] };
      map.set(k, t);
    }
    if (t.columns.length < 300) t.columns.push({ name: String(r.c ?? r.C), type: String(r.d ?? r.D) });
  }
  return [...map.values()];
};

/* ------------------------------------------------------------------ values */

const MAX_TEXT = 4_000;
export const plain = (v: unknown): unknown => {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return Number.isFinite(v) ? v : String(v);
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT)}...` : v;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (v instanceof Uint8Array) return `[nhị phân ${v.byteLength} byte]`;
  try {
    const s = JSON.stringify(v);
    return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}...` : (JSON.parse(s) as unknown);
  } catch { return String(v).slice(0, MAX_TEXT); }
};

const asDate = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(typeof v === "string" && /^\d{4}-\d\d-\d\d \d/.test(v) ? v.replace(" ", "T") : (v as string | number));
  return Number.isNaN(d.getTime()) ? null : d;
};

const toRecord = (m: TableMapping, r: Row): RecordInput | null => {
  const id = r[m.idColumn];
  if (id === null || id === undefined || String(id) === "") return null;
  const data: Record<string, unknown> = {};
  for (const c of m.columns) data[c] = plain(r[c]);
  const titleRaw = m.titleColumn ? r[m.titleColumn] : null;
  return {
    externalId: String(id),
    title: titleRaw === null || titleRaw === undefined ? String(id) : String(plain(titleRaw)),
    occurredAt: m.updatedColumn ? asDate(r[m.updatedColumn]) : null,
    data,
  };
};

/** The first rows of a mapped table, as text, for the wizard preview. */
export const previewRows = async (s: Session, m: TableMapping, limit = 5): Promise<{ columns: string[]; rows: string[][] }> => {
  const { sql } = buildSelect(s.engine, { ...m, updatedColumn: "" }, { limit, ordered: false });
  const rows = await s.query(sql);
  const columns = wanted(m);
  return { columns, rows: rows.map((r) => columns.map((c) => { const v = plain(r[c]); return v === null ? "" : typeof v === "string" ? v.slice(0, 80) : JSON.stringify(v).slice(0, 80); })) };
};

/* ------------------------------------------------------------------ config */

const ident = (v: unknown): string => (typeof v === "string" && v.length > 0 && v.length <= 200 ? v : "");

/** Validates a mapping that came from the browser or from storage; returns a clean copy. */
export const cleanConfig = (raw: unknown): DbConfig => {
  const list = (raw as { tables?: unknown } | null)?.tables;
  if (!Array.isArray(list) || list.length === 0) throw plainError("Chọn ít nhất một bảng.");
  if (list.length > 100) throw plainError("Tối đa 100 bảng cho mỗi kết nối.");
  const seen = new Set<string>();
  const tables = (list as Array<Partial<TableMapping>>).map((x): TableMapping => {
    const schema = ident(x.schema), table = ident(x.table), idColumn = ident(x.idColumn);
    if (!table || !idColumn) throw plainError(`Bảng ${table || "(chưa đặt tên)"} cần một cột mã.`);
    const key = tableKey({ schema, table });
    if (seen.has(key)) throw plainError(`Bảng ${key} bị chọn hai lần.`);
    seen.add(key);
    const entity = DB_ENTITIES.includes(x.entity as DbEntity) ? (x.entity as DbEntity) : "other";
    const columns = [...new Set((Array.isArray(x.columns) ? x.columns : []).map(ident).filter(Boolean))].slice(0, MAX_COLUMNS);
    return { schema, table, entity, idColumn, titleColumn: ident(x.titleColumn), updatedColumn: ident(x.updatedColumn), columns };
  });
  return { tables };
};

export const summaryOf = (engine: Engine, tables: number): string => `${engine === "postgres" ? "PostgreSQL" : engine === "mysql" ? "MySQL" : "SQL Server"} · ${tables} bảng`;

/* ------------------------------------------------------------------ the connector */

export const connector: Connector = {
  sync: async (ctx) => {
    const target = parseTarget(ctx.credential);
    let config: DbConfig;
    try { config = cleanConfig(JSON.parse(ctx.connection.meta.config ?? "{}")); } catch { throw plainError("Chưa chọn bảng nào để đồng bộ, hoặc cấu hình bảng bị hỏng; hãy mở lại kết nối và lưu lại."); }
    const session = await openSession(target);
    const meta: Record<string, string> = {};
    const problems: string[] = [];
    let total = 0, done = 0;
    try {
      for (const m of config.tables) {
        if (ctx.signal.aborted) break;
        const key = `cursor:${tableKey(m)}`;
        try {
          const { sql, params } = buildSelect(session.engine, m, { limit: MAX_ROWS, cursor: ctx.connection.meta[key] });
          const rows = await session.query(sql, params);
          if (ctx.signal.aborted) break;
          const records = rows.map((r) => toRecord(m, r)).filter((r): r is RecordInput => r !== null);
          total += await ctx.upsert(m.entity as Entity, records);
          done++;
          const last = [...rows].reverse().find((r) => r[CURSOR] !== null && r[CURSOR] !== undefined);
          if (last) meta[key] = String(last[CURSOR]);
        } catch (e) {
          problems.push(`${tableKey(m)}: ${asPlainError(e).message}`);
        }
      }
    } finally {
      await session.close();
    }
    if (done === 0 && problems.length) throw plainError(problems[0] as string);
    return { rows: total, ...(problems.length ? { note: problems.join(" | ").slice(0, 400) } : {}), ...(Object.keys(meta).length ? { meta } : {}) };
  },
};
