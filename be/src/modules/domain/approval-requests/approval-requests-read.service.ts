import { Injectable } from "@nestjs/common"
import { In, Not, type EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalRequestCard, RequestStanding, SettledRequest } from "./approval-requests-read.contracts"
import { ApprovalRequestEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of approval requests for other capabilities: how a request ended, always bounded by the caller. */
export class ApprovalRequestsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** How each of the given requests ended; a request that is still pending or does not exist is missing from the answer. */
    async settledOf(requestIds: ReadonlyArray<string>): Promise<Array<SettledRequest>> {
        if (requestIds.length === 0) return []
        const requests = await this.entityManager.find(ApprovalRequestEntity, {
            select: { id: true, status: true, resolvedBy: true },
            where: { id: In([...requestIds]), status: Not("pending") },
            take: requestIds.length,
        })
        return requests.flatMap((request) =>
            request.status === "pending"
                ? []
                : [{ id: request.id, status: request.status, resolvedBy: request.resolvedBy }],
        )
    }

    /** The seats a pending request asked when it opened; empty when it is settled or does not exist. */
    async askedOf(workspaceId: string, requestId: string): Promise<Array<string>> {
        const request = await this.entityManager.findOne(ApprovalRequestEntity, {
            select: { approvers: true },
            where: { id: requestId, workspaceId, status: "pending" },
        })
        return request === null ? [] : request.approvers.map((approver) => approver.memberId)
    }

    /** One request of the workspace as a chat card reads it; null when the workspace has no such request. */
    async cardOf(workspaceId: string, requestId: string): Promise<OptionalRequestCard> {
        const request = await this.entityManager.findOne(ApprovalRequestEntity, {
            select: { id: true, action: true, amount: true, unit: true, requestedByAgentId: true, approverGroup: true },
            where: { id: requestId, workspaceId },
        })
        return request === null
            ? null
            : {
                  id: request.id,
                  action: request.action,
                  amount: request.amount,
                  unit: request.unit,
                  requestedByAgentId: request.requestedByAgentId,
                  approverGroup: request.approverGroup,
              }
    }

    /** Where each of the given requests of the workspace stands; a request the workspace does not have is missing from the answer. */
    async standingOf(workspaceId: string, requestIds: ReadonlyArray<string>): Promise<Array<RequestStanding>> {
        if (requestIds.length === 0) return []
        const requests = await this.entityManager.find(ApprovalRequestEntity, {
            select: { id: true, status: true, resolvedAt: true, resolvedBy: true, approvers: true },
            where: { id: In([...requestIds]), workspaceId },
            take: requestIds.length,
        })
        return requests.map((request) => ({
            id: request.id,
            status: request.status,
            resolvedAt: request.resolvedAt,
            resolvedBy: request.resolvedBy,
            askedSeatIds: request.approvers.map((approver) => approver.memberId),
        }))
    }
}
