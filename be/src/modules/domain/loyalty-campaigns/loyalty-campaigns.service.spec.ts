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
import type { CampaignParams, Segment } from "./loyalty-campaigns.contracts"
import { LoyaltyCampaignsService } from "./loyalty-campaigns.service"
import { COUNT_SENT_SINCE, INSERT_CAMPAIGN } from "./persistence/loyalty-campaigns.sql"

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
const catalog = mock<MessageCatalog>()
catalog.get.mockImplementation(
    (key, params) =>
        `${key}|${Object.entries(params)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(",")}`,
)

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
})
