import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SettledRequest } from "./approval-requests-read.contracts"
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
}
