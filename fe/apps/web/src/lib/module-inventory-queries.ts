import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import { isManagerRole } from "./members-shared";
import { toItem, type ItemRow } from "./module-inventory-core";
import { stockStatus, type InventoryItem, type PoStatus, type StockStatus } from "./module-inventory-shared";
import { TEMPLATE_CHOICES } from "./module-inventory-ops";

/** Everything the Kho & nhập hàng workbench shows, read with the member's own session (RLS: members read). */
const num = (v: unknown): number => Number(v) || 0;

export type SupplierView = {
  readonly id: string; readonly name: string; readonly contact_name: string; readonly email: string | null; readonly phone: string | null; readonly zalo: string | null;
  readonly channel: "email" | "zalo" | "phone"; readonly lead_time_days: number; readonly payment_terms: string; readonly note: string; readonly active: boolean;
};
export type ItemView = InventoryItem & { readonly total: number; readonly status: StockStatus; readonly onOrder: number; readonly levels: ReadonlyArray<{ readonly locationId: string; readonly qty: number }> };
export type PoLineView = { readonly id: string; readonly itemId: string; readonly name: string; readonly unit: string; readonly qtyOrdered: number; readonly qtyReceived: number; readonly unitCost: number };
export type PoView = {
  readonly id: string; readonly po_no: string; readonly supplierId: string | null; readonly supplierName: string; readonly channel: "email" | "zalo" | "phone" | null; readonly status: PoStatus;
  readonly total_vnd: number; readonly expected_at: string | null; readonly message: string; readonly sent_via: "email" | "copy" | null; readonly send_note: string | null;
  readonly work_item_id: string | null; readonly reminders: number; readonly source: "auto" | "manual"; readonly created_at: string; readonly lines: ReadonlyArray<PoLineView>;
};
export type MovementView = { readonly id: string; readonly itemName: string; readonly unit: string; readonly kind: string; readonly qty: number; readonly qty_after: number; readonly reason: string; readonly ref_label: string | null; readonly by_name: string; readonly evidence: string | null; readonly created_at: string };
export type RecipeView = { readonly id: string; readonly name: string; readonly aliases: ReadonlyArray<string>; readonly lines: ReadonlyArray<{ readonly itemId: string; readonly name: string; readonly unit: string; readonly qty: number }> };
export type PendingView = { readonly id: string; readonly action: "send_purchase_order" | "adjust_stock"; readonly summary: string; readonly draft: string | null; readonly poId: string | null; readonly created_at: string };

export type InventoryWorkbench = {
  readonly canManage: boolean;
  readonly defaultLocationId: string | null;
  readonly locations: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly suppliers: ReadonlyArray<SupplierView>;
  readonly items: ReadonlyArray<ItemView>;
  readonly recipes: ReadonlyArray<RecipeView>;
  readonly pos: ReadonlyArray<PoView>;
  readonly movements: ReadonlyArray<MovementView>;
  readonly pending: ReadonlyArray<PendingView>;
  readonly templates: ReadonlyArray<{ readonly key: string; readonly name: string; readonly description: string }>;
  readonly metrics: { readonly valueVnd: number; readonly itemCount: number; readonly lowCount: number; readonly outCount: number; readonly openPos: number; readonly pendingCount: number };
  readonly nowIso: string;
};

/** The signed-in member's workbench: their session, their RLS-scoped client. */
export const getInventoryWorkbench = async (): Promise<InventoryWorkbench> => {
  const session = await getSession();
  return loadInventoryWorkbench(await supabaseServer(), session.workspace.id, isManagerRole(session.member.role));
};

/** The same data from any client (the service role in checks and scripts), for a workspace and a role. */
export const loadInventoryWorkbench = async (db: SupabaseClient, ws: string, canManage: boolean): Promise<InventoryWorkbench> => {
  const [loc, sup, itm, lvl, rec, rl, pos, pol, mov, wi] = await Promise.all([
    db.from("inventory_locations").select("id, name, is_default").eq("workspace_id", ws).order("is_default", { ascending: false }).order("created_at"),
    db.from("inventory_suppliers").select("*").eq("workspace_id", ws).order("name"),
    db.from("inventory_items").select("*").eq("workspace_id", ws).order("name").limit(2000),
    db.from("inventory_stock_levels").select("item_id, location_id, qty").eq("workspace_id", ws).limit(10000),
    db.from("inventory_recipes").select("id, name, aliases").eq("workspace_id", ws).eq("active", true).order("name"),
    db.from("inventory_recipe_lines").select("recipe_id, item_id, qty").eq("workspace_id", ws),
    db.from("inventory_purchase_orders").select("*, supplier:inventory_suppliers(name, channel)").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(200),
    db.from("inventory_po_lines").select("id, po_id, item_id, qty_ordered, qty_received, unit_cost_vnd").eq("workspace_id", ws).limit(3000),
    db.from("inventory_movements").select("id, item_id, kind, qty, qty_after, reason, ref_label, by_name, evidence, created_at").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(200),
    db.from("work_items").select("id, action, proposal, created_at").eq("workspace_id", ws).eq("department", "inventory").eq("status", "waiting_decision").order("created_at"),
  ]);

  const items0 = ((itm.data ?? []) as Array<ItemRow>).map(toItem);
  const nameOf = new Map(items0.map((i) => [i.id, i]));
  const levelsBy = new Map<string, Array<{ locationId: string; qty: number }>>();
  for (const l of (lvl.data ?? []) as Array<{ item_id: string; location_id: string; qty: number | string }>) levelsBy.set(l.item_id, [...(levelsBy.get(l.item_id) ?? []), { locationId: l.location_id, qty: num(l.qty) }]);

  const poLines = new Map<string, Array<PoLineView>>();
  const onOrder = new Map<string, number>();
  const openPoIds = new Set(((pos.data ?? []) as Array<{ id: string; status: string }>).filter((p) => ["draft", "waiting_approval", "sent", "partially_received"].includes(p.status)).map((p) => p.id));
  for (const l of (pol.data ?? []) as Array<{ id: string; po_id: string; item_id: string; qty_ordered: number | string; qty_received: number | string; unit_cost_vnd: number | string }>) {
    const it = nameOf.get(l.item_id);
    poLines.set(l.po_id, [...(poLines.get(l.po_id) ?? []), { id: l.id, itemId: l.item_id, name: it?.name ?? "Hàng đã xoá", unit: it?.unit ?? "", qtyOrdered: num(l.qty_ordered), qtyReceived: num(l.qty_received), unitCost: num(l.unit_cost_vnd) }]);
    if (openPoIds.has(l.po_id)) onOrder.set(l.item_id, (onOrder.get(l.item_id) ?? 0) + Math.max(0, num(l.qty_ordered) - num(l.qty_received)));
  }

  const items: Array<ItemView> = items0.map((i) => {
    const levels = levelsBy.get(i.id) ?? [];
    const total = levels.reduce((s, l) => s + l.qty, 0);
    return { ...i, total, status: stockStatus(i, total), onOrder: onOrder.get(i.id) ?? 0, levels };
  });
  const active = items.filter((i) => i.active);

  const recipeLines = new Map<string, Array<RecipeView["lines"][number]>>();
  for (const l of (rl.data ?? []) as Array<{ recipe_id: string; item_id: string; qty: number | string }>) {
    const it = nameOf.get(l.item_id);
    recipeLines.set(l.recipe_id, [...(recipeLines.get(l.recipe_id) ?? []), { itemId: l.item_id, name: it?.name ?? "Hàng đã xoá", unit: it?.unit ?? "", qty: num(l.qty) }]);
  }

  const poViews: Array<PoView> = ((pos.data ?? []) as Array<Record<string, unknown>>).map((p) => {
    const s = (p.supplier ?? null) as { name: string; channel: "email" | "zalo" | "phone" } | null;
    return {
      id: String(p.id), po_no: String(p.po_no), supplierId: (p.supplier_id as string | null) ?? null, supplierName: s?.name ?? "Chưa chọn nhà cung cấp", channel: s?.channel ?? null, status: p.status as PoStatus,
      total_vnd: num(p.total_vnd), expected_at: (p.expected_at as string | null) ?? null, message: String(p.message ?? ""), sent_via: (p.sent_via as "email" | "copy" | null) ?? null,
      send_note: (p.send_note as string | null) ?? null, work_item_id: (p.work_item_id as string | null) ?? null, reminders: num(p.reminders), source: (p.source as "auto" | "manual") ?? "manual",
      created_at: String(p.created_at), lines: poLines.get(String(p.id)) ?? [],
    };
  });

  const pending: Array<PendingView> = ((wi.data ?? []) as Array<{ id: string; action: PendingView["action"]; proposal: { summary?: string; draft?: string; fields?: Record<string, unknown> }; created_at: string }>).map((w) => ({
    id: w.id, action: w.action, summary: w.proposal?.summary ?? "", draft: w.proposal?.draft ?? null, poId: typeof w.proposal?.fields?.po_id === "string" ? w.proposal.fields.po_id : null, created_at: w.created_at,
  }));

  const metrics = {
    valueVnd: Math.round(active.reduce((s, i) => s + Math.max(0, i.total) * i.cost_vnd, 0)), itemCount: active.length,
    lowCount: active.filter((i) => i.status === "low").length, outCount: active.filter((i) => i.status === "out").length,
    openPos: poViews.filter((p) => ["draft", "waiting_approval", "sent", "partially_received"].includes(p.status)).length, pendingCount: pending.length,
  };

  const locations = ((loc.data ?? []) as Array<{ id: string; name: string; is_default: boolean }>);
  return {
    canManage,
    defaultLocationId: locations[0]?.id ?? null,
    locations: locations.map((l) => ({ id: l.id, name: l.name })),
    suppliers: ((sup.data ?? []) as Array<SupplierView>),
    items, recipes: ((rec.data ?? []) as Array<{ id: string; name: string; aliases: Array<string> | null }>).map((r) => ({ id: r.id, name: r.name, aliases: r.aliases ?? [], lines: recipeLines.get(r.id) ?? [] })),
    pos: poViews,
    movements: ((mov.data ?? []) as Array<{ id: string; item_id: string; kind: string; qty: number | string; qty_after: number | string; reason: string; ref_label: string | null; by_name: string; evidence: string | null; created_at: string }>).map((m) => ({
      id: m.id, itemName: nameOf.get(m.item_id)?.name ?? "Hàng đã xoá", unit: nameOf.get(m.item_id)?.unit ?? "", kind: m.kind, qty: num(m.qty), qty_after: num(m.qty_after), reason: m.reason, ref_label: m.ref_label, by_name: m.by_name, evidence: m.evidence, created_at: m.created_at,
    })),
    pending, templates: TEMPLATE_CHOICES, metrics, nowIso: new Date().toISOString(),
  };
};
