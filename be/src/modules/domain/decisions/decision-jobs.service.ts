import { Injectable } from "@nestjs/common"
import type { DecideExecutionPayload, DecideWorkPayload } from "@modules/queues/decisions"
import { WorkDecisionService } from "./work-decision.service"

@Injectable()
/** The decisions a person asked through the database: they reach the same service the API uses, as the person the payload names. */
export class DecisionJobsService {
    constructor(private readonly decisions: WorkDecisionService) {}

    /** Decides one work item. */
    async decideWork(payload: DecideWorkPayload): Promise<void> {
        await this.decisions.decide(payload.userId, payload.workspaceId, {
            workItemId: payload.workItemId,
            decision: payload.decision,
            edits: payload.edits ?? undefined,
            note: payload.note,
            basis: payload.basis,
            locale: payload.locale,
        })
    }

    /** Decides one approval card. */
    async decideExecution(payload: DecideExecutionPayload): Promise<void> {
        await this.decisions.decideExecution(payload.userId, payload.workspaceId, {
            executionId: payload.executionId,
            decision: payload.decision,
            editedDraft: payload.editedDraft,
            locale: payload.locale,
        })
    }
}
