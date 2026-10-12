"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "../permissions";
import { supabaseAdmin } from "../supabase/admin";
import type { Outcome } from "../types";
import { commitRecords, docExportUrl, fetchDocText, fetchSheetTable, isSchedule, mappingOf, ownImport, readConfig } from "./csv-import";
import { recordFromDocument, recordFromGoogleDoc } from "@/features/connections/wizard/data/csv/docs";
import {
  buildRecords, cleanMapping, CsvError, missingColumns, suggestMapping, tableFromFile, tableFromGrid, tableFromText, type Table,
} from "@/features/connections/wizard/data/csv/table";
import {
  MAX_FILE_BYTES, MAX_ROWS, TABLE_ENTITIES, type CsvConfig, type CsvEntity, type CsvImportResult, type CsvMapping, type CsvPreview, type CsvSavedImport,
} from "@/features/connections/wizard/data/csv/types";

/**
 * Server actions of the csv_import wizard (owner only, scoped to the caller's workspace). Files, links and pasted text are all
 * parsed here, never in the browser: 10 MB per file, 20,000 rows, only .csv .xlsx (tables) and .docx .pdf .txt .md (documents).
 */

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof CsvError) return { ok: false, error: e.message };
    console.error("csv import error", e instanceof Error ? e.message : e);
    return { ok: false, error: "Không nhập được dữ liệu. Hãy thử lại." };
  }
};

const text = (f: FormData, key: string, max = 4_000): string => {
  const v = f.get(key);
  return typeof v === "string" ? v.slice(0, max) : "";
};

const fileOf = async (f: FormData, key = "file"): Promise<{ name: string; bytes: Uint8Array } | null> => {
  const v = f.get(key);
  if (!(v instanceof File) || v.size === 0) return null;
  if (v.size > MAX_FILE_BYTES) throw new CsvError("File lớn hơn 10 MB.");
  return { name: v.name, bytes: new Uint8Array(await v.arrayBuffer()) };
};

const json = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** The table of the chosen source: file | sheet (Google Sheets link) | paste (text copied from Excel) | grid (rows typed in). */
const readTable = async (f: FormData): Promise<{ table: Table; kind: "file" | "sheet" | "manual"; label: string; link?: string }> => {
  const kind = text(f, "kind");
  if (kind === "file") {
    const file = await fileOf(f);
    if (!file) throw new CsvError("Hãy chọn một file .csv hoặc .xlsx.");
    return { table: await tableFromFile(file.name, file.bytes, text(f, "sheet", 200) || undefined), kind: "file", label: file.name };
  }
  if (kind === "sheet") {
    const link = text(f, "link", 600).trim();
    return { table: await fetchSheetTable(link), kind: "sheet", label: "Google Sheets", link };
  }
  if (kind === "paste") {
    const raw = text(f, "text", MAX_FILE_BYTES);
    if (!raw.trim()) throw new CsvError("Hãy dán bảng dữ liệu vào ô.");
    return { table: tableFromText(raw), kind: "manual", label: "Nhập tay" };
  }
  if (kind === "grid") {
    const g = json(text(f, "grid", MAX_FILE_BYTES)) as { headers?: unknown; rows?: unknown } | null;
    const headers = Array.isArray(g?.headers) ? g.headers.map((h) => String(h ?? "").slice(0, 120)) : [];
    const rows = Array.isArray(g?.rows) ? g.rows.slice(0, MAX_ROWS + 1).map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "").slice(0, 5000)) : [])) : [];
    if (headers.every((h) => !h.trim())) throw new CsvError("Hãy đặt tên cho ít nhất một cột.");
    return { table: tableFromGrid(headers, rows), kind: "manual", label: "Nhập tay" };
  }
  throw new CsvError("Nguồn dữ liệu không hợp lệ.");
};

const entityOf = (raw: string): Exclude<CsvEntity, "document"> => {
  if (!(TABLE_ENTITIES as ReadonlyArray<string>).includes(raw)) throw new CsvError("Hãy chọn loại dữ liệu.");
  return raw as Exclude<CsvEntity, "document">;
};

const cleanName = (raw: string): string => {
  const n = raw.trim().replace(/\s+/g, " ").slice(0, 60);
  if (n.length < 2) throw new CsvError("Hãy đặt tên cho lần nhập này (ít nhất 2 ký tự).");
  return n;
};

/* ------------------------------------------------------------------ resume */

/** The saved setup of one import (to upload again into it). */
export const loadCsvImport = async (connectionId: string): Promise<Outcome<CsvSavedImport>> =>
  run(async () => {
    const member = await requireOwner();
    const c = await ownImport(member.workspaceId, connectionId);
    const config = readConfig(c.public_meta);
    if (!config) throw new CsvError("Lần nhập này chưa có cách đọc cột được lưu. Hãy tạo lần nhập mới.");
    const { data } = await supabaseAdmin().from("agent_connections").select("agent_id").eq("connection_id", connectionId).eq("workspace_id", member.workspaceId);
    return {
      name: c.name, config, file: c.public_meta?.file ?? "", summary: c.public_meta?.summary ?? "",
      agentIds: ((data ?? []) as Array<{ agent_id: string }>).map((r) => r.agent_id), scheduleMinutes: c.sync_every_minutes,
    };
  });

/* ------------------------------------------------------------------ preview */

/**
 * Reads the chosen source and returns its headers, the first 10 rows, the row count and a suggested mapping. With `connectionId`
 * (upload again) the saved mapping is reused and `missing` lists the saved columns this data no longer has.
 */
export const previewCsvSource = async (form: FormData): Promise<Outcome<CsvPreview>> =>
  run(async () => {
    const member = await requireOwner();
    const connectionId = text(form, "connectionId", 60);
    const saved = connectionId ? readConfig((await ownImport(member.workspaceId, connectionId)).public_meta) : null;
    const entity = saved ? (saved.entity as CsvEntity) : entityOf(text(form, "entity", 30));
    const { table } = await readTable(form);
    let mapping: CsvMapping = suggestMapping(table, entity);
    let missing: string[] = [];
    if (saved) {
      missing = missingColumns(saved, table.headers);
      const keep = (c: string | null) => (c && table.headers.includes(c) ? c : null);
      const fresh = mapping;
      mapping = {
        idColumn: keep(saved.idColumn) ?? (saved.idColumn ? fresh.idColumn : null),
        titleColumn: keep(saved.titleColumn) ?? fresh.titleColumn,
        dateColumn: keep(saved.dateColumn) ?? (saved.dateColumn ? fresh.dateColumn : null),
        kinds: Object.fromEntries(table.headers.map((h) => [h, saved.kinds[h] ?? fresh.kinds[h] ?? "text"])),
        columns: table.headers,
      };
    }
    return {
      headers: table.headers, sample: table.rows.slice(0, 10), total: table.rows.length,
      sheets: table.sheets, sheet: table.sheet, delimiter: table.delimiter, mapping, missing,
    };
  });

/* ------------------------------------------------------------------ import */

const done = (r: CsvImportResult): CsvImportResult => {
  revalidatePath("/", "layout");
  return r;
};

/** Imports a table source (file, Google Sheets link, pasted or typed rows) with the chosen mapping. */
export const runCsvImport = async (form: FormData): Promise<Outcome<CsvImportResult>> =>
  run(async () => {
    const member = await requireOwner();
    const connectionId = text(form, "connectionId", 60) || undefined;
    const saved = connectionId ? readConfig((await ownImport(member.workspaceId, connectionId)).public_meta) : null;
    if (connectionId && !saved) throw new CsvError("Lần nhập này chưa có cách đọc cột được lưu. Hãy tạo lần nhập mới.");
    const entity = saved ? (saved.entity as Exclude<CsvEntity, "document">) : entityOf(text(form, "entity", 30));
    const name = saved ? "" : cleanName(text(form, "name", 200));
    const { table, kind, label, link } = await readTable(form);
    const mapping = cleanMapping(json(text(form, "mapping", 100_000)), table.headers);
    const scheduleRaw = form.get("schedule");
    const schedule = kind === "sheet" && typeof scheduleRaw === "string" && scheduleRaw !== "" ? Number(scheduleRaw) : kind === "sheet" ? null : undefined;
    if (schedule !== undefined && !isSchedule(schedule)) throw new CsvError("Lịch cập nhật không hợp lệ.");
    const config: CsvConfig = {
      v: 1, source: kind === "manual" ? "manual" : kind, entity, ...mapping,
      ...(table.sheet ? { sheet: table.sheet } : {}), ...(link ? { link } : {}),
    };
    if (saved && saved.source !== config.source) throw new CsvError("Lần nhập này dùng nguồn khác. Hãy tạo lần nhập mới.");
    const built = buildRecords(table, mappingOf(config));
    if (built.records.length === 0) throw new CsvError("Không có dòng nào để nhập. Kiểm tra cột mã và dữ liệu.");
    return done(await commitRecords({
      workspaceId: member.workspaceId, userId: member.userId, connectionId, name, config, records: built.records,
      skipped: built.skipped, file: label, schedule,
    }));
  });

/** Imports documents: uploaded .docx .pdf .txt .md files and/or one Google Docs link, as `document` rows. */
export const runDocumentImport = async (form: FormData): Promise<Outcome<CsvImportResult>> =>
  run(async () => {
    const member = await requireOwner();
    const connectionId = text(form, "connectionId", 60) || undefined;
    const saved = connectionId ? readConfig((await ownImport(member.workspaceId, connectionId)).public_meta) : null;
    if (connectionId && saved?.source !== "document") throw new CsvError("Lần nhập này không phải lần nhập tài liệu.");
    const name = saved ? "" : cleanName(text(form, "name", 200));
    const files = form.getAll("files").filter((v): v is File => v instanceof File && v.size > 0).slice(0, 20);
    const link = text(form, "link", 600).trim();
    if (files.length === 0 && !link) throw new CsvError("Hãy chọn file tài liệu hoặc dán đường liên kết Google Docs.");
    const records = [];
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) throw new CsvError(`${f.name.slice(0, 80)}: lớn hơn 10 MB.`);
      records.push(await recordFromDocument(f.name, new Uint8Array(await f.arrayBuffer())));
    }
    if (link) {
      const doc = await fetchDocText(link);
      records.push(recordFromGoogleDoc(doc.id, doc.text));
    }
    const config: CsvConfig = { v: 1, source: "document", entity: "document", idColumn: null, titleColumn: null, dateColumn: null, kinds: {}, columns: [], ...(link ? { link: docExportUrl(link) && link } : {}) };
    const label = [...files.map((f) => f.name), ...(link ? ["Google Docs"] : [])].join(", ").slice(0, 200);
    return done(await commitRecords({
      workspaceId: member.workspaceId, userId: member.userId, connectionId, name, config, records, skipped: 0, file: label,
    }));
  });
