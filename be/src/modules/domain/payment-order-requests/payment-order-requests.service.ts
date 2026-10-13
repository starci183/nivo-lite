import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BillingService } from "@modules/domain/billing"
import { CreditsService } from "@modules/domain/credits"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { isPaymentOrderRequestPayload } from "./payment-order-requests.contracts"
import type { RequestOutcome } from "./payment-order-requests.contracts"
import type { RequestRow } from "./persistence/payment-order-requests.rows"
import { MARK_REQUEST_DONE, MARK_REQUEST_FAILED, SELECT_REQUEST } from "./persistence/payment-order-requests.sql"

@Injectable()
/**
 * Answers the payment order requests members create through the database: it makes the order the request names with the figures of
 * the database (never the caller figures) and writes the order id, or the refusal code, back to the request row.
 */
export class PaymentOrderRequestsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly billing: BillingService,
        private readonly credits: CreditsService,
    ) {}

    /**
     * Handles one job payload. A payload of another shape or a request that is gone or already answered changes nothing; a
     * refusal of the domain (not a manager, unknown plan, unpayable) is written to the request; any other failure is thrown so the
     * job is retried.
     */
    async answer(payload: unknown): Promise<RequestOutcome> {
        if (!isPaymentOrderRequestPayload(payload)) return "ignored"
        const [request] = await this.entityManager.query<Array<RequestRow>>(SELECT_REQUEST, [
            payload.requestId,
            payload.workspaceId,
        ])
        if (request === undefined || request.status !== "pending") return "ignored"
        try {
            const orderId = await this.place(request)
            await this.entityManager.query(MARK_REQUEST_DONE, [request.id, orderId])
            return "ordered"
        } catch (cause) {
            if (!(cause instanceof DomainError)) throw cause
            await this.entityManager.query(MARK_REQUEST_FAILED, [request.id, cause.code])
            return "failed"
        }
    }

    private async place(request: RequestRow): Promise<string> {
        const userId = request.requested_by
        const workspaceId = request.workspace_id
        const target = request.target ?? ""
        switch (request.kind) {
            case "plan":
                return (await this.billing.orderPlan(userId, { workspaceId, planCode: target })).order.id
            case "renew":
                return (await this.billing.renew(userId, { workspaceId })).order.id
            case "topup":
                return (await this.credits.topup(userId, { workspaceId, packCode: target })).order.id
            case "upgrade":
                return (await this.credits.upgrade(userId, { workspaceId, planCode: target })).payable.order.id
        }
    }
}
