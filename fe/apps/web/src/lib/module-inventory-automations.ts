import type { Db, Executor } from "./automation-runs"
import type { PipelineConfig, TemplateDef } from "./automation-shared"
import type { PipelineRow } from "./automation-queries"

/** Wave-3 shim: the inventory automations (low stock, weekly report, overdue orders) run in the back end now, so no executor is registered here. */
export const INVENTORY_EXECUTORS: Readonly<Record<string, Executor>> = {}

/** Wave-3 shim: the back end decides what is due and schedules it; the scan here starts nothing. */
export const scanInventory = async (
    _db: Db,
    _line: { readonly p: PipelineRow; readonly def: TemplateDef; readonly config: PipelineConfig },
    _now: Date,
    _fire: (dedupe: string, ref: string, payload: Record<string, unknown>) => Promise<void>,
): Promise<number> => 0
