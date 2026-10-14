import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { DecisionsErrorCode, DecisionsService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { DECISIONS_QUEUE, DecisionsJob, decisionsDedupeKey } from "@modules/queues/decisions"
import { LeadGenCommentService } from "./leadgen-comment.service"
import type { LeadGenCommentJobRow } from "./persistence/leadgen-comment.rows"
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

const build = async (
    item: WorkItem,
    jobs: ReadonlyArray<LeadGenCommentJobRow> = [{ state: "queued" }],
    member: WorkspaceMember = MEMBER,
) => {
    const tx = fakeTransaction(mockEntityManager({ query: [FIND_LEADGEN_COMMENT_JOB, jobs] }))
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(member)
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
    return { comments: moduleRef.get(LeadGenCommentService), outbox, tx, members, decisions, write }
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

    it.each([null, undefined])("preserves the proposed draft when the edit is %s", async (draft) => {
        const { comments, outbox, tx, members, decisions, write } = await build(
            itemOf({ assigned_staff_id: "staff-1" }),
            [{ state: "running" }],
            { ...MEMBER, role: "staff", staffId: "staff-1" },
        )

        await expect(
            comments.approve("user-1", {
                workspaceId: "ws-1",
                workItemId: "item-1",
                draft,
                locale: "en",
            }),
        ).resolves.toEqual({
            id: "item-1",
            status: "running",
            workStatus: "waiting_decision",
            resultHref: null,
            errorCode: null,
        })

        expect(write).toHaveBeenCalledWith(
            outbox.entries[0]?.tx,
            DECISIONS_QUEUE,
            {
                workspaceId: "ws-1",
                userId: "user-1",
                locale: "en",
                workItemId: "item-1",
                decision: "approved",
                edits: undefined,
            },
            { job: DecisionsJob.DecideWork, dedupeKey: decisionsDedupeKey(DecisionsJob.DecideWork, "item-1") },
        )
        expect(outbox.allInTransaction).toBe(true)
        expect(tx.outcomes).toEqual(["commit"])
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(decisions.getWorkItem).toHaveBeenNthCalledWith(1, "user-1", "ws-1", "item-1")
        expect(decisions.getWorkItem).toHaveBeenNthCalledWith(2, "user-1", "ws-1", "item-1")
        expect(tx.em.query).toHaveBeenCalledWith(FIND_LEADGEN_COMMENT_JOB, [
            "ws-1",
            DECISIONS_QUEUE,
            DecisionsJob.DecideWork,
            decisionsDedupeKey(DecisionsJob.DecideWork, "item-1"),
        ])
    })

    it("refuses a staff member assigned to another public reply", async () => {
        const { comments, outbox, tx, members } = await build(
            itemOf({ assigned_staff_id: "staff-2" }),
            [{ state: "queued" }],
            { ...MEMBER, role: "staff", staffId: "staff-1" },
        )

        await expect(
            comments.approve("user-1", {
                workspaceId: "ws-1",
                workItemId: "item-1",
                draft: "Changed",
                locale: "en",
            }),
        ).rejects.toMatchObject({ code: DecisionsErrorCode.NotAllowed })

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(outbox.jobs).toEqual([])
        expect(tx.outcomes).toEqual([])
        expect(tx.em.query).not.toHaveBeenCalled()
    })

    it.each([
        { department: "sales", action: "reply_comment_public" },
        { department: "lead_gen", action: "score_lead" },
    ])("hides work items outside public lead-gen comments: %j", async (overrides) => {
        const { comments, decisions, tx } = await build(itemOf(overrides))

        await expect(comments.status("user-1", "ws-1", "item-1")).rejects.toMatchObject({
            code: DecisionsErrorCode.NotFound,
        })

        expect(decisions.getWorkItem).toHaveBeenCalledWith("user-1", "ws-1", "item-1")
        expect(tx.em.query).not.toHaveBeenCalled()
    })

    it("hides a nonterminal comment with no approval job", async () => {
        const { comments, tx } = await build(itemOf(), [])

        await expect(comments.status("user-1", "ws-1", "item-1")).rejects.toMatchObject({
            code: DecisionsErrorCode.NotFound,
        })

        expect(tx.em.query).toHaveBeenCalledWith(FIND_LEADGEN_COMMENT_JOB, [
            "ws-1",
            DECISIONS_QUEUE,
            DecisionsJob.DecideWork,
            decisionsDedupeKey(DecisionsJob.DecideWork, "item-1"),
        ])
    })

    it.each<{
        workStatus: WorkItem["status"]
        jobState: LeadGenCommentJobRow["state"] | null
        status: string
        errorCode: DecisionsErrorCode | null
    }>([
        { workStatus: "done", jobState: null, status: "succeeded", errorCode: null },
        { workStatus: "done", jobState: "done", status: "succeeded", errorCode: null },
        { workStatus: "failed", jobState: null, status: "failed", errorCode: DecisionsErrorCode.WorkFailed },
        { workStatus: "rejected", jobState: null, status: "failed", errorCode: DecisionsErrorCode.WorkFailed },
        { workStatus: "failed", jobState: "queued", status: "failed", errorCode: DecisionsErrorCode.WorkFailed },
        { workStatus: "rejected", jobState: "running", status: "failed", errorCode: DecisionsErrorCode.WorkFailed },
        {
            workStatus: "waiting_decision",
            jobState: "failed",
            status: "failed",
            errorCode: DecisionsErrorCode.WorkFailed,
        },
        {
            workStatus: "waiting_decision",
            jobState: "done",
            status: "failed",
            errorCode: DecisionsErrorCode.WorkFailed,
        },
        { workStatus: "done", jobState: "failed", status: "failed", errorCode: DecisionsErrorCode.WorkFailed },
    ])("reports work=$workStatus, job=$jobState as $status", async ({ workStatus, jobState, status, errorCode }) => {
        const { comments } = await build(
            itemOf({ status: workStatus, result: { summary: "Replied", href: "https://example.test/comment/1" } }),
            jobState === null ? [] : [{ state: jobState }],
        )

        await expect(comments.status("user-1", "ws-1", "item-1")).resolves.toEqual({
            id: "item-1",
            status,
            workStatus,
            resultHref: "https://example.test/comment/1",
            errorCode,
        })
    })

    it("reports a successful comment without a result link", async () => {
        const { comments } = await build(itemOf({ status: "done", result: { summary: "Replied" } }), [])

        await expect(comments.status("user-1", "ws-1", "item-1")).resolves.toEqual({
            id: "item-1",
            status: "succeeded",
            workStatus: "done",
            resultHref: null,
            errorCode: null,
        })
    })
})
