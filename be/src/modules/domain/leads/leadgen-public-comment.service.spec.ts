import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ConnectionsService } from "@modules/domain/connections"
import { DecisionsErrorCode, WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { Proposal, WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { META_CLIENT } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LeadGenPublicCommentService } from "./leadgen-public-comment.service"

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "lead_gen",
    action: "reply_comment_public",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Reply", fields: { comment_id: "comment-1" }, draft: "Thanks" },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T03:00:00.000Z",
    updated_at: "2026-10-12T03:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const CTX: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }
const PROPOSAL: Proposal = { summary: "Reply", fields: {}, draft: "" }

const build = async () => {
    const registry = mock<WorkPerformerRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadGenPublicCommentService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: META_CLIENT, useValue: mock<MetaClient>() },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
            { provide: ConnectionsService, useValue: mock<ConnectionsService>() },
            { provide: AgentConversationsService, useValue: mock<AgentConversationsService>() },
            { provide: AgentMessagesService, useValue: mock<AgentMessagesService>() },
        ],
    }).compile()
    return { performer: moduleRef.get(LeadGenPublicCommentService), registry }
}

describe("LeadGenPublicCommentService", () => {
    it("registers itself as the public-comment performer", async () => {
        const { performer, registry } = await build()

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("reply_comment_public", performer)
    })

    it("keeps the approved draft as the proposal", async () => {
        const { performer } = await build()
        const item = itemOf()

        await expect(performer.prepare(CTX, item)).resolves.toEqual({ proposal: item.proposal })
    })

    it("refuses a reply that has no comment id or draft", async () => {
        const { performer } = await build()

        await expect(performer.perform(CTX, itemOf(), PROPOSAL, { name: "Lan", kind: "owner" })).rejects.toMatchObject({
            code: DecisionsErrorCode.StillMissing,
            params: { fields: "comment_id, draft" },
        })
    })
})
