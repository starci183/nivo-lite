import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import {
    LoyaltyCampaignDraftsService,
    LoyaltyCampaignsErrorCode,
    LoyaltyCampaignsService,
} from "@modules/domain/loyalty-campaigns"
import type { CampaignDraft, LoyaltyCampaignView } from "@modules/domain/loyalty-campaigns"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyCampaignWorkbenchService } from "./loyalty-campaign-workbench.service"

const ACTOR: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: "staff-1",
    displayName: "Mai",
    status: "active",
}
const campaignOf = builder<LoyaltyCampaignView>({
    id: "campaign-1",
    name: "Birthday",
    segment: { tiers: [], inactiveDays: 0, birthdayThisMonth: true, minSpendVnd: 0 },
    messageDraft: "Happy birthday, {{customer}}",
    draft: "Happy birthday, {{customer}}",
    status: "draft",
    workItemId: null,
    recipients: 12,
    sent: 0,
    queued: 0,
    failed: 0,
    skipped: 0,
    draftMs: 10,
    createdBy: "Mai",
    createdAt: "2026-10-14T00:00:00.000Z",
    finishedAt: null,
    errorCode: null,
})
const itemOf = builder<WorkItem>({
    id: "work-1",
    workspace_id: "ws-1",
    department: "loyalty",
    action: "send_promo",
    subject_type: "lead",
    subject_id: null,
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "done",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Send birthday promotion", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-14T00:00:00.000Z",
    updated_at: "2026-10-14T00:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const build = async () => {
    const access = mock<WorkspaceMembersService>()
    const campaigns = mock<LoyaltyCampaignsService>()
    const drafts = mock<LoyaltyCampaignDraftsService>()
    const engine = mock<WorkEngineService>()
    const catalog = mock<MessageCatalog>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyCampaignWorkbenchService,
            { provide: WorkspaceMembersService, useValue: access },
            { provide: LoyaltyCampaignsService, useValue: campaigns },
            { provide: LoyaltyCampaignDraftsService, useValue: drafts },
            { provide: WorkEngineService, useValue: engine },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyCampaignWorkbenchService), access, campaigns, drafts, engine, catalog }
}

describe("LoyaltyCampaignWorkbenchService", () => {
    describe("draft", () => {
        it("draft has its first case written", async () => {
            const { service } = await build()
            expect(service.draft).toBeInstanceOf(Function)
        })

        it("requests the draft in the proven manager's name", async () => {
            const { service, access, drafts, campaigns, engine } = await build()
            const params = {
                workspaceId: "ws-1",
                name: "Birthday",
                brief: "Offer a gift",
                segment: { tiers: ["gold"], inactiveDays: 0, birthdayThisMonth: true, minSpendVnd: 100000 },
            }
            const result: CampaignDraft = {
                campaignId: "campaign-1",
                status: "waiting",
                recipients: 12,
                draft: "",
            }
            access.require.mockResolvedValue(ACTOR)
            drafts.request.mockResolvedValue(result)

            expect(await service.draft("user-1", params)).toEqual(result)
            expect(access.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(drafts.request).toHaveBeenCalledWith({ ...params, createdBy: "Mai" })
            expect(campaigns.get).not.toHaveBeenCalled()
            expect(engine.runWork).not.toHaveBeenCalled()
        })

        it("does not request a draft when manager access is refused", async () => {
            const { service, access, drafts } = await build()
            const refusal = { code: "WORKSPACE_MEMBERS_FORBIDDEN" }
            access.require.mockRejectedValue(refusal)

            await expect(
                service.draft("user-1", {
                    workspaceId: "ws-1",
                    name: "Birthday",
                    brief: "Offer a gift",
                    segment: { tiers: [], inactiveDays: 0, birthdayThisMonth: true, minSpendVnd: 0 },
                }),
            ).rejects.toBe(refusal)
            expect(drafts.request).not.toHaveBeenCalled()
        })
    })
})

describe("LoyaltyCampaignWorkbenchService", () => {
    describe("submit", () => {
        it("submit has its first case written", async () => {
            const { service } = await build()
            expect(service.submit).toBeInstanceOf(Function)
        })

        it.each([
            { stored: "sending", status: "done" },
            { stored: "waiting", status: "waiting_decision" },
            { stored: "failed", status: "failed" },
        ])("returns the existing decision for stored status $stored", async ({ stored, status }) => {
            const { service, access, campaigns, engine, catalog } = await build()
            access.require.mockResolvedValue(ACTOR)
            campaigns.get.mockResolvedValue(campaignOf({ workItemId: "existing-work", status: stored }))

            expect(await service.submit("user-1", "ws-1", "campaign-1", "en")).toEqual({
                campaignId: "campaign-1",
                workItemId: "existing-work",
                status,
            })
            expect(access.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(campaigns.get).toHaveBeenCalledWith("ws-1", "campaign-1")
            expect(engine.runWork).not.toHaveBeenCalled()
            expect(campaigns.attachDecision).not.toHaveBeenCalled()
            expect(catalog.get).not.toHaveBeenCalled()
        })

        it("rejects a campaign whose message is not yet a draft", async () => {
            const { service, access, campaigns, engine } = await build()
            access.require.mockResolvedValue(ACTOR)
            campaigns.get.mockResolvedValue(campaignOf({ status: "waiting" }))

            await expect(service.submit("user-1", "ws-1", "campaign-1", "en")).rejects.toMatchObject({
                code: LoyaltyCampaignsErrorCode.NotReady,
            })
            expect(engine.runWork).not.toHaveBeenCalled()
            expect(campaigns.attachDecision).not.toHaveBeenCalled()
        })
    })
})

describe("LoyaltyCampaignWorkbenchService", () => {
    describe("submit", () => {
        it.each([
            { status: "done", stored: "sending" },
            { status: "rejected", stored: "rejected" },
            { status: "failed", stored: "failed" },
            { status: "waiting_decision", stored: "waiting_decision" },
            { status: "queued", stored: "waiting_decision" },
        ] as const)("submits the draft and links work status $status as $stored", async ({ status, stored }) => {
            const { service, access, campaigns, engine, catalog } = await build()
            access.require.mockResolvedValue(ACTOR)
            campaigns.get.mockResolvedValue(campaignOf())
            catalog.get.mockReturnValue("Send Birthday to 12 customers")
            engine.runWork.mockResolvedValue(itemOf({ status }))
            campaigns.attachDecision.mockResolvedValue(true)

            expect(await service.submit("user-1", "ws-1", "campaign-1", "en")).toEqual({
                campaignId: "campaign-1",
                workItemId: "work-1",
                status,
            })
            expect(catalog.get).toHaveBeenCalledWith(
                "loyalty.campaign.submitSummary",
                { name: "Birthday", count: 12 },
                "en",
            )
            expect(engine.runWork).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "Mai", locale: "en" },
                {
                    action: "send_promo",
                    subject_type: "lead",
                    subject_id: null,
                    dedupeKey: "send_promo:campaign:campaign-1",
                    origin: "live",
                    preset: true,
                    noChain: true,
                    seed: {
                        summary: "Send Birthday to 12 customers",
                        draft: "Happy birthday, {{customer}}",
                        fields: { campaign_id: "campaign-1", contact: "12", customer: "Birthday" },
                    },
                },
            )
            expect(campaigns.attachDecision).toHaveBeenCalledWith("ws-1", "campaign-1", "work-1", stored)
            expect(campaigns.get).toHaveBeenCalledTimes(1)
        })

        it("returns the decision attached by a concurrent submission", async () => {
            const { service, access, campaigns, engine } = await build()
            access.require.mockResolvedValue(ACTOR)
            campaigns.get
                .mockResolvedValueOnce(campaignOf())
                .mockResolvedValueOnce(campaignOf({ workItemId: "winning-work", status: "sending" }))
            engine.runWork.mockResolvedValue(itemOf())
            campaigns.attachDecision.mockResolvedValue(false)

            expect(await service.submit("user-1", "ws-1", "campaign-1", "en")).toEqual({
                campaignId: "campaign-1",
                workItemId: "winning-work",
                status: "done",
            })
            expect(campaigns.get).toHaveBeenNthCalledWith(1, "ws-1", "campaign-1")
            expect(campaigns.get).toHaveBeenNthCalledWith(2, "ws-1", "campaign-1")
            expect(campaigns.attachDecision).toHaveBeenCalledWith("ws-1", "campaign-1", "work-1", "sending")
        })
    })
})

describe("LoyaltyCampaignWorkbenchService", () => {
    describe("submit", () => {
        it("rejects when the failed link still leaves the campaign without a decision", async () => {
            const { service, access, campaigns, engine } = await build()
            access.require.mockResolvedValue(ACTOR)
            campaigns.get.mockResolvedValue(campaignOf())
            engine.runWork.mockResolvedValue(itemOf({ status: "waiting_decision" }))
            campaigns.attachDecision.mockResolvedValue(false)

            await expect(service.submit("user-1", "ws-1", "campaign-1", "en")).rejects.toMatchObject({
                code: LoyaltyCampaignsErrorCode.NotReady,
            })
            expect(campaigns.get).toHaveBeenCalledTimes(2)
            expect(campaigns.attachDecision).toHaveBeenCalledWith("ws-1", "campaign-1", "work-1", "waiting_decision")
        })

        it("does not load or submit a campaign when manager access is refused", async () => {
            const { service, access, campaigns, engine } = await build()
            const refusal = { code: "WORKSPACE_MEMBERS_FORBIDDEN" }
            access.require.mockRejectedValue(refusal)

            await expect(service.submit("user-1", "ws-1", "campaign-1", "en")).rejects.toBe(refusal)
            expect(campaigns.get).not.toHaveBeenCalled()
            expect(engine.runWork).not.toHaveBeenCalled()
        })
    })

    describe("campaign", () => {
        it("campaign has its first case written", async () => {
            const { service } = await build()
            expect(service.campaign).toBeInstanceOf(Function)
        })

        it("lets any proven workspace member poll the selected campaign", async () => {
            const { service, access, campaigns } = await build()
            const campaign = campaignOf({ status: "sending", workItemId: "work-1", sent: 5, queued: 7 })
            access.require.mockResolvedValue({ ...ACTOR, role: "staff" })
            campaigns.get.mockResolvedValue(campaign)

            expect(await service.campaign("user-1", { workspaceId: "ws-1", id: "campaign-1" })).toEqual(campaign)
            expect(access.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(campaigns.get).toHaveBeenCalledWith("ws-1", "campaign-1")
        })

        it("does not poll a campaign when workspace membership is refused", async () => {
            const { service, access, campaigns } = await build()
            const refusal = { code: "WORKSPACE_MEMBERS_FORBIDDEN" }
            access.require.mockRejectedValue(refusal)

            await expect(service.campaign("user-1", { workspaceId: "ws-1", id: "campaign-1" })).rejects.toBe(refusal)
            expect(campaigns.get).not.toHaveBeenCalled()
        })
    })
})
