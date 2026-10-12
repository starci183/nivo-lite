import "server-only";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import type { InventoryWorkbench } from "./module-inventory-queries";

/**
 * Inventory workbench figures for the agent dashboard ribbon.
 *
 *   belowReorder  active items whose stock is at or under their reorder point (only items that have one set; sold-out ones included).
 *   posAwaiting   purchase orders in `waiting_approval`.
 *   valueVnd      stock value at weighted average cost (already computed by the workbench loader).
 *   stockOuts7d   distinct active items that dropped to zero or below through a stock movement in the last 7 days (an item that was already
 *                 at zero before the window does not count). Null when the movement history could not be read.
 */
export type InventoryFigures = {
  readonly belowReorder: number;
  readonly itemsTracked: number;
  readonly posAwaiting: number;
  readonly valueVnd: number;
  readonly stockOuts7d: number | null;
};

const DAY = 86_400_000;

export const inventoryFigures = async (data: InventoryWorkbench): Promise<InventoryFigures> => {
  const active = data.items.filter((i) => i.active);
  const base = {
    belowReorder: active.filter((i) => i.reorder_point > 0 && i.total <= i.reorder_point).length,
    itemsTracked: active.length,
    posAwaiting: data.pos.filter((p) => p.status === "waiting_approval").length,
    valueVnd: data.metrics.valueVnd,
  };
  try {
    const session = await getSession();
    const since = new Date(Date.parse(data.nowIso) - 7 * DAY).toISOString();
    const { data: rows, error } = await (await supabaseServer())
      .from("inventory_movements")
      .select("item_id, qty, qty_after")
      .eq("workspace_id", session.workspace.id)
      .lt("qty", 0)
      .lte("qty_after", 0)
      .gte("created_at", since)
      .limit(5000);
    if (error) throw new Error(error.message);
    const activeIds = new Set(active.map((i) => i.id));
    const ids = new Set(((rows ?? []) as Array<{ item_id: string }>).map((r) => r.item_id).filter((id) => activeIds.has(id)));
    return { ...base, stockOuts7d: ids.size };
  } catch (e) {
    console.error("inventory stock-out figure failed", e instanceof Error ? e.message : e);
    return { ...base, stockOuts7d: null };
  }
};
