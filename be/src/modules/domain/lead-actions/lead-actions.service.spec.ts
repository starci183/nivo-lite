import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { LeadRecordRow } from "@modules/domain/leads"
import { LeadRecordsService } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ERRORS_SERVICE } from "@modules/platform/errors"
import type { ErrorsService } from "@modules/platform/errors"
import { REQUEST_LOCALE } from "@modules/platform/i18n"
import type { RequestLocale } from "@modules/platform/i18n"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { LeadActionsQueue } from "@modules/queues/lead-actions"
import { LeadActionsErrorCode } from "./errors/lead-actions.error"
import { LeadActionAiService } from "./lead-action-ai.service"
import { LeadActionFlowService } from "./lead-action-flow.service"
import { LeadActionsService } from "./lead-actions.service"
import type { LeadActionRunRow } from "./persistence/lead-actions.rows"
import { FIND_LEAD_ACTION, INSERT_LEAD_ACTION } from "./persistence/lead-actions.sql"

const LEAD = "11111111-1111-4111-8111-111111111111"

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
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadActionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: REQUEST_LOCALE, useValue: locale },
            { provide: ERRORS_SERVICE, useValue: mock<ErrorsService>() },
            { provide: JOB_CLAIMS, useValue: mock<JobClaims>() },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: LeadRecordsService, useValue: leads },
            { provide: ResponsibilityJournalService, useValue: mock<ResponsibilityJournalService>() },
            { provide: LeadActionsQueue, useValue: queue },
            { provide: LeadActionAiService, useValue: mock<LeadActionAiService>() },
            { provide: LeadActionFlowService, useValue: mock<LeadActionFlowService>() },
        ],
    }).compile()
    return { actions: moduleRef.get(LeadActionsService), tx, queue, leads }
}

describe("LeadActionsService", () => {
    const createInput = {
        contactName: "Lan",
        company: "Hue Tea",
        channel: "zalo",
        need: "oolong tea",
        phone: null,
        email: null,
    }

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
})
