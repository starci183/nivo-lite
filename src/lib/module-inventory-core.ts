import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logDecision, logEvidence } from "./core";
import { runWork, type EngineCtx } from "./engine";
import { isEmailAddress } from "./email/send";
import { generateWithOpenClaw } from "./openclaw-generate";
import {
  fallbackOrderMessage, formatMoney, formatQty, isOpenPo, matchOrderLine, parseOrderLines, stockStatus, suggestOrderQty,
  type InventoryItem, type MatchItem, type MatchRecipe, type PoStatus,
} from "./module-inventory-shared";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Inventory server code: the movements (the one way a quantity changes), selling out of stock (finished goods or recipe ingredients), the low-stock check,
 * purchase orders and receiving goods. Writes use the service role AFTER the caller checked the session or the signed trigger; every function takes the
 * workspace id and scopes by it. Nothing here talks to a supplier: sending goes through the send_purchase_order gate (module-inventory-performers.ts).
 */
export type Db = SupabaseClient;
export const admin = (): Db => supabaseAdmin();
const num = (v: unknown): number => Number(v) || 0;
const NIVO = "NIVO";

export type ItemRow = Omit<InventoryItem, "cost_vnd" | "sell_price_vnd" | "reorder_point" | "reorder_qty" | "units" | "aliases"> & {
  cost_vnd: number | string; sell_price_vnd: number | string | null; reorder_point: number | string; reorder_qty: number | string;
  units: Array<{ unit: string; factor: number }> | null; aliases: Array<string> | null;
};
export const toItem = (r: ItemRow): InventoryItem => ({
  ...r, cost_vnd: num(r.cost_vnd), sell_price_vnd: r.sell_price_vnd === null ? null : num(r.sell_price_vnd), reorder_point: num(r.reorder_point), reorder_qty: num(r.reorder_qty),
  units: (r.units ?? []).filter((u) => u && u.unit && num(u.factor) > 0).map((u) => ({ unit: String(u.unit), factor: num(u.factor) })), aliases: r.aliases ?? [],
});

/** A line in Office from NIVO. */
export const officeNote = async (db: Db, ws: string, body: string, workItemId: string | null = null): Promise<void> => {
  await db.from("messages").insert({ workspace_id: ws, author_kind: "system", author_name: NIVO, agent_id: null, body, lead_id: null, work_item_id: workItemId });
};

export const shopName = async (db: Db, ws: string): Promise<string> =>
  (((await db.from("workspaces").select("name").eq("id", ws).maybeSingle()).data ?? null) as { name: string } | null)?.name ?? "NIVO";

/** The default location, created ("Kho chính") when the workspace has none yet. */
export const defaultLocation = async (db: Db, ws: string): Promise<string> => {
  const found = ((await db.from("inventory_locations").select("id, is_default").eq("workspace_id", ws).order("is_default", { ascending: false }).order("created_at").limit(1)).data ?? [])[0] as { id: string } | undefined;
  if (found) return found.id;
  const made = await db.from("inventory_locations").insert({ workspace_id: ws, name: "Kho chính", is_default: true }).select("id").single();
  if (made.error) {
    const again = ((await db.from("inventory_locations").select("id").eq("workspace_id", ws).limit(1)).data ?? [])[0] as { id: string } | undefined;
    if (again) return again.id;
    throw new Error(made.error.message);
  }
  return (made.data as { id: string }).id;
};

/* ------------------------------------------------------------------ movements */

export type Movement = {
  readonly itemId: string;
  readonly locationId?: string;
  readonly kind: "in" | "out" | "adjust" | "transfer";
  /** Signed, in the item's base unit. */
  readonly delta: number;
  readonly reason: string;
  readonly refType?: "manual" | "order" | "po" | "count" | "import" | "transfer";
  readonly refId?: string | null;
  readonly refLabel?: string | null;
  readonly by?: string;
  readonly evidence?: string | null;
  readonly dedupe?: string | null;
  readonly unitCost?: number | null;
};
export type Applied = { readonly applied: boolean; readonly before: number; readonly after: number; readonly cost: number };

/** Apply one movement through inventory_apply_movement (row-locked, idempotent by `dedupe`). */
export const applyMovement = async (db: Db, ws: string, m: Movement): Promise<Applied> => {
  const loc = m.locationId ?? (await defaultLocation(db, ws));
  const { data, error } = await db.rpc("inventory_apply_movement", {
    p_ws: ws, p_item: m.itemId, p_loc: loc, p_kind: m.kind, p_delta: m.delta, p_reason: m.reason, p_ref_type: m.refType ?? "manual", p_ref_id: m.refId ?? null,
    p_ref_label: m.refLabel ?? null, p_by: m.by ?? NIVO, p_evidence: m.evidence ?? null, p_dedupe: m.dedupe ?? null, p_unit_cost: m.unitCost ?? null,
  });
  if (error) throw new Error(error.message);
  const r = data as { applied: boolean; before?: number; after?: number; cost?: number };
  return { applied: r.applied, before: num(r.before), after: num(r.after), cost: num(r.cost) };
};

/** Total stock of each item across all locations. */
export const totalsOf = async (db: Db, ws: string, itemIds?: ReadonlyArray<string>): Promise<Map<string, number>> => {
  let q = db.from("inventory_stock_levels").select("item_id, qty").eq("workspace_id", ws);
  if (itemIds) q = q.in("item_id", [...itemIds]);
  const out = new Map<string, number>();
  for (const r of ((await q).data ?? []) as Array<{ item_id: string; qty: number | string }>) out.set(r.item_id, (out.get(r.item_id) ?? 0) + num(r.qty));
  return out;
};

/* ------------------------------------------------------------------ selling: a confirmed order takes stock out */

export type DeductResult = { readonly deducted: Array<{ itemId: string; name: string; qty: number; unit: string; after: number }>; readonly unmatched: Array<string> };

/**
 * A confirmed order takes its goods out of stock: a line that matches a recipe takes the recipe's ingredients (per product), a line that matches an item
 * takes the item (a unit word such as "thùng" scales by the item's conversion). One movement per item per order (deduped), so a repeated event never deducts twice.
 * A line that matches nothing is reported, never guessed.
 */
export const deductForOrder = async (db: Db, ws: string, o: { readonly orderId: string; readonly orderNo: string; readonly items: string }): Promise<DeductResult> => {
  const [itemRows, recipeRows, lineRows] = await Promise.all([
    db.from("inventory_items").select("*").eq("workspace_id", ws).eq("active", true),
    db.from("inventory_recipes").select("id, name, aliases").eq("workspace_id", ws).eq("active", true),
    db.from("inventory_recipe_lines").select("recipe_id, item_id, qty").eq("workspace_id", ws),
  ]);
  const items = ((itemRows.data ?? []) as Array<ItemRow>).map(toItem);
  const byId = new Map(items.map((i) => [i.id, i]));
  const recipes = ((recipeRows.data ?? []) as Array<{ id: string; name: string; aliases: Array<string> | null }>).map((r): MatchRecipe => ({ id: r.id, name: r.name, aliases: r.aliases ?? [] }));
  const recipeLines = new Map<string, Array<{ item_id: string; qty: number }>>();
  for (const l of (lineRows.data ?? []) as Array<{ recipe_id: string; item_id: string; qty: number | string }>) {
    recipeLines.set(l.recipe_id, [...(recipeLines.get(l.recipe_id) ?? []), { item_id: l.item_id, qty: num(l.qty) }]);
  }
  const catalog: Array<MatchItem> = items;
  const take = new Map<string, number>();
  const unmatched: Array<string> = [];
  for (const line of parseOrderLines(o.items)) {
    const m = matchOrderLine(line, recipes, catalog) ?? (line.raw !== line.name ? matchOrderLine({ raw: line.raw, qty: 1, name: line.raw }, recipes, catalog) : null);
    if (!m) { unmatched.push(line.raw); continue; }
    if (m.kind === "item") take.set(m.id, (take.get(m.id) ?? 0) + m.qty);
    else for (const rl of recipeLines.get(m.id) ?? []) take.set(rl.item_id, (take.get(rl.item_id) ?? 0) + rl.qty * m.qty);
  }
  const deducted: DeductResult["deducted"] = [];
  const loc = await defaultLocation(db, ws);
  for (const [itemId, qty] of take) {
    const item = byId.get(itemId);
    if (!item || qty <= 0) continue;
    const r = await applyMovement(db, ws, {
      itemId, locationId: loc, kind: "out", delta: -qty, reason: `Bán hàng: đơn ${o.orderNo}`, refType: "order", refId: o.orderId, refLabel: o.orderNo,
      by: NIVO, evidence: o.items.slice(0, 300), dedupe: `order:${o.orderId}:${itemId}`,
    });
    if (r.applied) deducted.push({ itemId, name: item.name, qty, unit: item.unit, after: r.after });
  }
  return { deducted, unmatched };
};

/* ------------------------------------------------------------------ low stock → draft purchase orders */

export type LowItem = { readonly item: InventoryItem; readonly total: number; readonly status: "out" | "low" };

/** Items at or below their reorder point (an item with no reorder point is only low when it is out and was ever stocked). */
export const lowItems = async (db: Db, ws: string, itemIds?: ReadonlyArray<string>): Promise<Array<LowItem>> => {
  let q = db.from("inventory_items").select("*").eq("workspace_id", ws).eq("active", true);
  if (itemIds) q = q.in("id", [...itemIds]);
  const items = ((await q).data ?? []) as Array<ItemRow>;
  const totals = await totalsOf(db, ws, itemIds ?? items.map((i) => i.id));
  const out: Array<LowItem> = [];
  for (const row of items) {
    const item = toItem(row);
    if (item.reorder_point <= 0) continue;
    const total = totals.get(item.id) ?? 0;
    const s = stockStatus(item, total);
    if (s === "out" || s === "low") out.push({ item, total, status: s });
  }
  return out;
};

const poNo = async (db: Db, ws: string): Promise<string> => {
  const d = new Date();
  const prefix = `PO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-`;
  const last = ((await db.from("inventory_purchase_orders").select("po_no").eq("workspace_id", ws).like("po_no", `${prefix}%`).order("po_no", { ascending: false }).limit(1)).data ?? [])[0] as { po_no: string } | undefined;
  const n = last ? Number(last.po_no.slice(prefix.length)) || 0 : 0;
  return `${prefix}${String(n + 1).padStart(4, "0")}`;
};

export const recomputeTotal = async (db: Db, poId: string): Promise<number> => {
  const lines = ((await db.from("inventory_po_lines").select("qty_ordered, unit_cost_vnd").eq("po_id", poId)).data ?? []) as Array<{ qty_ordered: number | string; unit_cost_vnd: number | string }>;
  const total = Math.round(lines.reduce((s, l) => s + num(l.qty_ordered) * num(l.unit_cost_vnd), 0));
  await db.from("inventory_purchase_orders").update({ total_vnd: total, updated_at: new Date().toISOString() }).eq("id", poId);
  return total;
};

/** Create a purchase order with lines (manual or drafted). Retries the number when two are made at once. */
export const createPo = async (
  db: Db, ws: string, a: { supplierId: string | null; lines: ReadonlyArray<{ itemId: string; qty: number; unitCost: number }>; by: string; source: "auto" | "manual"; note?: string; leadTimeDays?: number },
): Promise<string> => {
  const expected = a.leadTimeDays !== undefined ? new Date(Date.now() + a.leadTimeDays * 86_400_000).toISOString().slice(0, 10) : null;
  let id: string | null = null;
  for (let i = 0; i < 4 && !id; i++) {
    const ins = await db.from("inventory_purchase_orders").insert({
      workspace_id: ws, po_no: await poNo(db, ws), supplier_id: a.supplierId, status: "draft", expected_at: expected, note: a.note ?? "", source: a.source, created_by: a.by,
    }).select("id").single();
    if (ins.error?.code === "23505") continue;
    if (ins.error) throw new Error(ins.error.message);
    id = (ins.data as { id: string }).id;
  }
  if (!id) throw new Error("Không tạo được số đơn nhập.");
  if (a.lines.length) {
    const ins = await db.from("inventory_po_lines").insert(a.lines.map((l) => ({ workspace_id: ws, po_id: id, item_id: l.itemId, qty_ordered: l.qty, unit_cost_vnd: l.unitCost })));
    if (ins.error) throw new Error(ins.error.message);
  }
  await recomputeTotal(db, id);
  return id;
};

/** The quantity already on open purchase orders (ordered and not yet received), per item. */
export const onOrderQty = async (db: Db, ws: string): Promise<Map<string, number>> => {
  const pos = ((await db.from("inventory_purchase_orders").select("id, status").eq("workspace_id", ws).in("status", ["draft", "waiting_approval", "sent", "partially_received"])).data ?? []) as Array<{ id: string; status: PoStatus }>;
  const out = new Map<string, number>();
  if (!pos.length) return out;
  const lines = ((await db.from("inventory_po_lines").select("item_id, qty_ordered, qty_received").in("po_id", pos.map((p) => p.id))).data ?? []) as Array<{ item_id: string; qty_ordered: number | string; qty_received: number | string }>;
  for (const l of lines) out.set(l.item_id, (out.get(l.item_id) ?? 0) + Math.max(0, num(l.qty_ordered) - num(l.qty_received)));
  return out;
};

/** The owner's rule for an action ("never" blocks it; no rule row means the module was never set up, which does not block drafting). */
const ruleMode = async (db: Db, ws: string, action: string): Promise<string | null> =>
  (((await db.from("authority_rules").select("mode").eq("workspace_id", ws).eq("action", action).maybeSingle()).data ?? null) as { mode: string } | null)?.mode ?? null;

export type DraftOutcome = { readonly poIds: Array<string>; readonly lowCount: number; readonly skipped: Array<string> };

/**
 * draft_purchase_order (auto): items below their reorder point that no open purchase order already covers are added to ONE draft per supplier
 * (an existing draft of the supplier is extended, never duplicated). Then each draft that has a supplier is put before the owner: the order message is
 * written and send_purchase_order asks for approval (requestSend). Items without a supplier land on a draft with no supplier and say so.
 */
export const draftLowStock = async (db: Db, ws: string, o: { readonly itemIds?: ReadonlyArray<string>; readonly by?: string; readonly requestApproval?: boolean } = {}): Promise<DraftOutcome> => {
  const by = o.by ?? NIVO;
  const low = await lowItems(db, ws, o.itemIds);
  if (!low.length) return { poIds: [], lowCount: 0, skipped: [] };
  if ((await ruleMode(db, ws, "draft_purchase_order")) === "never") return { poIds: [], lowCount: low.length, skipped: low.map((l) => l.item.name) };
  const onOrder = await onOrderQty(db, ws);
  // Inventory position: what is on the shelf plus what is already ordered. Ordering only when that is still at or below the reorder point.
  const need = low.filter((l) => l.total + (onOrder.get(l.item.id) ?? 0) <= l.item.reorder_point);
  const skipped = low.filter((l) => !need.includes(l)).map((l) => l.item.name);
  const groups = new Map<string, Array<LowItem>>();
  for (const l of need) groups.set(l.item.supplier_id ?? "", [...(groups.get(l.item.supplier_id ?? "") ?? []), l]);
  const poIds: Array<string> = [];
  for (const [supplierId, rows] of groups) {
    const supplier = supplierId ? (((await db.from("inventory_suppliers").select("lead_time_days").eq("id", supplierId).maybeSingle()).data ?? null) as { lead_time_days: number } | null) : null;
    let q = db.from("inventory_purchase_orders").select("id").eq("workspace_id", ws).eq("status", "draft").order("created_at").limit(1);
    q = supplierId ? q.eq("supplier_id", supplierId) : q.is("supplier_id", null);
    const existing = ((await q).data ?? [])[0] as { id: string } | undefined;
    let poId: string;
    if (existing) {
      poId = existing.id;
      const have = new Set((((await db.from("inventory_po_lines").select("item_id").eq("po_id", poId)).data ?? []) as Array<{ item_id: string }>).map((l) => l.item_id));
      const add = rows.filter((r) => !have.has(r.item.id));
      if (add.length) {
        await db.from("inventory_po_lines").insert(add.map((r) => ({ workspace_id: ws, po_id: poId, item_id: r.item.id, qty_ordered: suggestOrderQty(r.item, r.total), unit_cost_vnd: r.item.cost_vnd })));
        await recomputeTotal(db, poId);
      }
    } else {
      poId = await createPo(db, ws, { supplierId: supplierId || null, lines: rows.map((r) => ({ itemId: r.item.id, qty: suggestOrderQty(r.item, r.total), unitCost: r.item.cost_vnd })), by, source: "auto", leadTimeDays: supplier?.lead_time_days ?? 2 });
    }
    poIds.push(poId);
    const po = ((await db.from("inventory_purchase_orders").select("po_no, total_vnd").eq("id", poId).single()).data ?? { po_no: "", total_vnd: 0 }) as { po_no: string; total_vnd: number | string };
    const names = rows.map((r) => r.item.name).join(", ");
    await logEvidence(db, ws, { kind: "inventory.po_drafted", actor: "Kho · Soạn đơn nhập", summary: `Soạn đơn ${po.po_no} vì sắp hết: ${names}`, evidence: `${formatMoney(num(po.total_vnd))}` });
    await logDecision(db, ws, { work_item_id: null, lead_id: null, department: "inventory", action: "draft_purchase_order", decided_by: NIVO, decider_kind: "policy", outcome: "auto_done", reason: "routine", note: `Soạn đơn ${po.po_no}: ${names}` });
  }
  if (o.requestApproval !== false) {
    const ctx: EngineCtx = { db, ws, actor: by, locale: "vi" };
    // A draft without a supplier cannot be sent: it stays a draft until the owner picks one.
    const withSupplier = new Set((((await db.from("inventory_purchase_orders").select("id").in("id", poIds).not("supplier_id", "is", null)).data ?? []) as Array<{ id: string }>).map((r) => r.id));
    for (const id of poIds.filter((x) => withSupplier.has(x))) await requestSend(ctx, id).catch((e) => console.error("inventory requestSend failed:", e instanceof Error ? e.message : e));
  }
  return { poIds, lowCount: low.length, skipped };
};

/** After stock moved: items that just fell to their reorder point get a draft (and the owner a decision). Never throws; the movement already happened. */
export const afterMovements = async (db: Db, ws: string, itemIds: ReadonlyArray<string>): Promise<void> => {
  try {
    if (!itemIds.length) return;
    const r = await draftLowStock(db, ws, { itemIds });
    if (r.poIds.length) console.log("inventory: drafted", r.poIds.length, "purchase order(s) after a movement");
  } catch (e) {
    console.error("inventory low-stock check failed:", e instanceof Error ? e.message : e);
  }
};

/** Like afterMovements, but never makes the caller wait: after the response inside a request (the order message takes OpenClaw a while), right away elsewhere (scripts). */
export const afterMovementsLater = async (db: Db, ws: string, itemIds: ReadonlyArray<string>): Promise<void> => {
  const run = () => afterMovements(db, ws, itemIds);
  try {
    after(run);
  } catch {
    await run();
  }
};

/* ------------------------------------------------------------------ the order message and the send request */

type PoFull = {
  id: string; po_no: string; supplier_id: string | null; status: PoStatus; total_vnd: number | string; expected_at: string | null; message: string; reminders: number;
  supplier: { name: string; contact_name: string; email: string | null; phone: string | null; zalo: string | null; channel: "email" | "zalo" | "phone"; lead_time_days: number } | null;
  lines: Array<{ id: string; item_id: string; qty_ordered: number | string; qty_received: number | string; unit_cost_vnd: number | string; item: { name: string; unit: string; sku: string } | null }>;
};

export const loadPo = async (db: Db, ws: string, poId: string): Promise<PoFull | null> => {
  const po = ((await db.from("inventory_purchase_orders").select("*, supplier:inventory_suppliers(name, contact_name, email, phone, zalo, channel, lead_time_days)").eq("workspace_id", ws).eq("id", poId).maybeSingle()).data ?? null) as Omit<PoFull, "lines"> | null;
  if (!po) return null;
  const lines = ((await db.from("inventory_po_lines").select("id, item_id, qty_ordered, qty_received, unit_cost_vnd, item:inventory_items(name, unit, sku)").eq("po_id", poId).order("id")).data ?? []) as unknown as PoFull["lines"];
  return { ...po, lines };
};

const dateVi = (iso: string | null): string | null => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : null);

/** The polite order message: OpenClaw writes it from the order, the supplier and the shop's voice; a plain template when OpenClaw cannot answer. */
export const composeOrderMessage = async (db: Db, ws: string, po: PoFull, kind: "order" | "reminder"): Promise<{ text: string; generated: boolean }> => {
  const shop = await shopName(db, ws);
  const lines = po.lines.map((l) => ({ name: l.item?.name ?? "Hàng", qty: num(l.qty_ordered) - (kind === "reminder" ? num(l.qty_received) : 0), unit: l.item?.unit ?? "" })).filter((l) => l.qty > 0);
  const base = fallbackOrderMessage({ shop, supplier: po.supplier?.name ?? "anh/chị", contact: po.supplier?.contact_name ?? "", lines, expected: dateVi(po.expected_at) });
  const reminder = `Chào ${po.supplier?.contact_name || po.supplier?.name || "anh/chị"}, ${shop} xin hỏi nhẹ về đơn ${po.po_no}${po.expected_at ? ` (hẹn giao ${dateVi(po.expected_at)})` : ""}: hàng còn thiếu\n${lines.map((l) => `- ${l.name}: ${formatQty(l.qty)} ${l.unit}`).join("\n")}\nBên mình cho biết khi nào giao được giúp nhé. Cảm ơn bạn.`;
  const fallback = kind === "reminder" ? reminder : base;
  const authority = ((await db.from("authority").select("brand_voice, reply_style").eq("workspace_id", ws).maybeSingle()).data ?? null) as { brand_voice: string; reply_style: string } | null;
  const voice = [authority?.brand_voice, authority?.reply_style].filter(Boolean).join(" ").slice(0, 300);
  const facts = [
    `Cửa hàng: ${shop}`, `Nhà cung cấp: ${po.supplier?.name ?? ""}${po.supplier?.contact_name ? ` (người liên hệ: ${po.supplier.contact_name})` : ""}`, `Mã đơn: ${po.po_no}`,
    `Kênh gửi: ${po.supplier?.channel === "zalo" ? "Zalo (tin ngắn)" : po.supplier?.channel === "phone" ? "điện thoại (lời nhắn ngắn)" : "email"}`,
    po.expected_at ? `Cần hàng trước: ${dateVi(po.expected_at)}` : "", `Mặt hàng:\n${lines.map((l) => `- ${l.name}: ${formatQty(l.qty)} ${l.unit}`).join("\n")}`,
    kind === "order" ? `Tổng tạm tính: ${formatMoney(num(po.total_vnd))}` : "", voice ? `Giọng điệu của shop: ${voice}` : "",
  ].filter(Boolean).join("\n");
  const task = kind === "order"
    ? "Viết tin nhắn đặt hàng gửi nhà cung cấp: lịch sự, ngắn gọn, nêu rõ từng mặt hàng và số lượng, ngày cần hàng, nhờ xác nhận và báo nếu thiếu hàng hoặc đổi giá. Không bịa giá hay điều khoản chưa có."
    : "Viết tin nhắn nhắc nhẹ nhà cung cấp về đơn đã quá hạn giao: lịch sự, không trách móc, hỏi khi nào giao được và nêu phần còn thiếu.";
  const r = await generateWithOpenClaw({
    workspaceId: ws, purpose: kind === "order" ? "inventory_po_message" : "inventory_po_reminder", module: "inventory", timeoutMs: 40_000,
    messages: [
      { role: "system", content: "Bạn là trợ lý kho & nhập hàng của một cửa hàng ở Việt Nam. Chỉ viết đúng nội dung tin nhắn bằng tiếng Việt đơn giản, không tiêu đề, không giải thích, không dùng ký hiệu markdown." },
      { role: "user", content: `${task}\n\n${facts}` },
    ],
  }).catch(() => null);
  const text = r && r.ok ? r.output.trim() : "";
  return text.length >= 20 ? { text: text.slice(0, 1800), generated: true } : { text: fallback, generated: false };
};

/**
 * Put a draft purchase order before the owner: write the message, set it to "waiting_approval" and open the send_purchase_order work item (the gate).
 * The rule decides: ask leaves a decision in Office; auto (the owner's choice, under their limit) sends at once. A repeated call while one waits changes nothing.
 */
export const requestSend = async (c: EngineCtx, poId: string, o: { readonly kind?: "order" | "reminder" } = {}): Promise<{ status: string; workItemId: string | null }> => {
  const db = admin();
  const kind = o.kind ?? "order";
  const po = await loadPo(db, c.ws, poId);
  if (!po) throw new Error("Không tìm thấy đơn nhập.");
  if (!po.supplier_id || !po.supplier) throw new Error("Đơn này chưa chọn nhà cung cấp.");
  if (!po.lines.length) throw new Error("Đơn này chưa có mặt hàng nào.");
  if (kind === "order" && po.status !== "draft") return { status: po.status, workItemId: null };
  if (kind === "reminder" && po.status !== "sent" && po.status !== "partially_received") return { status: po.status, workItemId: null };
  const { text } = await composeOrderMessage(db, c.ws, po, kind);
  const attempt = ((await db.from("work_items").select("id", { count: "exact", head: true }).eq("workspace_id", c.ws).like("dedupe_key", `send_po:${kind}:${po.id}:%`)).count ?? 0) + 1;
  const total = Math.round(num(po.total_vnd));
  if (kind === "order") await db.from("inventory_purchase_orders").update({ message: text, updated_at: new Date().toISOString() }).eq("id", po.id);
  const item = await runWork(c, {
    action: "send_purchase_order", subject_type: "purchase_order", subject_id: po.id, dedupeKey: `send_po:${kind}:${po.id}:${attempt}`, origin: "live", preset: true, noChain: true,
    seed: {
      summary: kind === "order"
        ? `Gửi đơn nhập ${po.po_no} cho ${po.supplier.name}: ${po.lines.length} mặt hàng, ${formatMoney(total)}`
        : `Nhắc ${po.supplier.name} về đơn ${po.po_no} đã quá hạn giao`,
      draft: text, amount_vnd: total,
      fields: { po_id: po.id, po_no: po.po_no, supplier: po.supplier.name, channel: po.supplier.channel, kind, amount_vnd: total },
    },
  });
  if (kind === "order" && item.status === "waiting_decision") {
    await db.from("inventory_purchase_orders").update({ status: "waiting_approval", work_item_id: item.id, updated_at: new Date().toISOString() }).eq("id", po.id).eq("status", "draft");
  }
  return { status: item.status, workItemId: item.id };
};

/** What the supplier send did: the email result, or the copy-ready message when the channel is Zalo, a phone call or the email could not go out. */
export type SendOutcome = { readonly via: "email" | "copy"; readonly note: string | null };

/** The supplier's email, when the channel is email and the address is real. */
export const supplierEmail = (s: PoFull["supplier"]): string | null => (s && s.channel === "email" && s.email && isEmailAddress(s.email.trim()) ? s.email.trim() : null);

export { isOpenPo };
