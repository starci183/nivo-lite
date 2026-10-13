import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { DecisionsErrorCode, DecisionsService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { DECISIONS_QUEUE, DecisionsJob } from "@modules/queues/decisions"
import { LeadGenCommentService } from "./leadgen-comment.service"
import { FIND_LEADGEN_COMMENT_JOB } from "./persistence/leadgen-comment.sql"

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
    proposal: { summary: "Reply", fields: {}, draft: "Thanks" },
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

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const build = async (item: WorkItem) => {
    const tx = fakeTransaction(mockEntityManager({ query: [FIND_LEADGEN_COMMENT_JOB, [{ state: "queued" }]] }))
    const outbox = recordingQueueOutbox()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const decisions = mock<DecisionsService>()
    decisions.getWorkItem.mockResolvedValue(item)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadGenCommentService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: DecisionsService, useValue: decisions },
            { provide: QUEUE_OUTBOX, useValue: outbox },
        ],
    }).compile()
    return { comments: moduleRef.get(LeadGenCommentService), outbox, tx }
}

describe("LeadGenCommentService", () => {
    it("queues an approved public reply and reports the queued job", async () => {
        const { comments, outbox } = await build(itemOf())

        await expect(
            comments.approve("user-1", {
                workspaceId: "ws-1",
                workItemId: "item-1",
                draft: "Thanks",
                locale: "vi",
            }),
        ).resolves.toEqual({
            id: "item-1",
            status: "queued",
            workStatus: "waiting_decision",
            resultHref: null,
            errorCode: null,
        })

        expect(outbox.jobsOf(DECISIONS_QUEUE)).toEqual([
            {
                queue: DECISIONS_QUEUE,
                payload: {
                    workspaceId: "ws-1",
                    userId: "user-1",
                    locale: "vi",
                    workItemId: "item-1",
                    decision: "approved",
                    edits: { draft: "Thanks" },
                },
            },
        ])
        expect(outbox.allInTransaction).toBe(true)
    })

    it("refuses a comment that is not waiting", async () => {
        const { comments, outbox } = await build(itemOf({ status: "done" }))

        await expect(
            comments.approve("user-1", {
                workspaceId: "ws-1",
                workItemId: "item-1",
                draft: null,
                locale: "en",
            }),
        ).rejects.toMatchObject({ code: DecisionsErrorCode.NotWaiting })

        expect(outbox.jobs).toEqual([])
    })
})
