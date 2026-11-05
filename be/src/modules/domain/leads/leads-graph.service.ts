import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { NodeQuery, SubjectRef } from "@nivo-lite/agent-sdk/node"
import type { RightScope } from "@nivo-lite/agent-sdk/rights"
import { GraphNodeRegistryService, rowsAnswering } from "@modules/domain/graph-nodes"
import type { NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { InjectLeadConversations } from "./leads.decorators"
import type { LeadConversationDirectory } from "./leads.port"
import type { LeadRecordRow } from "./lead-records.contracts"
import { LeadRecordsService } from "./lead-records.service"

/** The most leads one workspace read looks through. */
const WORKSPACE_LIMIT = 500

/** The lead as the `sales-lead` data kind names its fields. */
const rowOf = (lead: LeadRecordRow): NodeRow => ({
    id: lead.id,
    contactName: lead.contact_name,
    company: lead.company,
    channel: lead.channel,
    need: lead.need,
    stage: lead.stage,
    phone: lead.phone,
    email: lead.email,
    contextSummary: lead.context_summary,
})

@Injectable()
/**
 * The customers as graph nodes see them: the `sales-lead` data port, over the lead records. A turn read reaches the lead the turn is
 * about; a workspace read reaches the workspace's leads, and no other workspace's. A turn that names a conversation and no subject is
 * about the lead of the conversation, which the subject resolver tells the host.
 */
export class LeadsGraphService implements OnModuleInit {
    constructor(
        @InjectLeadConversations() private readonly conversations: LeadConversationDirectory,
        private readonly records: LeadRecordsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the port when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addDataPort({ kind: "sales-lead", read: (turn, query, scope) => this.read(turn, query, scope) })
        this.registry?.addSubjectResolver({ subjectOf: (turn) => this.subjectOf(turn) })
    }

    private async read(turn: NodeTurn, query: NodeQuery, scope: RightScope): Promise<ReadonlyArray<NodeRow>> {
        const found =
            scope === "workspace" ? await this.records.list(turn.workspaceId, WORKSPACE_LIMIT) : await this.linked(turn)
        return rowsAnswering(found.map(rowOf), query)
    }

    private async linked(turn: NodeTurn): Promise<ReadonlyArray<LeadRecordRow>> {
        if (turn.subject?.kind !== "sales-lead") return []
        const lead = await this.records.find(turn.workspaceId, turn.subject.id)
        return lead === null ? [] : [lead]
    }

    private async subjectOf(turn: NodeTurn): Promise<SubjectRef | null> {
        if (turn.conversationId === null) return null
        const leadId = await this.conversations.leadIdOf(turn.workspaceId, turn.conversationId)
        return leadId === null ? null : { kind: "sales-lead", id: leadId }
    }
}
