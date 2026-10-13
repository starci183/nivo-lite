import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InboundSimulationStoreService } from "@modules/domain/inbound-events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueStatusService } from "@modules/platform/queue"
import type { QueueStatusService } from "@modules/platform/queue"
import { DECISIONS_QUEUE, DecisionsJob, DecisionsQueue, decisionsDedupeKey } from "@modules/queues/decisions"
import { InboxSimulationError, InboxSimulationErrorCode } from "./errors/inbox-simulation.error"
import type { InboxSimulationInput, InboxSimulationReceipt, InboxSimulationStatus } from "./inbox-simulation.contracts"
import { simulationStatusOf, toSimulatedInput } from "./inbox-simulation.policy"
import type { SimulationResultRow, SimulationEventIdentityRow } from "./persistence/inbox-simulation.rows"
import { FIND_SIMULATION_RESULT, NEW_SIMULATION_EVENT_ID } from "./persistence/inbox-simulation.sql"

@Injectable()
/** Records simulated input and enqueues its existing decisions worker; every read and write proves active workspace membership. */
export class InboxSimulationService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly store: InboundSimulationStoreService,
        private readonly decisions: DecisionsQueue,
        @InjectQueueStatusService() private readonly queueStatus: QueueStatusService,
    ) {}

    /** Stores the simulated event and its job atomically; a repeat counts the duplicate and preserves the original job. */
    async request(userId: string, workspaceId: string, input: InboxSimulationInput): Promise<InboxSimulationReceipt> {
        await this.members.require(userId, workspaceId)
        const recorded = await this.entityManager.transaction(async (manager) => {
            const eventId = input.eventId?.trim() || (await this.freshEventId(manager))
            const result = await this.store.record(manager, toSimulatedInput(workspaceId, { ...input, eventId }))
            await this.decisions.enqueueSimulateInbound(
                {
                    kind: "simulate_inbound",
                    workspaceId,
                    userId,
                    locale: input.locale,
                    inboundEventId: result.inboundEventId,
                    items: input.items?.trim() ?? "",
                },
                manager,
            )
            return result
        })
        const job = await this.queueStatus.status(
            workspaceId,
            DECISIONS_QUEUE,
            decisionsDedupeKey(DecisionsJob.SimulateInbound, recorded.inboundEventId),
        )
        return { id: recorded.inboundEventId, duplicate: recorded.duplicate, status: simulationStatusOf(job?.state) }
    }

    private async freshEventId(manager: EntityManager): Promise<string> {
        const [row] = await manager.query<Array<SimulationEventIdentityRow>>(NEW_SIMULATION_EVENT_ID)
        if (row === undefined) throw new InboxSimulationError({ code: InboxSimulationErrorCode.Invalid })
        return row.id
    }

    /** The authoritative job state and refreshed result facts of this workspace's simulated event. */
    async status(userId: string, workspaceId: string, id: string): Promise<InboxSimulationStatus> {
        await this.members.require(userId, workspaceId)
        const [row] = await this.entityManager.query<Array<SimulationResultRow>>(FIND_SIMULATION_RESULT, [
            workspaceId,
            id,
        ])
        if (row === undefined) throw new InboxSimulationError({ code: InboxSimulationErrorCode.NotFound })
        const job = await this.queueStatus.status(
            workspaceId,
            DECISIONS_QUEUE,
            decisionsDedupeKey(DecisionsJob.SimulateInbound, id),
        )
        const status = simulationStatusOf(job?.state, row.work_status, row.queued_count, row.failed_count, row.status)
        return {
            id,
            status,
            errorCode: status === "failed" ? "INBOX_SIMULATION_FAILED" : null,
            event: {
                id: row.id,
                eventId: row.event_id ?? "",
                duplicateCount: row.duplicate_count,
                amountVnd: row.amount_vnd,
                leadId: row.lead_id,
                status: row.status,
            },
            workItem:
                row.work_id === null
                    ? null
                    : { id: row.work_id, department: row.work_department ?? "", status: row.work_status ?? "" },
        }
    }
}
