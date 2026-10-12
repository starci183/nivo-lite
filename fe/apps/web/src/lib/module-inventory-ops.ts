import "server-only";
import { logEvidence } from "./core";
import { runWork, type EngineCtx } from "./engine";
import {
  admin, afterMovementsLater, applyMovement, defaultLocation, loadPo, officeNote, recomputeTotal, toItem, totalsOf, type Db, type ItemRow,
} from "./module-inventory-core";
import { formatMoney, formatQty, isSmallAdjustment, parseItemTable, skuFromName, type ImportRow } from "./module-inventory-shared";
import { INVENTORY_TEMPLATES, templateOf } from "./module-inventory-templates";

/** The commands of the workbench, as plain functions of (workspace, who). The server actions only check the session and call these. */
const num = (v: unknown): number => Number(v) || 0;

/* ------------------------------------------------------------------ adjusting stock (the adjust_stock gate) */

export type AdjustResult =
  | { readonly state: "applied"; readonly before: number; readonly after: number }
  | { readonly state: "waiting"; readonly workItemId: string };

/**
 * Change one item's quantity by hand. A small change (a few units, or under a small value) is applied at once and recorded; a bigger one is NOT applied:
 * it becomes an adjust_stock decision the owner approves in Office or on the workbench (the gate decides auto / ask by the owner's rule).
 * `countedQty` (stock-take) sets the quantity to what was counted; otherwise `delta` is added.
 */
export const adjustStock = async (
  c: EngineCtx, a: { itemId: string; locationId?: string; delta?: number; countedQty?: number; reason: string; evidence?: string; kind?: "adjust" | "in" | "out"; refType?: "manual" | "count" },
): Promise<AdjustResult> => {
  const db = admin();
  const row = ((await db.from("inventory_items").select("*").eq("workspace_id", c.ws).eq("id", a.itemId).maybeSingle()).data ?? null) as ItemRow | null;
  if (!row) throw new Error("Không tìm thấy mặt hàng.");
  const item = toItem(row);
  const loc = a.locationId ?? (await defaultLocation(db, c.ws));
  const cur = num(((await db.from("inventory_stock_levels").select("qty").eq("item_id", item.id).eq("location_id", loc).maybeSingle()).data as { qty: number | string } | null)?.qty);
  const delta = a.countedQty !== undefined ? a.countedQty - cur : (a.delta ?? 0);
  if (!delta) return { state: "applied", before: cur, after: cur };
  const reason = a.reason.trim() || (a.countedQty !== undefined ? "Kiểm kê" : "Chỉnh tay");
  const by = c.actor;
  if (isSmallAdjustment(delta, item.cost_vnd)) {
    const r = await applyMovement(db, c.ws, {
      itemId: item.id, locationId: loc, kind: a.kind ?? "adjust", delta, reason, refType: a.refType ?? "manual", by, evidence: a.evidence ?? null,
    });
    await logEvidence(db, c.ws, { kind: "inventory.adjust", actor: by, summary: `${item.name}: ${formatQty(r.before)} → ${formatQty(r.after)} ${item.unit} (${reason})`, evidence: a.evidence ?? null });
    await afterMovementsLater(db, c.ws, [item.id]);
    return { state: "applied", before: r.before, after: r.after };
  }
  const value = Math.abs(delta) * item.cost_vnd;
  const w = await runWork(c, {
    action: "adjust_stock", subject_type: "stock", subject_id: item.id, dedupeKey: `adjust_stock:${item.id}:${Date.now()}`, origin: "live", preset: true, noChain: true,
    seed: {
      summary: `Chỉnh tồn ${item.name}: ${formatQty(cur)} → ${formatQty(cur + delta)} ${item.unit} (${delta > 0 ? "+" : ""}${formatQty(delta)}${value ? `, khoảng ${formatMoney(value)}` : ""})`,
      amount_vnd: Math.round(value), fields: { item_id: item.id, location_id: loc, delta, reason, evidence: a.evidence ?? "", ref_type: a.refType ?? "manual", amount_vnd: Math.round(value) },
    },
  });
  if (w.status === "done") {
    const after = num(((await db.from("inventory_stock_levels").select("qty").eq("item_id", item.id).eq("location_id", loc).maybeSingle()).data as { qty: number | string } | null)?.qty);
    return { state: "applied", before: cur, after };
  }
  return { state: "waiting", workItemId: w.id };
};

/** Move goods between two locations (stores / warehouses): the total does not change, so no approval is needed; both sides are recorded. */
export const transferStock = async (c: EngineCtx, a: { itemId: string; fromLocationId: string; toLocationId: string; qty: number; note?: string }): Promise<{ from: number; to: number }> => {
  if (a.fromLocationId === a.toLocationId) throw new Error("Chọn hai nơi khác nhau.");
  if (!(a.qty > 0)) throw new Error("Nhập số lượng cần chuyển.");
  const db = admin();
  const item = ((await db.from("inventory_items").select("name, unit").eq("workspace_id", c.ws).eq("id", a.itemId).maybeSingle()).data ?? null) as { name: string; unit: string } | null;
  if (!item) throw new Error("Không tìm thấy mặt hàng.");
  const names = new Map((((await db.from("inventory_locations").select("id, name").eq("workspace_id", c.ws).in("id", [a.fromLocationId, a.toLocationId])).data ?? []) as Array<{ id: string; name: string }>).map((l) => [l.id, l.name]));
  if (names.size !== 2) throw new Error("Không tìm thấy kho.");
  const key = `${Date.now()}`;
  const reason = `Chuyển ${names.get(a.fromLocationId)} → ${names.get(a.toLocationId)}${a.note ? `: ${a.note}` : ""}`;
  const out = await applyMovement(db, c.ws, { itemId: a.itemId, locationId: a.fromLocationId, kind: "transfer", delta: -a.qty, reason, refType: "transfer", by: c.actor, dedupe: `transfer:${key}:out:${a.itemId}` });
  const inn = await applyMovement(db, c.ws, { itemId: a.itemId, locationId: a.toLocationId, kind: "transfer", delta: a.qty, reason, refType: "transfer", by: c.actor, dedupe: `transfer:${key}:in:${a.itemId}` });
  await logEvidence(db, c.ws, { kind: "inventory.transfer", actor: c.actor, summary: `${item.name}: ${reason} (${formatQty(a.qty)} ${item.unit})` });
  return { from: out.after, to: inn.after };
};

export const saveLocation = async (c: EngineCtx, a: { id?: string; name: string }): Promise<void> => {
  const name = a.name.trim().slice(0, 60);
  if (!name) throw new Error("Nhập tên kho hoặc điểm bán.");
  const db = admin();
  if (a.id) {
    const { error } = await db.from("inventory_locations").update({ name }).eq("workspace_id", c.ws).eq("id", a.id);
    if (error) throw new Error(error.message);
    return;
  }
  await defaultLocation(db, c.ws);
  const { error } = await db.from("inventory_locations").insert({ workspace_id: c.ws, name });
  if (error) throw new Error(error.message);
};

/** A stock-take: every counted item that differs from the system is adjusted (small ones now, big ones wait for approval). */
export const stockTake = async (c: EngineCtx, counts: ReadonlyArray<{ itemId: string; counted: number }>): Promise<{ applied: number; waiting: number; same: number }> => {
  let applied = 0;
  let waiting = 0;
  let same = 0;
  for (const k of counts) {
    const r = await adjustStock(c, { itemId: k.itemId, countedQty: k.counted, reason: "Kiểm kê kho", refType: "count", evidence: "Nhập số đếm trong màn Kiểm kê" });
    if (r.state === "waiting") waiting += 1;
    else if (r.before === r.after) same += 1;
    else applied += 1;
  }
  return { applied, waiting, same };
};

/* ------------------------------------------------------------------ receiving goods */

export type ReceiveInput = {
  readonly poId: string;
  readonly lines: ReadonlyArray<{ lineId: string; qty: number; unitCost: number }>;
  readonly invoiceNo?: string;
  readonly note?: string;
};
export type ReceiveResult = { readonly status: "partially_received" | "received"; readonly received: number; readonly priceChanges: Array<string>; readonly payableVnd: number; readonly handedToAccounting: boolean };

/**
 * Receive goods against a purchase order, in full or in part: each line's ACTUAL quantity becomes an "in" movement at the actual price, the item's cost moves to the
 * weighted average, the order becomes "partially_received" or "received". A price different from the order is listed and recorded. When an accounting module is
 * installed and the goods have a value, the supplier's invoice is handed to Accounting as a payable (Office note + evidence).
 */
export const receivePo = async (c: EngineCtx, i: ReceiveInput): Promise<ReceiveResult> => {
  const db = admin();
  const po = await loadPo(db, c.ws, i.poId);
  if (!po) throw new Error("Không tìm thấy đơn nhập.");
  if (po.status !== "sent" && po.status !== "partially_received") throw new Error("Đơn này chưa được gửi đi nên chưa nhận hàng được.");
  const rec = await db.from("inventory_receipts").insert({ workspace_id: c.ws, po_id: po.id, invoice_no: i.invoiceNo?.trim() || null, note: i.note?.trim() ?? "", received_by: c.actor }).select("id").single();
  if (rec.error) throw new Error(rec.error.message);
  const receiptId = (rec.data as { id: string }).id;
  const loc = await defaultLocation(db, c.ws);
  let value = 0;
  let received = 0;
  const priceChanges: Array<string> = [];
  const touched: Array<string> = [];
  for (const l of i.lines) {
    const line = po.lines.find((x) => x.id === l.lineId);
    if (!line || !(l.qty > 0)) continue;
    const cost = l.unitCost >= 0 ? l.unitCost : num(line.unit_cost_vnd);
    const r = await applyMovement(db, c.ws, {
      itemId: line.item_id, locationId: loc, kind: "in", delta: l.qty, reason: `Nhập hàng theo đơn ${po.po_no}`, refType: "po", refId: po.id, refLabel: po.po_no, by: c.actor,
      evidence: i.invoiceNo ? `Hoá đơn ${i.invoiceNo}` : null, dedupe: `po-receive:${receiptId}:${line.id}`, unitCost: cost,
    });
    if (!r.applied) continue;
    received += 1;
    value += l.qty * cost;
    touched.push(line.item_id);
    await db.from("inventory_po_lines").update({ qty_received: num(line.qty_received) + l.qty, unit_cost_vnd: cost }).eq("id", line.id);
    if (Math.abs(cost - num(line.unit_cost_vnd)) >= 1) priceChanges.push(`${line.item?.name ?? "Hàng"}: ${formatMoney(num(line.unit_cost_vnd))} → ${formatMoney(cost)}`);
  }
  if (!received) {
    await db.from("inventory_receipts").delete().eq("id", receiptId);
    throw new Error("Chưa nhập số lượng nhận nào.");
  }
  await db.from("inventory_receipts").update({ total_vnd: Math.round(value) }).eq("id", receiptId);
  const fresh = await loadPo(db, c.ws, po.id);
  const done = (fresh?.lines ?? []).every((l) => num(l.qty_received) >= num(l.qty_ordered));
  const status = done ? "received" : "partially_received";
  await db.from("inventory_purchase_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", po.id);
  await recomputeTotal(db, po.id);
  await logEvidence(db, c.ws, {
    kind: "inventory.received", actor: c.actor, summary: `Nhận hàng đơn ${po.po_no}${done ? " (đủ)" : " (một phần)"}: ${received} mặt hàng, ${formatMoney(value)}`,
    evidence: [i.invoiceNo ? `Hoá đơn ${i.invoiceNo}` : null, ...priceChanges.map((p) => `Đổi giá ${p}`)].filter(Boolean).join(" · ") || null,
  });
  if (priceChanges.length) await officeNote(db, c.ws, `Giá nhập đổi khi nhận hàng đơn ${po.po_no}: ${priceChanges.join("; ")}. Giá vốn đã tính lại theo bình quân.`);
  let handed = false;
  const accounting = ((await db.from("module_installations").select("id").eq("workspace_id", c.ws).eq("module_key", "accounting").limit(1)).data ?? []).length > 0;
  if (accounting && value > 0) {
    const who = po.supplier?.name ?? "nhà cung cấp";
    await officeNote(db, c.ws, `Kho chuyển cho Kế toán khoản phải trả ${who}: ${formatMoney(value)}${i.invoiceNo ? ` (hoá đơn ${i.invoiceNo})` : ""}, đơn nhập ${po.po_no}.`);
    await logEvidence(db, c.ws, { kind: "inventory.payable", actor: "Kho · Nhận hàng", summary: `Khoản phải trả ${who}: ${formatMoney(value)} (đơn ${po.po_no})`, evidence: i.invoiceNo ? `Hoá đơn ${i.invoiceNo}` : null });
    handed = true;
  }
  await afterMovementsLater(db, c.ws, touched);
  return { status, received, priceChanges, payableVnd: Math.round(value), handedToAccounting: handed };
};

export const cancelPo = async (c: EngineCtx, poId: string): Promise<void> => {
  const db = admin();
  const { data } = await db.from("inventory_purchase_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("workspace_id", c.ws).eq("id", poId).in("status", ["draft", "waiting_approval", "sent"]).select("id, po_no");
  const row = (data ?? [])[0] as { po_no: string } | undefined;
  if (!row) throw new Error("Đơn này không huỷ được nữa.");
  // A decision still waiting for this order is closed with it.
  await db.from("work_items").update({ status: "rejected", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("workspace_id", c.ws).eq("subject_id", poId).eq("action", "send_purchase_order").eq("status", "waiting_decision");
  await logEvidence(db, c.ws, { kind: "inventory.po_cancelled", actor: c.actor, summary: `Huỷ đơn nhập ${row.po_no}` });
};

/* ------------------------------------------------------------------ importing items */

export type ImportResult = { readonly created: number; readonly updated: number; readonly stocked: number; readonly skipped: ReadonlyArray<string> };

const supplierIdByName = async (db: Db, ws: string, name: string, cache: Map<string, string>): Promise<string | null> => {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  const found = ((await db.from("inventory_suppliers").select("id, name").eq("workspace_id", ws)).data ?? []) as Array<{ id: string; name: string }>;
  for (const s of found) cache.set(s.name.trim().toLowerCase(), s.id);
  if (cache.has(key)) return cache.get(key) ?? null;
  const ins = await db.from("inventory_suppliers").insert({ workspace_id: ws, name: name.trim() }).select("id").single();
  if (ins.error) throw new Error(ins.error.message);
  const id = (ins.data as { id: string }).id;
  cache.set(key, id);
  return id;
};

/** Create or update items from parsed rows (matched by SKU, else by name); an opening quantity becomes an "adjust" movement at the default location. */
export const importRows = async (c: EngineCtx, rows: ReadonlyArray<ImportRow>, skipped: ReadonlyArray<string> = []): Promise<ImportResult> => {
  const db = admin();
  const existing = ((await db.from("inventory_items").select("id, sku, name").eq("workspace_id", c.ws)).data ?? []) as Array<{ id: string; sku: string; name: string }>;
  const bySku = new Map(existing.map((e) => [e.sku.toLowerCase(), e.id]));
  const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e.id]));
  const suppliers = new Map<string, string>();
  let created = 0;
  let updated = 0;
  let stocked = 0;
  const touched: Array<string> = [];
  const used = new Set(bySku.keys());
  for (const r of rows) {
    const sku = (r.sku || skuFromName(r.name)).toUpperCase();
    let id = bySku.get(sku.toLowerCase()) ?? byName.get(r.name.trim().toLowerCase()) ?? null;
    const supplierId = r.supplier ? await supplierIdByName(db, c.ws, r.supplier, suppliers) : null;
    const patch = {
      name: r.name, unit: r.unit, category: r.category, cost_vnd: r.cost_vnd, sell_price_vnd: r.sell_price_vnd, reorder_point: r.reorder_point, reorder_qty: r.reorder_qty,
      ...(supplierId ? { supplier_id: supplierId } : {}), updated_at: new Date().toISOString(),
    };
    if (id) {
      await db.from("inventory_items").update(patch).eq("id", id).eq("workspace_id", c.ws);
      updated += 1;
    } else {
      let useSku = sku;
      for (let n = 2; used.has(useSku.toLowerCase()); n++) useSku = `${sku}-${n}`;
      used.add(useSku.toLowerCase());
      const ins = await db.from("inventory_items").insert({ workspace_id: c.ws, sku: useSku, ...patch }).select("id").single();
      if (ins.error) throw new Error(`${r.name}: ${ins.error.message}`);
      id = (ins.data as { id: string }).id;
      created += 1;
    }
    if (r.qty !== null && id) {
      const cur = (await totalsOf(db, c.ws, [id])).get(id) ?? 0;
      if (r.qty !== cur) {
        await applyMovement(db, c.ws, { itemId: id, kind: "adjust", delta: r.qty - cur, reason: "Nhập tồn đầu kỳ", refType: "import", by: c.actor, evidence: "Dán bảng hàng hoá" });
        stocked += 1;
        touched.push(id);
      }
    }
  }
  await logEvidence(db, c.ws, { kind: "inventory.import", actor: c.actor, summary: `Nhập danh mục hàng: ${created} mới, ${updated} cập nhật, ${stocked} có số tồn đầu kỳ` });
  await afterMovementsLater(db, c.ws, touched);
  return { created, updated, stocked, skipped };
};

export const importPasted = async (c: EngineCtx, text: string): Promise<ImportResult> => {
  const { rows, skipped } = parseItemTable(text);
  if (!rows.length) throw new Error("Không đọc được dòng hàng nào. Mỗi dòng cần ít nhất tên hàng.");
  return importRows(c, rows, skipped);
};

/** Load a business starter (items, suppliers, recipes) from resources/inventory-templates: existing SKUs are left as they are. */
export const loadTemplate = async (c: EngineCtx, key: string): Promise<{ items: number; suppliers: number; recipes: number }> => {
  const t = templateOf(key);
  if (!t) throw new Error("Không có mẫu này.");
  const db = admin();
  await defaultLocation(db, c.ws);
  const sup = new Map<string, string>();
  const have = ((await db.from("inventory_suppliers").select("id, name").eq("workspace_id", c.ws)).data ?? []) as Array<{ id: string; name: string }>;
  for (const s of have) sup.set(s.name.toLowerCase(), s.id);
  let suppliers = 0;
  for (const s of t.suppliers) {
    if (sup.has(s.name.toLowerCase())) continue;
    const ins = await db.from("inventory_suppliers").insert({
      workspace_id: c.ws, name: s.name, contact_name: s.contact_name ?? "", email: s.email ?? null, phone: s.phone ?? null, zalo: s.zalo ?? null, channel: s.channel, lead_time_days: s.lead_time_days, payment_terms: s.payment_terms ?? "",
    }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    sup.set(s.name.toLowerCase(), (ins.data as { id: string }).id);
    suppliers += 1;
  }
  const items = new Map(((await db.from("inventory_items").select("id, sku").eq("workspace_id", c.ws)).data ?? []).map((r) => [(r as { sku: string }).sku, (r as { id: string }).id]));
  let created = 0;
  for (const it of t.items) {
    if (items.has(it.sku)) continue;
    const ins = await db.from("inventory_items").insert({
      workspace_id: c.ws, sku: it.sku, name: it.name, unit: it.unit, units: it.units ?? [], category: it.category, cost_vnd: it.cost_vnd, sell_price_vnd: it.sell_price_vnd ?? null,
      reorder_point: it.reorder_point, reorder_qty: it.reorder_qty, supplier_id: it.supplier ? (sup.get(it.supplier.toLowerCase()) ?? null) : null, aliases: it.aliases ?? [],
    }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    const id = (ins.data as { id: string }).id;
    items.set(it.sku, id);
    created += 1;
    if (it.qty > 0) await applyMovement(db, c.ws, { itemId: id, kind: "adjust", delta: it.qty, reason: "Tồn đầu kỳ (mẫu)", refType: "import", by: c.actor, evidence: `Mẫu ${t.name}` });
  }
  let recipes = 0;
  const haveRecipes = new Set((((await db.from("inventory_recipes").select("name").eq("workspace_id", c.ws)).data ?? []) as Array<{ name: string }>).map((r) => r.name.toLowerCase()));
  for (const r of t.recipes) {
    if (haveRecipes.has(r.name.toLowerCase())) continue;
    const ins = await db.from("inventory_recipes").insert({ workspace_id: c.ws, name: r.name, aliases: r.aliases ?? [] }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    const rid = (ins.data as { id: string }).id;
    const lines = r.lines.flatMap((l) => (items.has(l.sku) ? [{ workspace_id: c.ws, recipe_id: rid, item_id: items.get(l.sku) as string, qty: l.qty }] : []));
    if (lines.length) await db.from("inventory_recipe_lines").insert(lines);
    recipes += 1;
  }
  await logEvidence(db, c.ws, { kind: "inventory.template", actor: c.actor, summary: `Nạp mẫu "${t.name}": ${created} mặt hàng, ${suppliers} nhà cung cấp, ${recipes} công thức` });
  return { items: created, suppliers, recipes };
};

export const TEMPLATE_CHOICES = INVENTORY_TEMPLATES.map((t) => ({ key: t.key, name: t.name, description: t.description }));
