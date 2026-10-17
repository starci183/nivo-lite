import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { WorkContext } from "@modules/domain/decisions"
import type { LeadRecordRow } from "@modules/domain/leads"
import { LeadRecordsService } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DomainError, ERRORS_SERVICE } from "@modules/platform/errors"
import type { ErrorsService } from "@modules/platform/errors"
import { REQUEST_LOCALE } from "@modules/platform/i18n"
import type { RequestLocale } from "@modules/platform/i18n"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { LeadActionsQueue } from "@modules/queues/lead-actions"
import type { ErrorKind } from "@modules/platform/errors"
import type { QueueDelivery } from "@modules/platform/queue"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import { LeadActionsError, LeadActionsErrorCode } from "./errors/lead-actions.error"
import { LeadActionAiService } from "./lead-action-ai.service"
import { LeadActionFlowService } from "./lead-action-flow.service"
import { LeadActionsService } from "./lead-actions.service"
import type { LeadActionInput } from "./lead-actions.contracts"
import type { LeadActionRunRow } from "./persistence/lead-actions.rows"
import {
    BEGIN_LEAD_ACTION,
    FAIL_LEAD_ACTION,
    FIND_LEAD_ACTION,
    INSERT_LEAD_ACTION,
    REFUSE_LEAD_ACTION,
    SUCCEED_LEAD_ACTION,
} from "./persistence/lead-actions.sql"

const LEAD = "11111111-1111-4111-8111-111111111111"
const RESPONSIBILITY = "22222222-2222-4222-8222-222222222222"

class MembershipError extends DomainError<"MEMBERSHIP_FORBIDDEN"> {}

const job: ClaimedJob = {
    jobId: "job-1",
    kind: "lead-actions.run",
    fencingToken: 7,
    currentStep: null,
    payload: { workspaceId: "ws-1", runId: "run-1" },
}

const running: LeadActionRunRow = {
    id: "run-1",
    workspace_id: "ws-1",
    requested_by: "user-1",
    action: "refresh-context",
    input: { leadId: LEAD },
    locale: "vi",
    status: "running",
    result: null,
    error_code: null,
}

const member: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const lead: LeadRecordRow = {
    id: LEAD,
    workspace_id: "ws-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "tea",
    stage: "new",
    context_summary: null,
    phone: null,
    email: null,
    origin: "live",
}

const build = async (stubs: ReadonlyArray<readonly [string, unknown]> = []) => {
    const tx = fakeTransaction(mockEntityManager({ query: stubs }))
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(member)
    const leads = mock<LeadRecordsService>()
    leads.require.mockResolvedValue(lead)
    const locale = mock<RequestLocale>()
    locale.of.mockReturnValue("vi")
    const queue = mock<LeadActionsQueue>()
    queue.enqueue.mockResolvedValue(undefined)
    const errors = mock<ErrorsService>()
    errors.describe.mockReturnValue({ code: LeadActionsErrorCode.NotFound, kind: "not-found", status: 404, params: {} })
    const claims = mock<JobClaims>()
    claims.withFailedFence.mockImplementation((_id, work) => work({ jobId: "job-1", expectedFencingToken: 7 }))
    const responsibilities = mock<ResponsibilityJournalService>()
    const ai = mock<LeadActionAiService>()
    const flow = mock<LeadActionFlowService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadActionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: REQUEST_LOCALE, useValue: locale },
            { provide: ERRORS_SERVICE, useValue: errors },
            { provide: JOB_CLAIMS, useValue: claims },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: LeadRecordsService, useValue: leads },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: LeadActionsQueue, useValue: queue },
            { provide: LeadActionAiService, useValue: ai },
            { provide: LeadActionFlowService, useValue: flow },
        ],
    }).compile()
    return {
        actions: moduleRef.get(LeadActionsService),
        tx,
        queue,
        leads,
        errors,
        claims,
        responsibilities,
        ai,
        flow,
        members,
        locale,
    }
}

const createInput = {
    contactName: "Lan",
    company: "Hue Tea",
    channel: "zalo",
    need: "oolong tea",
    phone: null,
    email: null,
}

const transientKinds: ReadonlyArray<ErrorKind> = ["unavailable", "internal", "rate-limited"]

const delivery: QueueDelivery = {
    id: "delivery-1",
    queue: "lead_actions",
    job: "lead-actions.run",
    payload: { workspaceId: "ws-1", runId: "run-1" },
    attempt: 3,
    signal: new AbortController().signal,
}

describe("LeadActionsService", () => {
    it("enqueues a validated capture and answers the queued run", async () => {
        const { actions, queue } = await build([[INSERT_LEAD_ACTION, [{ id: "run-1" }]]])

        await expect(actions.request("user-1", "ws-1", "create", createInput, "vi")).resolves.toEqual({
            id: "run-1",
            status: "queued",
        })
        expect(queue.enqueue).toHaveBeenCalledWith({ workspaceId: "ws-1", runId: "run-1" }, expect.anything())
    })

    it("refuses a capture whose name is too short", async () => {
        const { actions } = await build()

        await expect(
            actions.request("user-1", "ws-1", "create", { ...createInput, contactName: "L" }, "vi"),
        ).rejects.toMatchObject({ code: LeadActionsErrorCode.InvalidInput })
    })

    it("returns the stored progress of a run in the workspace", async () => {
        const row: LeadActionRunRow = {
            id: "run-1",
            workspace_id: "ws-1",
            requested_by: "user-1",
            action: "refresh-context",
            input: { leadId: LEAD },
            locale: "vi",
            status: "succeeded",
            result: { leadId: LEAD, contextSummary: "brief" },
            error_code: null,
        }
        const { actions } = await build([[FIND_LEAD_ACTION, [row]]])

        await expect(actions.status("user-1", "ws-1", "run-1")).resolves.toEqual({
            id: "run-1",
            status: "succeeded",
            result: { leadId: LEAD, contextSummary: "brief" },
            errorCode: null,
        })
    })

    it("refuses a run the workspace does not have", async () => {
        const { actions } = await build([[FIND_LEAD_ACTION, []]])

        await expect(actions.status("user-1", "ws-1", "missing")).rejects.toMatchObject({
            code: LeadActionsErrorCode.NotFound,
        })
    })

    it("refuses to settle a lead that is not won", async () => {
        const { actions } = await build()

        await expect(
            actions.request("user-1", "ws-1", "settle-won", { leadId: LEAD, evidence: null }, "vi"),
        ).rejects.toMatchObject({ code: LeadActionsErrorCode.NotWon })
    })
})

describe("LeadActionsService", () => {
    it("ignores a job that is not a lead action", async () => {
        const { actions, tx } = await build()
        const job: ClaimedJob = {
            jobId: "job-1",
            kind: "lead-actions.run",
            fencingToken: 1,
            currentStep: null,
            payload: {},
        }

        await expect(actions.run(job)).resolves.toBeUndefined()
        expect(tx.em.query).not.toHaveBeenCalled()
    })

    it("rolls back when insertion returns no run", async () => {
        const { actions, tx, queue } = await build([[INSERT_LEAD_ACTION, []]])

        await expect(actions.request("user-1", "ws-1", "create", createInput, "vi")).rejects.toMatchObject({
            code: LeadActionsErrorCode.NotFound,
        })
        expect(tx.rollbacks).toBe(1)
        expect(queue.enqueue).not.toHaveBeenCalled()
    })

    it("proves a responsibility target and stores only its normalized id", async () => {
        const { actions, responsibilities, tx, members, locale } = await build([
            [INSERT_LEAD_ACTION, [{ id: "run-1" }]],
        ])
        const target = mock<ResponsibilityRecord>({ id: RESPONSIBILITY, lead_id: LEAD })
        responsibilities.find.mockResolvedValue(target)

        await expect(
            actions.request("user-1", "ws-1", "draft-execution", { responsibilityId: RESPONSIBILITY }, "en"),
        ).resolves.toEqual({ id: "run-1", status: "queued" })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(responsibilities.find).toHaveBeenCalledWith("ws-1", RESPONSIBILITY)
        expect(locale.of).toHaveBeenCalledWith("en")
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_LEAD_ACTION, [
            "ws-1",
            "user-1",
            "draft-execution",
            JSON.stringify({ responsibilityId: RESPONSIBILITY }),
            "vi",
        ])
    })

    it("refuses a responsibility absent from the workspace before enqueueing", async () => {
        const { actions, responsibilities, tx } = await build()
        responsibilities.find.mockResolvedValue(null)

        await expect(
            actions.request("user-1", "ws-1", "draft-execution", { responsibilityId: RESPONSIBILITY }, undefined),
        ).rejects.toMatchObject({ code: LeadActionsErrorCode.NotFound })
        expect(responsibilities.find).toHaveBeenCalledWith("ws-1", RESPONSIBILITY)
        expect(tx.em.transaction).not.toHaveBeenCalled()
    })
})

describe("LeadActionsService", () => {
    it.each(["refresh-context", "suggest-owner", "settle-won"] as const)(
        "proves the lead before enqueueing %s",
        async (action) => {
            const { actions, leads, queue } = await build([[INSERT_LEAD_ACTION, [{ id: "run-1" }]]])
            leads.require.mockResolvedValue({ ...lead, stage: "won" })

            await expect(actions.request("user-1", "ws-1", action, { leadId: LEAD }, "vi")).resolves.toEqual({
                id: "run-1",
                status: "queued",
            })
            expect(leads.require).toHaveBeenCalledWith("ws-1", LEAD)
            expect(queue.enqueue).toHaveBeenCalledWith({ workspaceId: "ws-1", runId: "run-1" }, expect.anything())
        },
    )

    it("leaves an absent or terminal run untouched after attempting to begin", async () => {
        const { actions, tx, members, ai } = await build([[BEGIN_LEAD_ACTION, []]])

        await expect(actions.run(job)).resolves.toBeUndefined()
        expect(tx.em.query).toHaveBeenCalledWith(BEGIN_LEAD_ACTION, ["ws-1", "run-1", "job-1", 7])
        expect(tx.em.query).toHaveBeenCalledTimes(1)
        expect(members.require).not.toHaveBeenCalled()
        expect(ai.refreshContext).not.toHaveBeenCalled()
    })

    it.each([
        ["create", createInput],
        ["refresh-context", { leadId: LEAD }],
        ["suggest-owner", { leadId: LEAD }],
        ["draft-execution", { responsibilityId: RESPONSIBILITY }],
        ["settle-won", { leadId: LEAD, evidence: "Agreed to buy" }],
    ] as const)("executes stored %s as its member and records the fenced result", async (action, input) => {
        const row: LeadActionRunRow = { ...running, action, input }
        const { actions, tx, ai, flow, members } = await build([
            [BEGIN_LEAD_ACTION, [row]],
            [SUCCEED_LEAD_ACTION, [{ id: "run-1" }]],
        ])
        const result = { leadId: LEAD, workItemId: "work-1" }
        ai.refreshContext.mockResolvedValue(result)
        ai.suggestOwner.mockResolvedValue(result)
        flow.create.mockResolvedValue(result)
        flow.draft.mockResolvedValue(result)
        flow.settleWon.mockResolvedValue(result)

        await expect(actions.run(job)).resolves.toBeUndefined()
        const ctx = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }
        const selected = {
            create: flow.create,
            "refresh-context": ai.refreshContext,
            "suggest-owner": ai.suggestOwner,
            "draft-execution": flow.draft,
            "settle-won": flow.settleWon,
        }[action]
        const args =
            action === "refresh-context" ? [ctx, LEAD] : action === "suggest-owner" ? [ctx, "user-1", LEAD] : [ctx, row]
        expect(selected).toHaveBeenCalledWith(...args)
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(tx.em.query).toHaveBeenCalledWith(SUCCEED_LEAD_ACTION, [
            "run-1",
            "ws-1",
            "job-1",
            7,
            JSON.stringify(result),
        ])
    })
})

describe("LeadActionsService", () => {
    it.each([
        ["refresh-context", undefined],
        ["refresh-context", null],
        ["refresh-context", ""],
        ["suggest-owner", undefined],
        ["suggest-owner", null],
        ["suggest-owner", ""],
    ] as const)("passes an empty lead id to %s for a raw %s value", async (action, leadId) => {
        const { actions, ai } = await build()
        const input: LeadActionInput = {}
        Object.defineProperty(input, "leadId", { value: leadId })
        const row: LeadActionRunRow = { ...running, action, input }
        const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }
        const result = { leadId: "", contextSummary: "No lead" }
        ai.refreshContext.mockResolvedValue(result)
        ai.suggestOwner.mockResolvedValue(result)

        await expect(actions["execute"](ctx, row)).resolves.toEqual(result)
        const selected = action === "refresh-context" ? ai.refreshContext : ai.suggestOwner
        const args = action === "refresh-context" ? [ctx, ""] : [ctx, "user-1", ""]
        expect(selected).toHaveBeenCalledWith(...args)
    })

    it.each([
        ["refresh-context", "leadId", undefined],
        ["refresh-context", "leadId", null],
        ["refresh-context", "leadId", ""],
        ["draft-execution", "responsibilityId", undefined],
        ["draft-execution", "responsibilityId", null],
        ["draft-execution", "responsibilityId", ""],
    ] as const)("checks %s with an empty %s for a raw %s value", async (action, field, value) => {
        const { actions, leads, responsibilities } = await build()
        const input: LeadActionInput = {}
        Object.defineProperty(input, field, { value })
        responsibilities.find.mockResolvedValue(mock<ResponsibilityRecord>({ id: RESPONSIBILITY, lead_id: LEAD }))

        await expect(actions["requireTarget"]("ws-1", action, input)).resolves.toBeUndefined()
        const selected = action === "draft-execution" ? responsibilities.find : leads.require
        expect(selected).toHaveBeenCalledWith("ws-1", "")
    })

    it("records invalid persisted input as a domain refusal without executing", async () => {
        const row: LeadActionRunRow = { ...running, input: {} }
        const { actions, tx, ai } = await build([
            [BEGIN_LEAD_ACTION, [row]],
            [REFUSE_LEAD_ACTION, [{ id: "run-1" }]],
        ])

        await expect(actions.run(job)).resolves.toBeUndefined()
        expect(ai.refreshContext).not.toHaveBeenCalled()
        expect(tx.em.query).toHaveBeenCalledWith(REFUSE_LEAD_ACTION, [
            "run-1",
            "ws-1",
            "job-1",
            7,
            LeadActionsErrorCode.InvalidInput,
        ])
    })
})

describe("LeadActionsService", () => {
    it("records a permanent refusal from a different domain family", async () => {
        const { actions, members, errors, tx } = await build([
            [BEGIN_LEAD_ACTION, [running]],
            [REFUSE_LEAD_ACTION, [{ id: "run-1" }]],
        ])
        const cause = new MembershipError({ code: "MEMBERSHIP_FORBIDDEN" })
        members.require.mockRejectedValue(cause)
        errors.describe.mockReturnValue({ code: cause.code, kind: "forbidden", status: 403, params: {} })

        await expect(actions.run(job)).resolves.toBeUndefined()
        expect(errors.describe).toHaveBeenCalledWith(cause)
        expect(tx.em.query).toHaveBeenCalledWith(REFUSE_LEAD_ACTION, ["run-1", "ws-1", "job-1", 7, cause.code])
    })

    it.each(transientKinds)("preserves a %s domain failure for retry", async (kind) => {
        const { actions, ai, errors, tx } = await build([[BEGIN_LEAD_ACTION, [running]]])
        const cause = new LeadActionsError({ code: LeadActionsErrorCode.Busy })
        ai.refreshContext.mockRejectedValue(cause)
        errors.describe.mockReturnValue({ code: cause.code, kind, status: 503, params: {} })

        await expect(actions.run(job)).rejects.toBe(cause)
        expect(tx.em.query).toHaveBeenCalledTimes(1)
    })

    it("records an engine work failure even though its domain kind is unavailable", async () => {
        const { actions, ai, errors, tx } = await build([
            [BEGIN_LEAD_ACTION, [running]],
            [REFUSE_LEAD_ACTION, [{ id: "run-1" }]],
        ])
        const cause = new LeadActionsError({ code: LeadActionsErrorCode.WorkFailed })
        ai.refreshContext.mockRejectedValue(cause)
        errors.describe.mockReturnValue({ code: cause.code, kind: "unavailable", status: 503, params: {} })

        await expect(actions.run(job)).resolves.toBeUndefined()
        expect(tx.em.query).toHaveBeenCalledWith(REFUSE_LEAD_ACTION, ["run-1", "ws-1", "job-1", 7, cause.code])
    })

    it("propagates an unexpected failure without describing or refusing it", async () => {
        const { actions, ai, errors, tx } = await build([[BEGIN_LEAD_ACTION, [running]]])
        const cause = new Error("connection interrupted")
        ai.refreshContext.mockRejectedValue(cause)

        await expect(actions.run(job)).rejects.toBe(cause)
        expect(errors.describe).not.toHaveBeenCalled()
        expect(tx.em.query).toHaveBeenCalledTimes(1)
    })
})

describe("LeadActionsService", () => {
    it("reports a missing run fence when both completion and refusal lose ownership", async () => {
        const { actions, ai, tx } = await build([
            [BEGIN_LEAD_ACTION, [running]],
            [SUCCEED_LEAD_ACTION, []],
            [REFUSE_LEAD_ACTION, []],
        ])
        const result = { leadId: LEAD, contextSummary: "brief" }
        ai.refreshContext.mockResolvedValue(result)

        await expect(actions.run(job)).rejects.toMatchObject({ code: LeadActionsErrorCode.NotFound })
        expect(tx.em.query).toHaveBeenCalledWith(SUCCEED_LEAD_ACTION, [
            "run-1",
            "ws-1",
            "job-1",
            7,
            JSON.stringify(result),
        ])
        expect(tx.em.query).toHaveBeenCalledWith(REFUSE_LEAD_ACTION, [
            "run-1",
            "ws-1",
            "job-1",
            7,
            LeadActionsErrorCode.NotFound,
        ])
    })

    it("ignores an exhausted delivery without a lead action address", async () => {
        const { actions, claims, tx } = await build()

        await expect(actions.failDelivery({ ...delivery, payload: {} }, "failure")).resolves.toBeUndefined()
        expect(claims.withFailedFence).not.toHaveBeenCalled()
        expect(tx.em.query).not.toHaveBeenCalled()
    })

    it.each([
        [new LeadActionsError({ code: LeadActionsErrorCode.Busy }), LeadActionsErrorCode.Busy],
        ["connection interrupted", LeadActionsErrorCode.WorkFailed],
    ])("records exhausted delivery cause %s under the failed worker's fence", async (cause, code) => {
        const { actions, claims, tx } = await build([[FAIL_LEAD_ACTION, []]])

        await expect(actions.failDelivery(delivery, cause)).resolves.toBeUndefined()
        expect(claims.withFailedFence).toHaveBeenCalledWith("delivery-1", expect.anything())
        expect(tx.em.query).toHaveBeenCalledWith(FAIL_LEAD_ACTION, ["ws-1", "run-1", code, "job-1", 7])
    })
})
