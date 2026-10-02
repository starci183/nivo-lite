/**
 * "Nhập nhanh": plain-text lines -> positions, staff and coverage blocks. Pure (client previews it, the server applies it).
 *   Vị trí:     one per line or comma separated:                    Pha chế, Phục vụ, Thu ngân
 *   Nhân viên:  Tên; vị trí, vị trí; lương mỗi giờ; giờ tối đa mỗi tuần          An; pha chế, phục vụ; 30k; 40
 *   Nhu cầu:    ngày giờ vị trí tối thiểu[-lý tưởng] [cao điểm]            T2-T6 07:00-11:00 Pha chế 1-2
 * Days: T2..T7, CN, a range (T2-T6), a list (T2,T4,T6), or "mọi ngày" / "hàng ngày".
 */
export type ParsedStaff = { readonly name: string; readonly positions: ReadonlyArray<string>; readonly wage: number; readonly maxWeek: number | null };
export type ParsedBlock = { readonly weekday: number; readonly start: string; readonly end: string; readonly position: string; readonly min: number; readonly ideal: number; readonly peak: boolean };
export type ParsedImport = {
  readonly positions: ReadonlyArray<string>;
  readonly staff: ReadonlyArray<ParsedStaff>;
  readonly blocks: ReadonlyArray<ParsedBlock>;
  readonly errors: ReadonlyArray<string>;
};

export const fold = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();

const DAY_TOKENS: Readonly<Record<string, number>> = { t2: 0, t3: 1, t4: 2, t5: 3, t6: 4, t7: 5, cn: 6, "thu 2": 0, "thu 3": 1, "thu 4": 2, "thu 5": 3, "thu 6": 4, "thu 7": 5, "chu nhat": 6 };

const parseDays = (raw: string): Array<number> | null => {
  const t = fold(raw).replace(/\s+/g, "");
  if (["moingay", "hangngay", "t2-cn", "t2-t7-cn"].includes(t)) return [0, 1, 2, 3, 4, 5, 6];
  const out = new Set<number>();
  for (const part of t.split(",")) {
    const m = /^(t[2-7]|cn)(?:-(t[2-7]|cn))?$/.exec(part);
    if (!m) return null;
    const a = DAY_TOKENS[m[1]];
    const b = m[2] ? DAY_TOKENS[m[2]] : a;
    if (b < a) return null;
    for (let d = a; d <= b; d++) out.add(d);
  }
  return out.size ? [...out].sort() : null;
};

const hm = (s: string): string | null => {
  const m = /^(\d{1,2})(?:[:h](\d{2})?)?$/.exec(s.trim().toLowerCase());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = m[2] ? Number(m[2]) : 0;
  return h < 24 && mi < 60 ? `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}` : null;
};

export const parseWage = (raw: string): number | null => {
  const t = raw.toLowerCase().replace(/\s|đ|vnd|\/h|\/giờ/g, "");
  const k = /^(\d+(?:[.,]\d+)?)k$/.exec(t);
  if (k) return Math.round(Number(k[1].replace(",", ".")) * 1000);
  const n = Number(t.replace(/[.,](?=\d{3}\b)/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

export const parseImport = (input: { positions: string; staff: string; coverage: string }, knownPositions: ReadonlyArray<string> = []): ParsedImport => {
  const errors: Array<string> = [];
  const positions: Array<string> = [];
  for (const raw of input.positions.split(/[\n,;]/)) {
    const name = raw.trim();
    if (name && !positions.some((p) => fold(p) === fold(name))) positions.push(name);
  }
  const all = [...knownPositions, ...positions];
  const has = (name: string) => all.some((p) => fold(p) === fold(name));
  const canon = (name: string) => all.find((p) => fold(p) === fold(name)) ?? name;

  const staff: Array<ParsedStaff> = [];
  input.staff.split("\n").forEach((line, i) => {
    const l = line.trim();
    if (!l) return;
    const parts = l.split(/[;|\t]/).map((x) => x.trim());
    if (parts.length < 2 || !parts[0]) return void errors.push(`Nhân viên dòng ${i + 1}: cần "Tên; vị trí; lương mỗi giờ; giờ tối đa mỗi tuần".`);
    const pos = (parts[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const unknown = pos.filter((p) => !has(p));
    if (!pos.length || unknown.length) return void errors.push(`Nhân viên dòng ${i + 1} (${parts[0]}): ${unknown.length ? `chưa có vị trí "${unknown.join(", ")}"` : "thiếu vị trí"}.`);
    const wage = parts[2] ? parseWage(parts[2]) : 0;
    if (wage === null) return void errors.push(`Nhân viên dòng ${i + 1} (${parts[0]}): lương "${parts[2]}" chưa đúng (ví dụ 30k hoặc 30000).`);
    const maxWeek = parts[3] ? Number(parts[3].replace(",", ".")) : null;
    if (maxWeek !== null && (!Number.isFinite(maxWeek) || maxWeek <= 0 || maxWeek > 100)) return void errors.push(`Nhân viên dòng ${i + 1} (${parts[0]}): giờ tối đa mỗi tuần chưa đúng.`);
    staff.push({ name: parts[0], positions: pos.map(canon), wage, maxWeek });
  });

  const blocks: Array<ParsedBlock> = [];
  input.coverage.split("\n").forEach((line, i) => {
    let l = line.trim();
    if (!l) return;
    const bad = (why: string) => void errors.push(`Nhu cầu dòng ${i + 1}: ${why}`);
    const peak = /(cao điểm|cao diem|peak)\s*$/i.test(l);
    l = l.replace(/(cao điểm|cao diem|peak)\s*$/i, "").trim();
    const m = /^(.+?)\s+(\d{1,2}(?:[:h]\d{2})?)\s*[-–]\s*(\d{1,2}(?:[:h]\d{2})?)\s+(.+?)\s+(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/.exec(l);
    if (!m) return bad('cần "ngày giờ vị trí tối thiểu-lý tưởng", ví dụ T2-T6 07:00-11:00 Pha chế 1-2.');
    const days = parseDays(m[1]);
    const s = hm(m[2]);
    const e = hm(m[3]);
    if (!days) return bad(`ngày "${m[1]}" chưa đúng (T2, T2-T6, T2,T4, CN, mọi ngày).`);
    if (!s || !e || s >= e) return bad("giờ bắt đầu phải trước giờ kết thúc (ví dụ 07:00-11:00).");
    if (!has(m[4])) return bad(`chưa có vị trí "${m[4]}".`);
    const min = Number(m[5]);
    const ideal = m[6] ? Number(m[6]) : min;
    if (ideal < min) return bad("số người lý tưởng không được ít hơn tối thiểu.");
    for (const d of days) blocks.push({ weekday: d, start: s, end: e, position: canon(m[4]), min, ideal, peak });
  });
  return { positions, staff, blocks, errors };
};

export const POSITION_COLORS = ["#2f6fed", "#e8590c", "#2b8a3e", "#ae3ec9", "#0c8599", "#c2255c", "#5c7cfa", "#e67700"] as const;
