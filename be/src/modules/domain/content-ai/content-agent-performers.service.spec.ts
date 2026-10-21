import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type {
    PerformedBy,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkPerformerRegistry,
} from "@modules/domain/decisions"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ContentScheduleService } from "./content-schedule.service"
import { MarketingDraftService } from "./marketing-draft.service"
import { ContentAgentPerformersService, draftRequestOf } from "./content-agent-performers.service"

const CTX: WorkContext = { workspaceId: "ws-1", actor: "Mai Linh", locale: "vi" }
const OWNER: PerformedBy = { name: "Mai Linh", kind: "owner" }
const proposalOf = (fields: Proposal["fields"], summary = "summary"): Proposal => ({ summary, fields })
const itemOf = (subjectId: string | null, proposal: Proposal = proposalOf({})): WorkItem =>
    mock<WorkItem>({ id: "w-1", subject_id: subjectId, proposal })

const build = async (approve: WorkPerformer | null = null) => {
    const registry = mock<WorkPerformerRegistry>()
    registry.performerOf.mockReturnValue(approve)
    const logger = mock<Logger>()
    const drafts = mock<MarketingDraftService>()
    const schedule = mock<ContentScheduleService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentAgentPerformersService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LOGGER, useValue: logger },
            { provide: MarketingDraftService, useValue: drafts },
            { provide: ContentScheduleService, useValue: schedule },
        ],
    }).compile()
    return { service: moduleRef.get(ContentAgentPerformersService), registry, logger, drafts, schedule }
}

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe("draftRequestOf", () => {
    it("takes the first filled request field, else the summary", () => {
        expect(draftRequestOf(proposalOf({ request: " ", topic: "spa 20%" }))).toBe("spa 20%")
        expect(draftRequestOf(proposalOf({ request: 5 }, "fallback"))).toBe("fallback")
    })
})

describe("ContentAgentPerformersService", () => {
    it("registers draft_post and wraps publish_post when it exists", async () => {
        const approve = mock<WorkPerformer>()
        const { service, registry } = await build(approve)

        service.onApplicationBootstrap()

        expect(registry.add).toHaveBeenCalledWith("draft_post", expect.anything())
        expect(registry.add).toHaveBeenCalledWith("publish_post", expect.anything())
    })

    it("registers only draft_post without a publish_post performer", async () => {
        const { service, registry } = await build(null)

        service.onApplicationBootstrap()

        expect(registry.add).toHaveBeenCalledTimes(1)
    })

    it("prepares draft_post from the command and starts the draft in the background", async () => {
        const { service, drafts, logger } = await build()
        const performer = service.draftPerformer()
        const proposal = proposalOf({ request: "spa 20%", scheduled_at: "2026-10-24T02:00:00.000Z" })
        const item = itemOf(null, proposal)
        drafts.draft.mockResolvedValue({ ok: false, reason: "x", contentItemId: null, approvalWorkItemId: null })

        await expect(performer.prepare(CTX, item)).resolves.toEqual({ proposal })
        await expect(performer.perform(CTX, item, proposal, OWNER)).resolves.toEqual({
            summary: "spa 20%",
            evidence: "pending",
        })
        expect(drafts.draft).toHaveBeenCalledWith(CTX, {
            request: "spa 20%",
            workItemId: "w-1",
            scheduledAt: "2026-10-24T02:00:00.000Z",
        })

        drafts.draft.mockRejectedValue(new Error("boom"))
        await performer.perform(CTX, item, proposalOf({ scheduled_at: "" }), OWNER)
        await flush()
        expect(drafts.draft).toHaveBeenLastCalledWith(CTX, expect.objectContaining({ scheduledAt: null }))
        expect(logger.error).toHaveBeenCalledWith("marketing.draft.failed", expect.any(Error), { workspaceId: "ws-1" })
    })
})

describe("ContentAgentPerformersService publish_post", () => {
    it("approves publish_post as before, then schedules the post", async () => {
        const approve = mock<WorkPerformer>()
        approve.prepare.mockResolvedValue({ proposal: proposalOf({}) })
        approve.perform.mockResolvedValue({ summary: "approved", evidence: "reviewed" })
        const { service, schedule, logger } = await build()
        schedule.schedule.mockResolvedValue([])
        const performer = service.schedulingPerformer(approve)
        const item = itemOf("c-1")

        await expect(performer.prepare(CTX, item)).resolves.toEqual({ proposal: proposalOf({}) })
        await expect(performer.perform(CTX, item, proposalOf({}), OWNER)).resolves.toEqual({
            summary: "approved",
            evidence: "reviewed",
        })
        expect(schedule.schedule).toHaveBeenCalledWith(CTX, { contentItemId: "c-1", workItemId: "w-1" })

        schedule.schedule.mockRejectedValue(new Error("down"))
        await expect(performer.perform(CTX, item, proposalOf({}), OWNER)).resolves.toMatchObject({
            summary: "approved",
        })
        expect(logger.error).toHaveBeenCalledWith("marketing.schedule.failed", expect.any(Error), {
            workspaceId: "ws-1",
        })
    })

    it("schedules nothing for an item without subject and forwards a rejection", async () => {
        const approve = mock<WorkPerformer>()
        approve.perform.mockResolvedValue({ summary: "approved", evidence: "reviewed" })
        const { service, schedule } = await build()
        const performer = service.schedulingPerformer(approve)

        await performer.perform(CTX, itemOf(null), proposalOf({}), OWNER)
        await performer.onReject?.(CTX, itemOf("c-1"), proposalOf({}), OWNER)

        expect(schedule.schedule).not.toHaveBeenCalled()
        expect(approve.onReject).toHaveBeenCalled()
        await service
            .schedulingPerformer({ prepare: approve.prepare, perform: approve.perform })
            .onReject?.(CTX, itemOf("c-1"), proposalOf({}), OWNER)
    })
})
