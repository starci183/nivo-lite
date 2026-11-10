import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { careTaskKeyOf } from "@nivo-lite/blocks-core"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SalesEffectsLogEvent } from "./sales-effects.log-events"

/** The payment timers of an order: the reminder and the stale check `payment.request` armed. */
const PAYMENT_TIMERS = ["payment-reminder", "payment-stale"] as const

/** Closes the open timers of the keys given, whatever agent holds them; answers how many it closed. */
const CLOSE_SQL =
    "UPDATE public.agent_tasks SET status = 'dropped', next_action_at = NULL, waiting_on = NULL, updated_at = now() " +
    "WHERE workspace_id = $1 AND dedupe_key = ANY($2::text[]) AND status IN ('open', 'waiting')"

@Injectable()
/**
 * The payment timers of an order are closed when the order no longer waits for money: settled (`payment.order.settle`) or cancelled
 * (`order.cancel`). Mechanics, not a business choice: a timer of an order that cannot be paid any more would wake the Sales agent for
 * nothing (its own guard then ends the run quietly; that guard stays as the second line). A failure is logged and never fails the
 * settle or the cancel: the guard covers it.
 */
export class PaymentTimersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Closes the open payment timers of the order; how many were closed (0 when none was open or the close failed). */
    async closeOf(workspaceId: string, orderId: string): Promise<number> {
        const keys = PAYMENT_TIMERS.map((kind) => careTaskKeyOf(kind, orderId, ""))
        try {
            const result: unknown = await this.entityManager.query(CLOSE_SQL, [workspaceId, keys])
            const closed: unknown = Array.isArray(result) ? result[1] : undefined
            return typeof closed === "number" ? closed : 0
        } catch (cause) {
            this.logger.error(SalesEffectsLogEvent.PaymentTimersCloseFailed, cause, { orderId })
            return 0
        }
    }
}
