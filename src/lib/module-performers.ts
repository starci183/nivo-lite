import type { Performer } from "./engine";
import { adjustStockPerformer, sendPurchaseOrder } from "./module-inventory-performers";
import type { FlowAction } from "./flow-types";
import { publishPerformer } from "./module-content-publish";
import { BOOKING_PERFORMERS } from "./module-booking-performers";
import { publishVideoPerformer, renderDraftPerformer } from "./module-video-performers";
import { scheduleInterview, screenCandidate, sendOffer } from "@/features/module-hiring/performers";
import { LOYALTY_PERFORMERS } from "./module-loyalty-performers";
import { SHIFTS_PERFORMERS } from "@/features/module-shifts/performers";

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
  ...BOOKING_PERFORMERS, // booking: confirm_booking, reschedule, cancel_booking, cancel_with_fee, remind_booking (src/lib/module-booking-performers.ts)
  render_draft: renderDraftPerformer,
  publish_video: publishVideoPerformer,
  screen_candidate: screenCandidate,
  schedule_interview: scheduleInterview,
  send_offer: sendOffer,
  ...LOYALTY_PERFORMERS, // award_points, redeem_reward, send_promo (src/lib/module-loyalty-performers.ts)
  publish_schedule: SHIFTS_PERFORMERS.publish_schedule,
  approve_swap: SHIFTS_PERFORMERS.approve_swap,
  approve_leave: SHIFTS_PERFORMERS.approve_leave,
  remind_shift: SHIFTS_PERFORMERS.remind_shift,
};
