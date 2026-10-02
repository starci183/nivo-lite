"use server";

import { revalidatePath } from "next/cache";
import { engineCtx } from "@/lib/flow-ctx";
import { requireManager } from "@/lib/permissions";
import { logEvidence } from "@/lib/core";
import { admin, createPo, draftLowStock, recomputeTotal, requestSend } from "@/lib/module-inventory-core";
import { adjustStock, cancelPo, importPasted, loadTemplate, receivePo, stockTake, type AdjustResult, type ImportResult, type ReceiveResult } from "@/lib/module-inventory-ops";
import { num } from "@/lib/module-inventory-shared";
import type { Outcome } from "@/lib/types";

/**
 * Commands of the Kho & nhập hàng workbench. Each one checks who is asking (owner or manager for anything that changes the catalogue, suppliers or orders;
 * any member may count or adjust stock) and calls the plain functions in src/lib/module-inventory-*. Quantities that need approval go through the gate.
 */
const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    const data = await fn();
    revalidatePath("/m/inventory/workbench");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const text = (v: unknown, max = 200): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const uuid = (v: unknown): string | null => (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null);

/** "thùng=24, kiện=100" → [{unit, factor}] */
const parseUnits = (s: string): Array<{ unit: string; factor: number }> =>
  s.split(/[,;\n]/).map((p) => p.split("=")).flatMap(([u, f]) => (u && f && num(f) > 0 ? [{ unit: u.trim().slice(0, 30), factor: num(f) }] : []));
const parseList = (s: string): Array<string> => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 20);

export type ItemInput = {
  readonly id?: string; readonly sku: string; readonly name: string; readonly unit: string; readonly units: string; readonly category: string;
  readonly cost: string; readonly sell: string; readonly reorderPoint: string; readonly reorderQty: string; readonly supplierId: string; readonly aliases: string; readonly openingQty?: string;
};

export async function saveItem(i: ItemInput): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    const db = admin();
    const name = text(i.name, 120);
    if (!name) throw new Error("Nhập tên hàng.");
    const patch = {
      name, unit: text(i.unit, 30) || "cái", units: parseUnits(i.units), category: text(i.category, 60), cost_vnd: Math.max(0, num(i.cost)), sell_price_vnd: i.sell.trim() ? Math.max(0, num(i.sell)) : null,
      reorder_point: Math.max(0, num(i.reorderPoint)), reorder_qty: Math.max(0, num(i.reorderQty)), supplier_id: uuid(i.supplierId), aliases: parseList(i.aliases), updated_at: new Date().toISOString(),
    };
    if (i.id) {
      const { error } = await db.from("inventory_items").update({ sku: text(i.sku, 40) || undefined, ...patch }).eq("workspace_id", c.ws).eq("id", i.id);
      if (error) throw new Error(error.code === "23505" ? "Mã hàng này đã có." : error.message);
      return { id: i.id };
    }
    const sku = (text(i.sku, 40) || name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "HANG").toUpperCase();
    const ins = await db.from("inventory_items").insert({ workspace_id: c.ws, sku, ...patch }).select("id").single();
    if (ins.error) throw new Error(ins.error.code === "23505" ? "Mã hàng này đã có, đặt mã khác." : ins.error.message);
    const id = (ins.data as { id: string }).id;
    const opening = num(i.openingQty);
    if (opening > 0) await adjustStock(c, { itemId: id, delta: opening, reason: "Tồn đầu kỳ" }).catch(() => undefined);
    await logEvidence(db, c.ws, { kind: "inventory.item_created", actor: c.actor, summary: `Thêm mặt hàng ${name} (${sku})` });
    return { id };
  });
}

export async function setItemActive(id: string, active: boolean): Promise<Outcome<null>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    const { error } = await admin().from("inventory_items").update({ active, updated_at: new Date().toISOString() }).eq("workspace_id", c.ws).eq("id", id);
    if (error) throw new Error(error.message);
    return null;
  });
}

export type SupplierInput = {
  readonly id?: string; readonly name: string; readonly contactName: string; readonly email: string; readonly phone: string; readonly zalo: string;
  readonly channel: string; readonly leadTime: string; readonly terms: string; readonly note: string;
};

export async function saveSupplier(s: SupplierInput): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    const name = text(s.name, 120);
    if (!name) throw new Error("Nhập tên nhà cung cấp.");
    const channel = s.channel === "zalo" || s.channel === "phone" ? s.channel : "email";
    const email = text(s.email, 200).toLowerCase();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Email chưa đúng dạng.");
    const row = { name, contact_name: text(s.contactName, 80), email: email || null, phone: text(s.phone, 30) || null, zalo: text(s.zalo, 60) || null, channel, lead_time_days: Math.min(60, Math.max(0, Math.round(num(s.leadTime, 2)))), payment_terms: text(s.terms, 200), note: text(s.note, 400) };
    const db = admin();
    if (s.id) {
      const { error } = await db.from("inventory_suppliers").update(row).eq("workspace_id", c.ws).eq("id", s.id);
      if (error) throw new Error(error.message);
      return { id: s.id };
    }
    const ins = await db.from("inventory_suppliers").insert({ workspace_id: c.ws, ...row }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    return { id: (ins.data as { id: string }).id };
  });
}

export type RecipeInput = { readonly id?: string; readonly name: string; readonly aliases: string; readonly lines: ReadonlyArray<{ readonly itemId: string; readonly qty: string }> };

export async function saveRecipe(r: RecipeInput): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    const db = admin();
    const name = text(r.name, 120);
    if (!name) throw new Error("Nhập tên món hoặc dịch vụ.");
    const lines = r.lines.flatMap((l) => (uuid(l.itemId) && num(l.qty) > 0 ? [{ item_id: l.itemId, qty: num(l.qty) }] : []));
    if (!lines.length) throw new Error("Công thức cần ít nhất một nguyên liệu có số lượng.");
    let id = r.id ?? "";
    if (id) {
      const { error } = await db.from("inventory_recipes").update({ name, aliases: parseList(r.aliases) }).eq("workspace_id", c.ws).eq("id", id);
      if (error) throw new Error(error.message);
      await db.from("inventory_recipe_lines").delete().eq("recipe_id", id).eq("workspace_id", c.ws);
    } else {
      const ins = await db.from("inventory_recipes").insert({ workspace_id: c.ws, name, aliases: parseList(r.aliases) }).select("id").single();
      if (ins.error) throw new Error(ins.error.message);
      id = (ins.data as { id: string }).id;
    }
    const li = await db.from("inventory_recipe_lines").insert(lines.map((l) => ({ workspace_id: c.ws, recipe_id: id, ...l })));
    if (li.error) throw new Error(li.error.message);
    return { id };
  });
}

export async function deleteRecipe(id: string): Promise<Outcome<null>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    const { error } = await admin().from("inventory_recipes").delete().eq("workspace_id", c.ws).eq("id", id);
    if (error) throw new Error(error.message);
    return null;
  });
}

/** Quick change (+/-) or a count. Small changes apply at once; bigger ones wait as an adjust_stock decision. */
export async function adjustStockAction(a: { itemId: string; delta?: number; counted?: number; reason: string }): Promise<Outcome<AdjustResult>> {
  return run(async () => {
    const c = await engineCtx();
    if (!uuid(a.itemId)) throw new Error("Chọn mặt hàng.");
    if (a.delta === undefined && a.counted === undefined) throw new Error("Nhập số lượng.");
    return adjustStock(c, { itemId: a.itemId, delta: a.delta, countedQty: a.counted, reason: text(a.reason, 160) });
  });
}

export async function stockTakeAction(counts: ReadonlyArray<{ itemId: string; counted: number }>): Promise<Outcome<{ applied: number; waiting: number; same: number }>> {
  return run(async () => {
    const c = await engineCtx();
    const clean = counts.filter((k) => uuid(k.itemId) && Number.isFinite(k.counted) && k.counted >= 0).slice(0, 500);
    if (!clean.length) throw new Error("Chưa nhập số đếm nào.");
    return stockTake(c, clean);
  });
}

/** "Soạn đơn cho hàng sắp hết": drafts per supplier and asks for approval (the message is written by OpenClaw). */
export async function draftLowStockAction(): Promise<Outcome<{ drafted: number; low: number }>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    const r = await draftLowStock(admin(), c.ws, { by: c.actor });
    return { drafted: r.poIds.length, low: r.lowCount };
  });
}

export type PoInput = { readonly supplierId: string; readonly expectedAt: string; readonly lines: ReadonlyArray<{ readonly itemId: string; readonly qty: string; readonly unitCost: string }> };

export async function createPoAction(p: PoInput): Promise<Outcome<{ id: string }>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    const db = admin();
    const lines = p.lines.flatMap((l) => (uuid(l.itemId) && num(l.qty) > 0 ? [{ itemId: l.itemId, qty: num(l.qty), unitCost: Math.max(0, num(l.unitCost)) }] : []));
    if (!lines.length) throw new Error("Chọn ít nhất một mặt hàng và số lượng.");
    const supplierId = uuid(p.supplierId);
    const sup = supplierId ? (((await db.from("inventory_suppliers").select("lead_time_days").eq("workspace_id", c.ws).eq("id", supplierId).maybeSingle()).data ?? null) as { lead_time_days: number } | null) : null;
    const id = await createPo(db, c.ws, { supplierId, lines, by: c.actor, source: "manual", leadTimeDays: sup?.lead_time_days ?? 2 });
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.expectedAt)) await db.from("inventory_purchase_orders").update({ expected_at: p.expectedAt }).eq("id", id);
    return { id };
  });
}

/** Edit a draft: supplier, expected date, quantities and prices; a line set to 0 is removed. */
export async function updatePoDraft(p: { poId: string; supplierId: string; expectedAt: string; lines: ReadonlyArray<{ lineId: string; qty: string; unitCost: string }> }): Promise<Outcome<null>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    const db = admin();
    const po = ((await db.from("inventory_purchase_orders").select("id, status").eq("workspace_id", c.ws).eq("id", p.poId).maybeSingle()).data ?? null) as { id: string; status: string } | null;
    if (!po || po.status !== "draft") throw new Error("Chỉ sửa được đơn đang ở trạng thái nháp.");
    for (const l of p.lines) {
      if (!uuid(l.lineId)) continue;
      if (num(l.qty) <= 0) await db.from("inventory_po_lines").delete().eq("id", l.lineId).eq("po_id", po.id);
      else await db.from("inventory_po_lines").update({ qty_ordered: num(l.qty), unit_cost_vnd: Math.max(0, num(l.unitCost)) }).eq("id", l.lineId).eq("po_id", po.id);
    }
    await db.from("inventory_purchase_orders").update({ supplier_id: uuid(p.supplierId), expected_at: /^\d{4}-\d{2}-\d{2}$/.test(p.expectedAt) ? p.expectedAt : null }).eq("id", po.id);
    await recomputeTotal(db, po.id);
    return null;
  });
}

export async function requestSendAction(poId: string): Promise<Outcome<{ status: string }>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    const r = await requestSend(c, poId);
    return { status: r.status };
  });
}

export async function remindSupplierAction(poId: string): Promise<Outcome<{ status: string }>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    const r = await requestSend(c, poId, { kind: "reminder" });
    return { status: r.status };
  });
}

export async function cancelPoAction(poId: string): Promise<Outcome<null>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    await cancelPo(c, poId);
    return null;
  });
}

export async function receivePoAction(p: { poId: string; invoiceNo: string; note: string; lines: ReadonlyArray<{ lineId: string; qty: string; unitCost: string }> }): Promise<Outcome<ReceiveResult>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    return receivePo(c, {
      poId: p.poId, invoiceNo: text(p.invoiceNo, 60), note: text(p.note, 300),
      lines: p.lines.flatMap((l) => (uuid(l.lineId) && num(l.qty) > 0 ? [{ lineId: l.lineId, qty: num(l.qty), unitCost: l.unitCost.trim() === "" ? -1 : Math.max(0, num(l.unitCost)) }] : [])),
    });
  });
}

export async function importPasteAction(raw: string): Promise<Outcome<ImportResult>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    return importPasted(c, raw.slice(0, 200_000));
  });
}

export async function loadTemplateAction(key: string): Promise<Outcome<{ items: number; suppliers: number; recipes: number }>> {
  return run(async () => {
    const c = await engineCtx();
    await requireManager();
    return loadTemplate(c, text(key, 30));
  });
}
