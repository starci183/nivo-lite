import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LoyaltyCustomerLinksService } from "@modules/domain/loyalty-customer-links"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import type { LoyaltyProgram } from "@modules/domain/loyalty-programs"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyCampaignsErrorCode } from "./errors/loyalty-campaigns.error"
import type { CampaignParams, LoyaltyCampaignView, Segment } from "./loyalty-campaigns.contracts"
import { LoyaltyCampaignsService } from "./loyalty-campaigns.service"
import type { LoyaltyCampaignRow } from "./persistence/loyalty-campaigns.rows"
import {
    ATTACH_CAMPAIGN_DECISION,
    COUNT_SENT_SINCE,
    FAIL_CAMPAIGN_DRAFT,
    FINISH_CAMPAIGN_DRAFT,
    INSERT_CAMPAIGN,
    INSERT_WAITING_CAMPAIGN,
    LIST_CAMPAIGNS,
} from "./persistence/loyalty-campaigns.sql"

const NOW = Date.UTC(2026, 9, 12)
const ANY: Segment = { tiers: [], inactiveDays: 0, birthdayThisMonth: false, minSpendVnd: 0 }
const memberOf = builder<LoyaltyMember>({
    id: "c1",
    name: "Mai",
    phone: null,
    email: null,
    birthday: null,
    tierKey: "bac",
    points: 0,
    lifetimeSpendVnd: 0,
    visits: 0,
    lastVisitAt: null,
    joinedAt: new Date(NOW).toISOString(),
    note: "",
})
const paramsOf = builder<CampaignParams>({ workspaceId: "ws-1", name: "", segment: ANY, brief: "", createdBy: "Owner" })
const rowOf = builder<LoyaltyCampaignRow>({
    id: "k1",
    name: "Autumn",
    segment: ANY,
    draft: "Hello {ten_khach}",
    status: "draft",
    work_item_id: "decision-1",
    recipients: 3,
    sent: 1,
    queued: 1,
    failed: 0,
    skipped: 1,
    draft_ms: 40,
    created_by: "Owner",
    created_at: new Date(NOW),
    finished_at: null,
})
const CAMPAIGN: LoyaltyCampaignView = {
    id: "k1",
    name: "Autumn",
    segment: ANY,
    messageDraft: "Hello {ten_khach}",
    draft: "Hello {ten_khach}",
    status: "draft",
    workItemId: "decision-1",
    recipients: 3,
    sent: 1,
    queued: 1,
    failed: 0,
    skipped: 1,
    draftMs: 40,
    createdBy: "Owner",
    createdAt: "2026-10-12T00:00:00.000Z",
    finishedAt: null,
    errorCode: null,
}
const catalog = mock<MessageCatalog>({
    get: (key, params) =>
        `${key}|${Object.entries(params)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(",")}`,
})

interface Options {
    members: ReadonlyArray<LoyaltyMember>
    program?: LoyaltyProgram | null
    entityManager?: MockEntityManager
}

const build = async (options: Options) => {
    const ledger = mock<LoyaltyLedgerService>()
    ledger.members.mockResolvedValue(options.members)
    const links = mock<LoyaltyCustomerLinksService>()
    links.countReachable.mockResolvedValue(2)
    const programs = mock<LoyaltyProgramsService>()
    programs.shopName.mockResolvedValue("Spa")
    programs.find.mockResolvedValue(options.program ?? null)
    const entityManager = options.entityManager ?? mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyCampaignsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LoyaltyLedgerService, useValue: ledger },
            { provide: LoyaltyCustomerLinksService, useValue: links },
            { provide: LoyaltyProgramsService, useValue: programs },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyCampaignsService), links, entityManager }
}

describe("LoyaltyCampaignsService", () => {
    describe("preview", () => {
        it("counts the segment, the customers that can be written to and the first few", async () => {
            const members = Array.from({ length: 7 }, (_, index) => memberOf({ id: `c${index}`, name: `M${index}` }))
            const { service, links } = await build({ members })

            const preview = await service.preview("ws-1", ANY)

            expect(preview.total).toBe(7)
            expect(preview.reachable).toBe(2)
            expect(preview.sample).toHaveLength(5)
            expect(preview.sample[0]).toEqual({ id: "c0", name: "M0", tierKey: "bac" })
            expect(links.countReachable).toHaveBeenCalledWith(
                "ws-1",
                members.map((member) => member.id),
            )
        })

        it("scales the reachable count up when the segment is bigger than the sample asked about", async () => {
            const members = Array.from({ length: 400 }, (_, index) => memberOf({ id: `c${index}` }))
            const { service, links } = await build({ members })

            const preview = await service.preview("ws-1", ANY)

            expect(links.countReachable).toHaveBeenCalledWith(
                "ws-1",
                members.slice(0, 200).map((member) => member.id),
            )
            expect(preview.reachable).toBe(4)
        })

        it("leaves out the customers outside the segment", async () => {
            const { service } = await build({ members: [memberOf({ tierKey: "vang" })] })

            await expect(service.preview("ws-1", { ...ANY, tiers: ["bac"] })).resolves.toMatchObject({
                total: 0,
                sample: [],
            })
        })
    })

    describe("create", () => {
        it("writes a draft with the offer filled in and counts the recipients", async () => {
            const entityManager = mockEntityManager({ query: [INSERT_CAMPAIGN, [{ id: "k1" }]] })
            const { service } = await build({ members: [memberOf()], entityManager })

            const draft = await service.create(paramsOf({ name: " Autumn ", brief: " 10 percent off " }))

            expect(draft).toEqual({
                campaignId: "k1",
                status: "draft",
                recipients: 1,
                draft: "loyalty.promo.template|shop=Spa,offer=10 percent off",
            })
            expect(entityManager.query).toHaveBeenCalledWith(INSERT_CAMPAIGN, [
                "ws-1",
                "Autumn",
                JSON.stringify(ANY),
                "loyalty.promo.template|shop=Spa,offer=10 percent off",
                1,
                "Owner",
            ])
        })

        it("names the campaign after its segment and offers the default when the owner wrote nothing", async () => {
            const entityManager = mockEntityManager({ query: [INSERT_CAMPAIGN, [{ id: "k1" }]] })
            const program: LoyaltyProgram = {
                workspaceId: "ws-1",
                slug: "spa",
                name: "Spa",
                enabled: true,
                createdAt: "2026-10-01T00:00:00.000Z",
                config: {
                    earn: { perThousandVnd: 1, perVisit: 0, categories: [], trigger: "payment", minOrderVnd: 0 },
                    tiers: [
                        { key: "bac", name: "Silver", minSpendVnd: 0, multiplier: 1, winbackDays: 45, benefit: "" },
                    ],
                    expiry: { months: 12, warnDays: 30 },
                    birthday: { enabled: true, points: 100, rewardKey: "", note: "" },
                    promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
                },
            }
            const { service } = await build({ members: [memberOf({ lifetimeSpendVnd: 5000 })], program, entityManager })

            const draft = await service.create(paramsOf({ segment: { ...ANY, tiers: ["bac"], minSpendVnd: 1000 } }))

            expect(draft.draft).toBe("loyalty.promo.template|shop=Spa,offer=loyalty.promo.defaultOffer|")
            expect(entityManager.query).toHaveBeenCalledWith(
                INSERT_CAMPAIGN,
                expect.arrayContaining([
                    expect.stringContaining(
                        "defaultName|segment=loyalty.segment.tiers|tiers=Silver, loyalty.segment.minSpend",
                    ),
                ]),
            )
        })

        it("names a campaign for every customer when the segment has no condition and the programme is gone", async () => {
            const entityManager = mockEntityManager({ query: [INSERT_CAMPAIGN, [{ id: "k1" }]] })
            const { service } = await build({ members: [memberOf()], entityManager })

            await service.create(paramsOf())

            expect(entityManager.query).toHaveBeenCalledWith(
                INSERT_CAMPAIGN,
                expect.arrayContaining(["loyalty.campaign.defaultName|segment=loyalty.segment.all|"]),
            )
        })

        it("refuses a segment nobody belongs to", async () => {
            const { service } = await build({ members: [] })

            await expect(service.create(paramsOf())).rejects.toMatchObject({
                code: LoyaltyCampaignsErrorCode.NoRecipients,
            })
        })

        it("fails when the insert answers no row", async () => {
            const entityManager = mockEntityManager({ query: [INSERT_CAMPAIGN, []] })
            const { service } = await build({ members: [memberOf()], entityManager })

            await expect(service.create(paramsOf())).rejects.toMatchObject({
                code: LoyaltyCampaignsErrorCode.NotCreated,
            })
        })
    })

    describe("sentSince", () => {
        it("counts the promotions that went out", async () => {
            const entityManager = mockEntityManager({ query: [COUNT_SENT_SINCE, [{ total: 6 }]] })
            const { service } = await build({ members: [], entityManager })

            await expect(service.sentSince("ws-1", "2026-09-12T00:00:00.000Z")).resolves.toBe(6)
        })
    })

    describe("prepare", () => {
        it("writes the waiting draft through the producer's transaction", async () => {
            const { service, entityManager } = await build({ members: [memberOf()] })
            const tx = mockEntityManager({ query: [INSERT_WAITING_CAMPAIGN, [{ id: "waiting-1" }]] })

            await expect(
                service.prepare(paramsOf({ name: " Autumn ", brief: " 10 percent off " }), tx),
            ).resolves.toEqual({
                campaignId: "waiting-1",
                status: "waiting",
                recipients: 1,
                draft: "loyalty.promo.template|shop=Spa,offer=10 percent off",
            })

            expect(tx.query).toHaveBeenCalledWith(INSERT_WAITING_CAMPAIGN, [
                "ws-1",
                "Autumn",
                JSON.stringify(ANY),
                "loyalty.promo.template|shop=Spa,offer=10 percent off",
                1,
                "Owner",
            ])
            expect(entityManager.query).not.toHaveBeenCalled()
        })
    })

    describe("list", () => {
        it("reads the latest twenty campaigns with their delivery counts", async () => {
            const entityManager = mockEntityManager({ query: [LIST_CAMPAIGNS, [rowOf()]] })
            const { service } = await build({ members: [], entityManager })

            await expect(service.list("ws-1")).resolves.toEqual([CAMPAIGN])

            expect(entityManager.query).toHaveBeenCalledWith(LIST_CAMPAIGNS, ["ws-1", null, 20])
        })

        it.each([
            [0, 1],
            [35, 35],
            [101, 100],
        ])("clamps requested list limit %i to %i", async (requested, expected) => {
            const entityManager = mockEntityManager({ query: [LIST_CAMPAIGNS, []] })
            const { service } = await build({ members: [], entityManager })

            await expect(service.list("ws-1", requested)).resolves.toEqual([])

            expect(entityManager.query).toHaveBeenCalledWith(LIST_CAMPAIGNS, ["ws-1", null, expected])
        })
    })

    describe("get", () => {
        it("reads the campaign only within the selected workspace", async () => {
            const entityManager = mockEntityManager({ query: [LIST_CAMPAIGNS, [rowOf()]] })
            const { service } = await build({ members: [], entityManager })

            await expect(service.get("ws-1", "k1")).resolves.toEqual(CAMPAIGN)

            expect(entityManager.query).toHaveBeenCalledWith(LIST_CAMPAIGNS, ["ws-1", "k1", 1])
        })

        it("rejects a campaign absent from the selected workspace", async () => {
            const entityManager = mockEntityManager({ query: [LIST_CAMPAIGNS, []] })
            const { service } = await build({ members: [], entityManager })

            await expect(service.get("ws-2", "k1")).rejects.toMatchObject({
                code: LoyaltyCampaignsErrorCode.NotFound,
            })

            expect(entityManager.query).toHaveBeenCalledWith(LIST_CAMPAIGNS, ["ws-2", "k1", 1])
        })
    })

    describe("draft settlement", () => {
        it("finishes a waiting draft through the fenced writer's transaction", async () => {
            const { service, entityManager } = await build({ members: [] })
            const tx = mockEntityManager({ query: [FINISH_CAMPAIGN_DRAFT, [{ id: "k1" }]] })

            await expect(service.finishDraft(tx, "ws-1", "k1", "{ten_khach} thanks", 40)).resolves.toBeUndefined()

            expect(tx.query).toHaveBeenCalledWith(FINISH_CAMPAIGN_DRAFT, ["ws-1", "k1", "{ten_khach} thanks", 40])
            expect(entityManager.query).not.toHaveBeenCalled()
        })

        it("fails an exhausted campaign through the workspace-scoped statement", async () => {
            const entityManager = mockEntityManager({ query: [FAIL_CAMPAIGN_DRAFT, []] })
            const { service } = await build({ members: [], entityManager })

            await expect(service.failDraft("ws-1", "k1")).resolves.toBeUndefined()

            expect(entityManager.query).toHaveBeenCalledWith(FAIL_CAMPAIGN_DRAFT, ["ws-1", "k1"])
        })
    })

    describe("attachDecision", () => {
        it.each([
            { rows: [{ id: "k1" }], attached: true },
            { rows: [], attached: false },
        ])("reports whether the decision attached: $attached", async ({ rows, attached }) => {
            const entityManager = mockEntityManager({ query: [ATTACH_CAMPAIGN_DECISION, rows] })
            const { service } = await build({ members: [], entityManager })

            await expect(service.attachDecision("ws-1", "k1", "decision-1", "approval")).resolves.toBe(attached)

            expect(entityManager.query).toHaveBeenCalledWith(ATTACH_CAMPAIGN_DECISION, [
                "ws-1",
                "k1",
                "decision-1",
                "approval",
            ])
        })
    })
})
