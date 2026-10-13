import "server-only"

import { cache } from "react"
import type { InventoryWorkbenchData } from "@/modules/types"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { buildInventoryWorkbench } from "./inventory.mapper"

const DAY_MS = 86_400_000
const STOCK_OUT_DAYS = 7
const ITEMS_LIMIT = 2000
const LEVELS_LIMIT = 10_000
const POS_LIMIT = 200
const PO_LINES_LIMIT = 3000
const MOVEMENTS_LIMIT = 200
const STOCK_OUT_LIMIT = 5000
const WORK_LIMIT = 100

/**
 * Reads the whole inventory workbench of a workspace under the caller's RLS (members read) and shapes it; a failed read of any table is a
 * typed failure, never a half-empty workbench. The stock-out history is its own read: when only that one fails the figure is unknown.
 */
export const readInventoryWorkbench = cache(
    async (workspaceId: string, canManage: boolean): Promise<DbOutcome<InventoryWorkbenchData>> => {
        const client = await createServerDbClient()
        const now = new Date()
        const since = new Date(now.getTime() - STOCK_OUT_DAYS * DAY_MS).toISOString()
        const [locations, suppliers, items, levels, recipes, recipeLines, pos, poLines, movements, work, drops] =
            await Promise.all([
                client
                    .from("inventory_locations")
                    .select("id, name, is_default")
                    .eq("workspace_id", workspaceId)
                    .order("is_default", { ascending: false })
                    .order("created_at")
                    .limit(100),
                client.from("inventory_suppliers").select("*").eq("workspace_id", workspaceId).order("name").limit(500),
                client
                    .from("inventory_items")
                    .select("*")
                    .eq("workspace_id", workspaceId)
                    .order("name")
                    .limit(ITEMS_LIMIT),
                client
                    .from("inventory_stock_levels")
                    .select("item_id, location_id, qty")
                    .eq("workspace_id", workspaceId)
                    .limit(LEVELS_LIMIT),
                client
                    .from("inventory_recipes")
                    .select("id, name, aliases")
                    .eq("workspace_id", workspaceId)
                    .eq("active", true)
                    .order("name")
                    .limit(500),
                client
                    .from("inventory_recipe_lines")
                    .select("recipe_id, item_id, qty")
                    .eq("workspace_id", workspaceId)
                    .limit(LEVELS_LIMIT),
                client
                    .from("inventory_purchase_orders")
                    .select("*, supplier:inventory_suppliers(name, channel)")
                    .eq("workspace_id", workspaceId)
                    .order("created_at", { ascending: false })
                    .limit(POS_LIMIT),
                client.from("inventory_po_lines").select("*").eq("workspace_id", workspaceId).limit(PO_LINES_LIMIT),
                client
                    .from("inventory_movements")
                    .select("id, item_id, kind, qty, qty_after, reason, ref_label, by_name, evidence, created_at")
                    .eq("workspace_id", workspaceId)
                    .order("created_at", { ascending: false })
                    .limit(MOVEMENTS_LIMIT),
                client
                    .from("work_items")
                    .select("id, action, proposal, created_at")
                    .eq("workspace_id", workspaceId)
                    .eq("department", "inventory")
                    .eq("status", "waiting_decision")
                    .order("created_at")
                    .limit(WORK_LIMIT),
                client
                    .from("inventory_movements")
                    .select("item_id")
                    .eq("workspace_id", workspaceId)
                    .lt("qty", 0)
                    .lte("qty_after", 0)
                    .gte("created_at", since)
                    .limit(STOCK_OUT_LIMIT),
            ])
        const broken = [locations, suppliers, items, levels, recipes, recipeLines, pos, poLines, movements, work].find(
            (result) => result.error !== null,
        )
        if (broken?.error) return dbFailure("unavailable", broken.error.code)
        return dbOk(
            buildInventoryWorkbench(
                {
                    locations: locations.data ?? [],
                    suppliers: suppliers.data ?? [],
                    items: items.data ?? [],
                    levels: levels.data ?? [],
                    recipes: recipes.data ?? [],
                    recipeLines: recipeLines.data ?? [],
                    pos: pos.data ?? [],
                    poLines: poLines.data ?? [],
                    movements: movements.data ?? [],
                    work: work.data ?? [],
                    stockOutItemIds: drops.error === null ? (drops.data ?? []).map((row) => row.item_id) : null,
                },
                { canManage, nowIso: now.toISOString() },
            ),
        )
    },
)
