/**
 * Inventory ("Kho & nhập hàng"): types and pure helpers shared by the server code and the workbench. No I/O, safe in client components.
 * Quantities are numbers in the item's BASE unit; other units carry a factor ("1 thùng = 24 chai").
 */

export type UnitConversion = { readonly unit: string; readonly factor: number };

export type InventoryItem = {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly unit: string;
  readonly units: ReadonlyArray<UnitConversion>;
  readonly category: string;
  readonly cost_vnd: number;
  readonly sell_price_vnd: number | null;
  readonly reorder_point: number;
  readonly reorder_qty: number;
  readonly supplier_id: string | null;
  readonly aliases: ReadonlyArray<string>;
  readonly active: boolean;
};

export type StockStatus = "out" | "low" | "ok" | "over";

/** Out: nothing left. Low: at or below the reorder point (only when one is set). Over: far above what is needed. */
export const stockStatus = (item: Pick<InventoryItem, "reorder_point" | "reorder_qty">, total: number): StockStatus => {
  if (total <= 0) return "out";
  if (item.reorder_point > 0 && total <= item.reorder_point) return "low";
  const ceiling = item.reorder_point > 0 ? item.reorder_point + 2 * (item.reorder_qty > 0 ? item.reorder_qty : item.reorder_point) : 0;
  return ceiling > 0 && total > ceiling ? "over" : "ok";
};

/** How much to order for an item at `total`: the usual order quantity, else enough to reach twice the reorder point. */
export const suggestOrderQty = (item: Pick<InventoryItem, "reorder_point" | "reorder_qty">, total: number): number => {
  if (item.reorder_qty > 0) return item.reorder_qty;
  return Math.max(1, Math.ceil(item.reorder_point * 2 - Math.max(total, 0)));
};

/** An adjustment this small is applied at once; a bigger one waits for the owner (the adjust_stock gate). */
export const SMALL_ADJUST_VND = 200_000;
export const SMALL_ADJUST_QTY_NO_COST = 5;
export const isSmallAdjustment = (delta: number, costVnd: number): boolean =>
  costVnd > 0 ? Math.abs(delta) * costVnd <= SMALL_ADJUST_VND : Math.abs(delta) <= SMALL_ADJUST_QTY_NO_COST;

export const PO_STATUSES = ["draft", "waiting_approval", "sent", "partially_received", "received", "cancelled"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];
export const isPoStatus = (v: unknown): v is PoStatus => typeof v === "string" && (PO_STATUSES as ReadonlyArray<string>).includes(v);
/** A purchase order that can still bring goods in. */
export const isOpenPo = (s: PoStatus): boolean => s === "draft" || s === "waiting_approval" || s === "sent" || s === "partially_received";

/* ------------------------------------------------------------------ numbers and text */

/** "1,5" and "1.5" both read as 1.5; "1.200" as 1200 (a dot followed by exactly three digits is a thousands separator); anything else NaN → fallback. */
export const num = (v: unknown, fallback = 0): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v !== "string") return fallback;
  let s = v.trim().replace(/\s/g, "").replace(/[₫đdD]$/u, "");
  if (!s) return fallback;
  if (/^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

export const formatQty = (n: number): string => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(n);
export const formatMoney = (n: number | null | undefined): string => (n === null || n === undefined ? "—" : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Math.round(n)));

/** Lowercase, no accents, letters and digits only: how names are compared ("Cà phê sữa" = "ca phe sua"). */
export const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* ------------------------------------------------------------------ reading an order's items */

export type OrderLine = { readonly raw: string; readonly qty: number; readonly name: string };

const SPLIT = /\r?\n|;|,(?!\d)| \+ | và /iu;
// "2 cà phê", "2x cà phê", "2 x cà phê", "2×cà phê"; the "x" is a multiplier only when it stands alone ("5 xe gạch" keeps "xe").
const LEAD_QTY = /^(\d+(?:[.,]\d+)?)\s*(?:[x×](?=[\s\d]|$)\s*)?(.+)$/iu;
const TRAIL_QTY = /^(.+?)(?:\s+x\s*|\s*[×*]\s*|\s*:\s*)(\d+(?:[.,]\d+)?)$/iu;

/** "2 cà phê sữa, bạc xỉu x3\n1 thùng bia" → lines with a quantity and the name part. A line without a number counts as 1. */
export const parseOrderLines = (text: string): Array<OrderLine> =>
  text.split(SPLIT).map((s) => s.replace(/^[\s\-•*]+/, "").trim()).filter(Boolean).map((raw): OrderLine => {
    const lead = LEAD_QTY.exec(raw);
    if (lead) return { raw, qty: num(lead[1], 1) || 1, name: lead[2].trim() };
    const trail = TRAIL_QTY.exec(raw);
    if (trail) return { raw, qty: num(trail[2], 1) || 1, name: trail[1].trim() };
    return { raw, qty: 1, name: raw };
  });

export type MatchRecipe = { readonly id: string; readonly name: string; readonly aliases: ReadonlyArray<string> };
export type MatchItem = Pick<InventoryItem, "id" | "sku" | "name" | "unit" | "units" | "aliases">;
export type LineMatch =
  | { readonly kind: "recipe"; readonly id: string; readonly qty: number }
  | { readonly kind: "item"; readonly id: string; readonly qty: number };

const GENERIC_UNIT_WORDS = new Set(["ly", "coc", "cai", "chai", "lon", "phan", "suat", "bao", "thung", "kg", "g", "hop", "goi", "tui", "cuon", "tam", "m", "m2", "m3", "lit", "l", "ml", "dĩa", "dia", "to", "chiec", "bo"]);

const scoreName = (needle: string, cand: string): number => {
  if (!cand) return 0;
  if (needle === cand) return 1000 + cand.length;
  if (cand.length >= 3 && ` ${needle} `.includes(` ${cand} `)) return 500 + cand.length;
  if (needle.length >= 4 && ` ${cand} `.includes(` ${needle} `)) return 100 + needle.length;
  return 0;
};

/** Match one order line against the recipes (a product made of ingredients) and the items. A unit word ("2 thùng bia") scales by the item's conversion. */
export const matchOrderLine = (line: OrderLine, recipes: ReadonlyArray<MatchRecipe>, items: ReadonlyArray<MatchItem>): LineMatch | null => {
  const full = fold(line.name);
  const words = full.split(" ");
  const secondaryUnits = new Set(items.flatMap((it) => it.units.map((u) => fold(u.unit))));
  const unitWord = GENERIC_UNIT_WORDS.has(words[0] ?? "") || secondaryUnits.has(words[0] ?? "") ? words[0] : "";
  const variants = unitWord ? [words.slice(1).join(" "), full] : [full];
  let best: { score: number; match: LineMatch } | null = null;
  const consider = (score: number, match: LineMatch) => {
    if (score > 0 && (!best || score > best.score)) best = { score, match };
  };
  for (const v of variants) {
    if (!v) continue;
    for (const r of recipes) {
      for (const n of [r.name, ...r.aliases]) {
        const sc = scoreName(v, fold(n));
        if (sc > 0) consider(sc + 1, { kind: "recipe", id: r.id, qty: line.qty }); // a recipe beats an item of the same name
      }
    }
    for (const it of items) {
      for (const n of [it.name, it.sku, ...it.aliases]) {
        const sc = scoreName(v, fold(n));
        if (sc <= 0) continue;
        const factor = unitWord && v !== full ? (it.units.find((u) => fold(u.unit) === unitWord)?.factor ?? 1) : 1;
        consider(sc, { kind: "item", id: it.id, qty: line.qty * factor });
      }
    }
    if (best) break;
  }
  return best ? (best as { score: number; match: LineMatch }).match : null;
};

/* ------------------------------------------------------------------ pasted tables (CSV / Excel) */

export type ImportRow = {
  readonly sku: string;
  readonly name: string;
  readonly unit: string;
  readonly category: string;
  readonly cost_vnd: number;
  readonly sell_price_vnd: number | null;
  readonly reorder_point: number;
  readonly reorder_qty: number;
  readonly qty: number | null;
  readonly supplier: string;
};

const FIELD_KEYS: Readonly<Record<string, ReadonlyArray<string>>> = {
  sku: ["ma", "ma hang", "sku", "ma sp", "ma vat tu"],
  name: ["ten", "ten hang", "ten hang hoa", "name", "san pham", "ten vat tu", "ten sp"],
  unit: ["don vi", "dvt", "unit", "don vi tinh"],
  category: ["nhom", "loai", "danh muc", "category", "nhom hang"],
  cost_vnd: ["gia von", "gia nhap", "don gia", "cost", "gia mua"],
  sell_price_vnd: ["gia ban", "gia", "price", "sell"],
  reorder_point: ["ton toi thieu", "muc toi thieu", "toi thieu", "min", "diem dat hang", "reorder"],
  reorder_qty: ["so luong nhap", "luong nhap", "nhap moi lan", "reorder qty", "so luong dat"],
  qty: ["ton", "ton kho", "so luong", "ton dau", "qty", "ton hien tai"],
  supplier: ["nha cung cap", "ncc", "supplier", "nguon"],
};
const DEFAULT_ORDER = ["sku", "name", "unit", "category", "cost_vnd", "sell_price_vnd", "reorder_point", "reorder_qty", "qty", "supplier"] as const;
type FieldKey = (typeof DEFAULT_ORDER)[number];

const splitCells = (line: string): Array<string> => {
  const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  const cells: Array<string> = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) { cells.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
};

/** Pasted rows from a sheet or CSV. A first row that names columns ("Tên", "Đơn vị", "Tồn tối thiểu"...) maps them; otherwise the order is sku, name, unit, category, cost, price, min, order qty, stock, supplier. */
export const parseItemTable = (text: string): { rows: Array<ImportRow>; skipped: Array<string> } => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rows: [], skipped: [] };
  const first = splitCells(lines[0]).map(fold);
  const mapped = first.map((h): FieldKey | null => (Object.entries(FIELD_KEYS).find(([, keys]) => keys.includes(h))?.[0] as FieldKey | undefined) ?? null);
  const hasHeader = mapped.filter(Boolean).length >= 2;
  const order: Array<FieldKey | null> = hasHeader ? mapped : [...DEFAULT_ORDER];
  const rows: Array<ImportRow> = [];
  const skipped: Array<string> = [];
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cells = splitCells(line);
    const g = (k: FieldKey): string => {
      const i = order.indexOf(k);
      return i >= 0 ? (cells[i] ?? "") : "";
    };
    const name = g("name");
    if (!name) { skipped.push(line); continue; }
    const price = g("sell_price_vnd");
    const qty = g("qty");
    rows.push({
      sku: g("sku"), name, unit: g("unit") || "cái", category: g("category"), cost_vnd: Math.max(0, num(g("cost_vnd"))),
      sell_price_vnd: price ? Math.max(0, num(price)) : null, reorder_point: Math.max(0, num(g("reorder_point"))), reorder_qty: Math.max(0, num(g("reorder_qty"))),
      qty: qty ? num(qty) : null, supplier: g("supplier"),
    });
  }
  return { rows, skipped };
};

/** A stable short SKU from a name when the sheet has none: "Cà phê hạt" → "CA-PHE-HAT". */
export const skuFromName = (name: string): string => fold(name).split(" ").filter(Boolean).slice(0, 4).join("-").toUpperCase().slice(0, 24) || "HANG";

/** The order message every supplier gets when OpenClaw cannot be reached: plain and polite. */
export const fallbackOrderMessage = (a: {
  readonly shop: string; readonly supplier: string; readonly contact: string; readonly lines: ReadonlyArray<{ readonly name: string; readonly qty: number; readonly unit: string }>; readonly expected: string | null;
}): string => {
  const hello = a.contact ? `Chào ${a.contact}` : `Chào ${a.supplier}`;
  const list = a.lines.map((l) => `- ${l.name}: ${formatQty(l.qty)} ${l.unit}`).join("\n");
  return `${hello}, ${a.shop} gửi đơn nhập hàng như sau:\n${list}\n${a.expected ? `Mong bên mình giao trước ngày ${a.expected}.\n` : ""}Nhờ bên mình xác nhận giúp và báo lại nếu thiếu hàng hoặc đổi giá. Cảm ơn bạn.`;
};
