import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { ContactWorkService } from "@modules/domain/contacts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { ContactWorkView } from "./contact-conversation.contracts"
import { ContactNamesService } from "./contact-names.service"
import { ReadContactWorkQuery } from "./contacts.queries"

@QueryHandler(ReadContactWorkQuery)
/**
 * What the agents did for a person lately (`contactWork`): the latest outcome of each step the memory keeps, newest first, each with the
 * workflow title, the step title (declared by its installed node) in the workspace language, the round as a number and the agent name.
 * A title nothing declares is null, never the key. The page seat (owner or manager); a deleted contact (R31) has none.
 */
export class ReadContactWorkHandler extends ICQRSHandler<ReadContactWorkQuery, ReadonlyArray<ContactWorkView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly access: AgentWorkAccessService,
        private readonly work: ContactWorkService,
        private readonly names: ContactNamesService,
    ) {
        super(logger)
    }

    protected override async process(query: ReadContactWorkQuery): Promise<ReadonlyArray<ContactWorkView>> {
        const { request, principal } = query.params
        await this.access.manager(principal.id, request.workspaceId)
        const steps = await this.work.recent(request.workspaceId, request.contactId, request.limit ?? undefined)
        if (steps.length === 0) return []
        const [workflows, agents] = await Promise.all([
            this.names.workflowNamesOf(request.workspaceId, steps.map((step) => step.workflowId), request.locale),
            this.names.agentsOf(request.workspaceId, steps.map((step) => step.agentId)),
        ])
        return steps.map(
            (step): ContactWorkView => ({
                id: step.id,
                workflowLabel: step.workflowId === null ? null : (workflows.get(step.workflowId) ?? null),
                stepLabel: this.names.stepTitleOf(step.step, request.locale),
                status: step.status,
                round: step.round,
                at: step.at,
                agentId: step.agentId,
                agentName: step.agentId === null ? null : (agents.get(step.agentId)?.name ?? null),
                runId: step.runId,
            }),
        )
    }
}
