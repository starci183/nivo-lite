import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BillingService } from "@modules/domain/billing"
import { CreditsError, CreditsErrorCode, CreditsService } from "@modules/domain/credits"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { isDomainError } from "@modules/platform/errors"
import { isPaymentOrderRequestPayload, PAYMENT_ORDER_REQUEST_QUEUE } from "./payment-order-requests.contracts"
import type {
    PaymentOrderRequestParams,
    PaymentOrderRequestStatusLookup,
    QueuedPaymentOrderRequest,
    RequestOutcome,
} from "./payment-order-requests.contracts"
import { PaymentOrderRequestsError, PaymentOrderRequestsErrorCode } from "./errors/payment-order-requests.error"
import { selectionOf, targetOf, toRequestStatus } from "./payment-order-requests.policy"
import { PaymentOrderRequestEntity } from "./persistence/entities"

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

    /** Commits an authorized manager's request and its durable queue job together, then answers immediately. */
    async request(userId: string, params: PaymentOrderRequestParams): Promise<QueuedPaymentOrderRequest> {
        await this.billing.requireManager(userId, params.workspaceId)
        const target = targetOf(params)
        const selection = selectionOf(params)
        await this.requireTarget(params.kind, target)
        return this.entityManager.transaction(async (manager) => {
            const inserted = await manager.insert(PaymentOrderRequestEntity, {
                workspaceId: params.workspaceId,
                requestedBy: userId,
                kind: params.kind,
                target,
                cycle: selection.cycle,
                tierCredits: selection.tierCredits,
                seats: selection.seats,
            })
            const identifier: { id?: string } | undefined = inserted.identifiers[0]
            if (identifier?.id === undefined) {
                throw new PaymentOrderRequestsError({ code: PaymentOrderRequestsErrorCode.NotCreated })
            }
            await callDbFunction(manager, "public.job_enqueue", [
                params.workspaceId,
                PAYMENT_ORDER_REQUEST_QUEUE,
                PAYMENT_ORDER_REQUEST_QUEUE,
                { workspaceId: params.workspaceId, requestId: identifier.id },
                `payment-order-request:${identifier.id}`,
            ])
            return { id: identifier.id, status: "queued" }
        })
    }

    /** Reads only this manager's own request; another caller or workspace receives no row. */
    async status(userId: string, workspaceId: string, id: string): Promise<PaymentOrderRequestStatusLookup> {
        await this.billing.requireManager(userId, workspaceId)
        const row = await this.entityManager.findOne(PaymentOrderRequestEntity, {
            select: { id: true, status: true, orderId: true, fault: true },
            where: { id, workspaceId, requestedBy: userId },
        })
        return row === null ? null : toRequestStatus(row)
    }

    /**
     * Handles one job payload. A payload of another shape or a request that is gone or already answered changes nothing; a
     * refusal of the domain (not a manager, unknown plan, unpayable) is written to the request; any other failure is thrown so the
     * job is retried.
     */
    async answer(payload: unknown): Promise<RequestOutcome> {
        if (!isPaymentOrderRequestPayload(payload)) return "ignored"
        const request = await this.entityManager.findOne(PaymentOrderRequestEntity, {
            where: { id: payload.requestId, workspaceId: payload.workspaceId },
        })
        if (request?.status !== "pending") return "ignored"
        try {
            const orderId = await this.place(request)
            await this.close(request.id, undefined, { status: "done", orderId })
            return "ordered"
        } catch (cause) {
            if (!isDomainError(cause)) throw cause
            await this.close(request.id, undefined, { status: "failed", fault: cause.code })
            return "failed"
        }
    }

    /** Records the terminal failure after the queue has exhausted retries, preserving a stable code instead of exception prose. */
    async fail(payload: unknown, cause: unknown): Promise<void> {
        if (!isPaymentOrderRequestPayload(payload)) return
        const code = isDomainError(cause) ? cause.code : PaymentOrderRequestsErrorCode.JobFailed
        await this.close(payload.requestId, payload.workspaceId, { status: "failed", fault: code })
    }

    /** Answers a request that is still pending; one already answered stays as it is. */
    private async close(
        id: string,
        workspaceId: string | undefined,
        answer: Pick<Partial<PaymentOrderRequestEntity>, "status" | "orderId" | "fault">,
    ): Promise<void> {
        await this.entityManager.update(
            PaymentOrderRequestEntity,
            { id, status: "pending", ...(workspaceId === undefined ? {} : { workspaceId }) },
            { ...answer, answeredAt: () => "now()" },
        )
    }

    private async requireTarget(kind: PaymentOrderRequestParams["kind"], target: string | null): Promise<void> {
        if (target === null || kind === "credit_pack") return
        if (kind !== "topup") {
            await this.billing.requirePlan(target)
            return
        }
        const packs = await this.credits.listPacks()
        if (!packs.some((pack) => pack.code === target)) {
            throw new CreditsError({ code: CreditsErrorCode.PackNotFound })
        }
    }

    private async place(request: PaymentOrderRequestEntity): Promise<string> {
        const userId = request.requestedBy
        const workspaceId = request.workspaceId
        const target = request.target ?? ""
        switch (request.kind) {
            case "plan":
                return (
                    await this.billing.orderPlan(userId, {
                        workspaceId,
                        planCode: target,
                        selection: {
                            cycle: request.cycle ?? "monthly",
                            tierCredits: request.tierCredits,
                            seats: request.seats ?? 1,
                        },
                    })
                ).order.id
            case "renew":
                return (await this.billing.renew(userId, { workspaceId })).order.id
            case "topup":
                return (await this.credits.topup(userId, { workspaceId, packCode: target })).order.id
            case "credit_pack":
                return (await this.credits.creditPack(userId, { workspaceId, credits: Number(target) })).order.id
            case "upgrade":
                return (await this.credits.upgrade(userId, { workspaceId, planCode: target })).payable.order.id
        }
    }
}
