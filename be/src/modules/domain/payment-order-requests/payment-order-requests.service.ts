import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BillingService } from "@modules/domain/billing"
import { CreditsError, CreditsErrorCode, CreditsService } from "@modules/domain/credits"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { isPaymentOrderRequestPayload, PAYMENT_ORDER_REQUEST_QUEUE } from "./payment-order-requests.contracts"
import type {
    PaymentOrderRequestParams,
    PaymentOrderRequestStatusLookup,
    QueuedPaymentOrderRequest,
    RequestOutcome,
} from "./payment-order-requests.contracts"
import { PaymentOrderRequestsError, PaymentOrderRequestsErrorCode } from "./errors/payment-order-requests.error"
import { selectionOf, targetOf, toRequestStatus } from "./payment-order-requests.policy"
import type { InsertedRequestRow, RequestRow, RequestStatusRow } from "./persistence/payment-order-requests.rows"
import {
    ENQUEUE_REQUEST,
    INSERT_REQUEST,
    MARK_EXHAUSTED_REQUEST_FAILED,
    MARK_REQUEST_DONE,
    MARK_REQUEST_FAILED,
    SELECT_REQUEST,
    SELECT_REQUEST_STATUS,
} from "./persistence/payment-order-requests.sql"

@Injectable()
/**
 * Creates authorized payment order requests and answers them with database prices through the existing fenced job.
 */
export class PaymentOrderRequestsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly billing: BillingService,
        private readonly credits: CreditsService,
    ) {}

    /** Commits an authorized manager's request and its existing pgmq job together, then answers immediately. */
    async request(userId: string, params: PaymentOrderRequestParams): Promise<QueuedPaymentOrderRequest> {
        await this.billing.requireManager(userId, params.workspaceId)
        const target = targetOf(params)
        const selection = selectionOf(params)
        await this.requireTarget(params.kind, target)
        return this.entityManager.transaction(async (manager) => {
            const [row] = await manager.query<Array<InsertedRequestRow>>(INSERT_REQUEST, [
                params.workspaceId,
                userId,
                params.kind,
                target,
                selection.cycle,
                selection.tierCredits,
                selection.seats,
            ])
            if (row === undefined) {
                throw new PaymentOrderRequestsError({ code: PaymentOrderRequestsErrorCode.NotCreated })
            }
            await manager.query(ENQUEUE_REQUEST, [params.workspaceId, PAYMENT_ORDER_REQUEST_QUEUE, row.id])
            return { id: row.id, status: "queued" }
        })
    }

    /** Reads only this manager's own request; another caller or workspace receives no row. */
    async status(userId: string, workspaceId: string, id: string): Promise<PaymentOrderRequestStatusLookup> {
        await this.billing.requireManager(userId, workspaceId)
        const [row] = await this.entityManager.query<Array<RequestStatusRow>>(SELECT_REQUEST_STATUS, [
            id,
            workspaceId,
            userId,
        ])
        return row === undefined ? null : toRequestStatus(row)
    }

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

    /** Records the terminal failure after the queue has exhausted retries, preserving a stable code instead of exception prose. */
    async fail(payload: unknown, cause: unknown): Promise<void> {
        if (!isPaymentOrderRequestPayload(payload)) return
        const code = cause instanceof DomainError ? cause.code : PaymentOrderRequestsErrorCode.JobFailed
        await this.entityManager.query(MARK_EXHAUSTED_REQUEST_FAILED, [payload.requestId, payload.workspaceId, code])
    }

    private async requireTarget(kind: PaymentOrderRequestParams["kind"], target: string | null): Promise<void> {
        if (target === null) return
        if (kind !== "topup") {
            await this.billing.requirePlan(target)
            return
        }
        const packs = await this.credits.listPacks()
        if (!packs.some((pack) => pack.code === target)) {
            throw new CreditsError({ code: CreditsErrorCode.PackNotFound })
        }
    }

    private async place(request: RequestRow): Promise<string> {
        const userId = request.requested_by
        const workspaceId = request.workspace_id
        const target = request.target ?? ""
        switch (request.kind) {
            case "plan":
                return (
                    await this.billing.orderPlan(userId, {
                        workspaceId,
                        planCode: target,
                        selection: {
                            cycle: request.cycle ?? "monthly",
                            tierCredits: request.tier_credits,
                            seats: request.seats ?? 1,
                        },
                    })
                ).order.id
            case "renew":
                return (await this.billing.renew(userId, { workspaceId })).order.id
            case "topup":
                return (await this.credits.topup(userId, { workspaceId, packCode: target })).order.id
            case "upgrade":
                return (await this.credits.upgrade(userId, { workspaceId, planCode: target })).payable.order.id
        }
    }
}
