import type { Performer } from "./engine";
import { adjustStockPerformer, sendPurchaseOrder } from "./module-inventory-performers";
import type { FlowAction } from "./flow-types";
import { publishPerformer } from "./module-content-publish";

/**
 * Performers of module actions: what actually happens once the authority gate lets an action through (automatically or after a human
 * approved it). engine.ts holds the performers of the three original modules; a new module registers ITS actions here, one line each:
 *
 *   publish_schedule: publishSchedule,   // from src/features/module-shifts/performers.ts
 *
 * An action without a performer is still gated, decided and logged (work_items / decisions); it just records the decision and
 * does nothing else until its module lane adds the performer. Never perform a customer-facing or money action outside this gate.
 */
export const MODULE_PERFORMERS: Partial<Record<FlowAction, Performer>> = {
  publish_post: publishPerformer,
  send_purchase_order: sendPurchaseOrder,
  adjust_stock: adjustStockPerformer,
};
