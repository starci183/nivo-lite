import { Injectable } from "@nestjs/common"
import { DecisionJobsService } from "@modules/domain/decisions"
import { InboxSimulationWorkerService } from "@modules/domain/inbox-simulation"
import {
    isConfirmCommandPayload,
    isDecideExecutionPayload,
    isDecideWorkPayload,
    isProposeCommandPayload,
    isSimulateInboundPayload,
} from "@modules/queues/decisions"
import { OfficeCommandService } from "./office-command.service"

@Injectable()
/**
 * The consumer of the decisions queue. What a person asked through the database (a decision, an Office command) reaches the same
 * services the API uses, as the person the payload names; the shape of the payload says which job it is, and a payload of another
 * shape is ignored. It lives with the Office composer because that is the capability that can reach both the decisions and the cards.
 */
export class DecisionsQueueService {
    constructor(
        private readonly decisions: DecisionJobsService,
        private readonly commands: OfficeCommandService,
        private readonly simulator: InboxSimulationWorkerService,
    ) {}

    /** Does the work one job of the decisions queue names. */
    async handle(payload: object): Promise<void> {
        if (isSimulateInboundPayload(payload)) return this.simulator.run(payload)
        if (isDecideWorkPayload(payload)) return this.decisions.decideWork(payload)
        if (isDecideExecutionPayload(payload)) return this.decisions.decideExecution(payload)
        if (isProposeCommandPayload(payload)) {
            await this.commands.propose(payload.userId, payload.workspaceId, {
                messageId: payload.messageId,
                locale: payload.locale,
            })
            return
        }
        if (isConfirmCommandPayload(payload)) {
            await this.commands.confirm(payload.userId, payload.workspaceId, {
                candidateId: payload.candidateId,
                locale: payload.locale,
            })
        }
    }
}
