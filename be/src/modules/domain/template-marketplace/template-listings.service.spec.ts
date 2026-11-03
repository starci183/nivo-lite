import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentPluginsService } from "@modules/domain/agent-plugins"
import { AgentTemplateVersionsService } from "@modules/domain/agent-templates"
import type { StoredVersion } from "@modules/domain/agent-templates"
import { ModulesService } from "@modules/domain/modules"
import { AdminAccessService } from "@modules/domain/platform-admin"
import type { Principal } from "@modules/platform/cqrs"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CREATOR, draftOf, leakyGraph, packageOf } from "@tests/fixtures/builders/agent-template.builder"
import { TemplateMarketplaceError, TemplateMarketplaceErrorCode } from "./errors/template-marketplace.error"
import { TemplateLikenessService } from "./template-likeness.service"
import { TemplateListingsService } from "./template-listings.service"
import { TemplateListingEntity } from "./persistence/entities"

const ADMIN: Principal = { id: "admin-1", email: "admin@nivo.vn", role: "authenticated" }
const AT = new Date("2026-11-03T02:00:00.000Z")

const PASSING = [
    { id: "schema", ok: true, detail: "" },
    { id: "likeness_consent", ok: true, detail: "" },
]

const rowOf = (over: Partial<TemplateListingEntity> = {}): TemplateListingEntity =>
    Object.assign(new TemplateListingEntity(), {
        id: "listing-1",
        templateKey: "spa-booking-by-linh",
        version: 1,
        status: "draft",
        priceVnd: 0,
        revenueSharePct: 70,
        checks: [],
        reviewNote: "",
        firstParty: false,
        updatedAt: AT,
        ...over,
    })

const stored = (pkg = packageOf(), over: Partial<StoredVersion> = {}): StoredVersion => ({
    key: pkg.key,
    version: pkg.version,
    package: pkg,
    hash: pkg.hash,
    changelog: "",
    breaking: false,
    creatorAccountId: CREATOR.accountId,
    firstParty: false,
    ...over,
})

interface Options {
    readonly version?: StoredVersion | null
    readonly consented?: boolean
    readonly em?: MockEntityManager
    readonly notAdmin?: boolean
}

const build = async (options: Options = {}) => {
    const em = options.em ?? mockEntityManager()
    const version = options.version === undefined ? stored() : options.version
    const versions = mock<AgentTemplateVersionsService>({
        require: jest
            .fn()
            .mockImplementation(() =>
                version === null ? Promise.reject(new Error("no version")) : Promise.resolve(version),
            ),
        find: jest.fn().mockResolvedValue(version),
        listOf: jest.fn().mockResolvedValue([{ key: "spa-booking-by-linh" }]),
    })
    const likeness = mock<TemplateLikenessService>({ covers: jest.fn().mockResolvedValue(options.consented ?? true) })
    const modules = mock<ModulesService>({
        find: jest.fn().mockResolvedValue({
            key: "accounting",
            connectionProviders: ["sepay", "dossier", "unknown"],
            authorityActions: [{ action: "pay_supplier", maxMode: null }],
        }),
    })
    const plugins = mock<AgentPluginsService>({ keys: jest.fn().mockReturnValue([]) })
    const access = mock<AdminAccessService>({
        requireAdmin:
            options.notAdmin === true
                ? jest.fn().mockImplementation(() => {
                      throw new Error("not an admin")
                  })
                : jest.fn().mockReturnValue({ userId: "admin-1", email: "admin@nivo.vn" }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TemplateListingsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: AgentTemplateVersionsService, useValue: versions },
            { provide: TemplateLikenessService, useValue: likeness },
            { provide: ModulesService, useValue: modules },
            { provide: AgentPluginsService, useValue: plugins },
            { provide: AdminAccessService, useValue: access },
        ],
    }).compile()
    return { service: moduleRef.get(TemplateListingsService), em, versions, likeness }
}

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof TemplateMarketplaceError ? cause.code : cause
    }
}

const SUBMIT = { key: "spa-booking-by-linh", version: 1, priceVnd: 0 }

describe("TemplateListingsService.submit", () => {
    it("creates the listing of a version of the caller, runs the automated checks and submits it for review when they pass", async () => {
        const { service, em } = await build({
            em: mockEntityManager({
                findOne: [TemplateListingEntity, null],
                insert: [TemplateListingEntity, { identifiers: [{ id: "listing-1" }] }],
            }),
        })
        em.findOne
            .mockResolvedValueOnce(null)
            .mockResolvedValue(rowOf({ status: "submitted", priceVnd: 99_000, checks: PASSING }))

        const view = await service.submit(CREATOR.accountId, { ...SUBMIT, priceVnd: 99_000 })

        expect(em.insert).toHaveBeenCalledWith(
            TemplateListingEntity,
            expect.objectContaining({
                status: "submitted",
                priceVnd: 99_000,
                revenueSharePct: 70,
                submittedBy: CREATOR.accountId,
                templateKey: "spa-booking-by-linh",
            }),
        )
        expect(view).toMatchObject({
            status: "submitted",
            priceVnd: 99_000,
            name: { vi: "Đặt lịch spa" },
            checks: PASSING,
        })
    })

    it("keeps a listing a draft, with the checks written down, when one of them fails", async () => {
        const { service, em } = await build({
            consented: false,
            version: stored(
                packageOf(
                    leakyGraph(),
                    draftOf({
                        persona: {
                            soul: "x",
                            likeness: { personName: "Ngoc Trinh", allowedUses: ["name"], disclosure: "AI" },
                        },
                    }),
                ),
            ),
            em: mockEntityManager({
                findOne: [TemplateListingEntity, rowOf({ status: "rejected" })],
                update: [TemplateListingEntity, { affected: 1 }],
            }),
        })

        await service.submit(CREATOR.accountId, SUBMIT)

        expect(em.update).toHaveBeenCalledWith(
            TemplateListingEntity,
            { id: "listing-1" },
            expect.objectContaining({
                status: "draft",
                checks: expect.arrayContaining([expect.objectContaining({ id: "likeness_consent", ok: false })]),
            }),
        )
    })

    it("refuses a price that is not a whole non-negative amount, a template of another account and an approved listing offered again", async () => {
        const price = await build()
        const foreign = await build({ version: stored(packageOf(), { creatorAccountId: "someone-else" }) })
        const approved = await build({
            em: mockEntityManager({ findOne: [TemplateListingEntity, rowOf({ status: "approved" })] }),
        })

        expect(await codeOf(price.service.submit(CREATOR.accountId, { ...SUBMIT, priceVnd: -1 }))).toBe(
            TemplateMarketplaceErrorCode.PriceInvalid,
        )
        expect(await codeOf(price.service.submit(CREATOR.accountId, { ...SUBMIT, priceVnd: 1.5 }))).toBe(
            TemplateMarketplaceErrorCode.PriceInvalid,
        )
        expect(await codeOf(foreign.service.submit(CREATOR.accountId, SUBMIT))).toBe(
            TemplateMarketplaceErrorCode.NotYours,
        )
        expect(await codeOf(approved.service.submit(CREATOR.accountId, SUBMIT))).toBe(
            TemplateMarketplaceErrorCode.BadTransition,
        )
    })
})

describe("TemplateListingsService.review", () => {
    const REVIEW = { listingId: "listing-1", decision: "approve" as const, note: "Good", revenueSharePct: null }

    it("approves a submitted listing for a platform reviewer, running the checks again, and keeps who and when", async () => {
        const { service, em } = await build({
            em: mockEntityManager({
                findOne: [TemplateListingEntity, rowOf({ status: "submitted" })],
                update: [TemplateListingEntity, { affected: 1 }],
            }),
        })

        await service.review(ADMIN, { ...REVIEW, revenueSharePct: 60 })

        expect(em.update).toHaveBeenCalledWith(
            TemplateListingEntity,
            { id: "listing-1" },
            expect.objectContaining({
                status: "approved",
                reviewedBy: "admin-1",
                reviewedAt: AT,
                reviewNote: "Good",
                revenueSharePct: 60,
            }),
        )
    })

    it("rejects a submitted listing with the note and the checks it had, and keeps the share", async () => {
        const { service, em } = await build({
            em: mockEntityManager({
                findOne: [TemplateListingEntity, rowOf({ status: "submitted", checks: PASSING })],
                update: [TemplateListingEntity, { affected: 1 }],
            }),
        })

        await service.review(ADMIN, { ...REVIEW, decision: "reject", note: "Too vague" })

        expect(em.update).toHaveBeenCalledWith(
            TemplateListingEntity,
            { id: "listing-1" },
            expect.objectContaining({
                status: "rejected",
                reviewNote: "Too vague",
                checks: PASSING,
                revenueSharePct: 70,
            }),
        )
    })

    it("never approves a listing with a check failing now: the consent gate for a persona of a real person", async () => {
        const persona = {
            soul: "x",
            likeness: { personName: "Ngoc Trinh", allowedUses: ["name" as const], disclosure: "AI" },
        }
        const consent = await build({
            consented: false,
            version: stored(packageOf(leakyGraph(), draftOf({ persona }))),
            em: mockEntityManager({ findOne: [TemplateListingEntity, rowOf({ status: "submitted" })] }),
        })
        const plugin = await build({
            version: stored(packageOf(leakyGraph(), draftOf({ requiresPlugins: [{ key: "ghost", minVersion: 1 }] }))),
            em: mockEntityManager({ findOne: [TemplateListingEntity, rowOf({ status: "submitted" })] }),
        })

        expect(await codeOf(consent.service.review(ADMIN, REVIEW))).toBe(TemplateMarketplaceErrorCode.ConsentMissing)
        expect(await codeOf(plugin.service.review(ADMIN, REVIEW))).toBe(TemplateMarketplaceErrorCode.ChecksFailed)
        expect(consent.em.update).not.toHaveBeenCalled()
    })

    it("refuses a listing that is not submitted, one that does not exist, and a caller who is not a platform reviewer", async () => {
        const draft = await build({
            em: mockEntityManager({ findOne: [TemplateListingEntity, rowOf({ status: "draft" })] }),
        })
        const none = await build({ em: mockEntityManager({ findOne: [TemplateListingEntity, null] }) })
        const user = await build({ notAdmin: true })

        expect(await codeOf(draft.service.review(ADMIN, REVIEW))).toBe(TemplateMarketplaceErrorCode.BadTransition)
        expect(await codeOf(none.service.review(ADMIN, REVIEW))).toBe(TemplateMarketplaceErrorCode.ListingNotFound)
        await expect(user.service.review(ADMIN, REVIEW)).rejects.toThrow("not an admin")
        expect(user.em.update).not.toHaveBeenCalled()
    })
})

describe("TemplateListingsService reads", () => {
    it("lists the submitted listings for a reviewer, and refuses anyone else", async () => {
        const reviewer = await build({
            em: mockEntityManager({ find: [TemplateListingEntity, [rowOf({ status: "submitted" })]] }),
        })
        const user = await build({ notAdmin: true })

        await expect(reviewer.service.queue(ADMIN)).resolves.toHaveLength(1)
        expect(() => user.service.queue(ADMIN)).rejects.toThrow("not an admin")
    })

    it("lists the listings of the templates of the caller, and none when the caller has no template", async () => {
        const some = await build({ em: mockEntityManager({ find: [TemplateListingEntity, [rowOf()]] }) })
        const none = await build()
        none.versions.listOf.mockResolvedValueOnce([])

        await expect(some.service.mine(CREATOR.accountId)).resolves.toHaveLength(1)
        await expect(none.service.mine(CREATOR.accountId)).resolves.toEqual([])
    })

    it("puts only approved listings into the catalogue, as cards a buyer reads, and drops one whose package is gone", async () => {
        const { service, versions } = await build({
            em: mockEntityManager({
                find: [
                    TemplateListingEntity,
                    [
                        rowOf({ status: "approved", priceVnd: 99_000, firstParty: true }),
                        rowOf({ id: "listing-2", status: "approved" }),
                    ],
                ],
            }),
        })
        versions.find.mockResolvedValueOnce(stored()).mockResolvedValueOnce(null)

        const cards = await service.catalogue()

        expect(cards).toHaveLength(1)
        expect(cards[0]).toMatchObject({
            id: "listing-1",
            templateKey: "spa-booking-by-linh",
            priceVnd: 99_000,
            firstParty: true,
            publisherName: "Linh",
            personName: null,
        })
        expect(cards[0]?.parameters).toHaveLength(3)
    })

    it("hands a buyer an approved listing, and refuses one that is not approved or whose package is gone", async () => {
        const approved = await build({
            em: mockEntityManager({ findOne: [TemplateListingEntity, rowOf({ status: "approved" })] }),
        })
        const draft = await build({
            em: mockEntityManager({ findOne: [TemplateListingEntity, rowOf({ status: "submitted" })] }),
        })
        const none = await build({ em: mockEntityManager({ findOne: [TemplateListingEntity, null] }) })
        const gone = await build({
            version: null,
            em: mockEntityManager({ findOne: [TemplateListingEntity, rowOf({ status: "approved" })] }),
        })

        await expect(approved.service.approved("listing-1")).resolves.toMatchObject({ card: { id: "listing-1" } })
        expect(await codeOf(draft.service.approved("listing-1"))).toBe(TemplateMarketplaceErrorCode.NotAvailable)
        expect(await codeOf(none.service.approved("listing-1"))).toBe(TemplateMarketplaceErrorCode.NotAvailable)
        expect(await codeOf(gone.service.approved("listing-1"))).toBe(TemplateMarketplaceErrorCode.NotAvailable)
    })

    it("answers the newest approved version of a template, zero when none is approved", async () => {
        const some = await build({ em: mockEntityManager({ findOne: [TemplateListingEntity, rowOf({ version: 4 })] }) })
        const none = await build({ em: mockEntityManager({ findOne: [TemplateListingEntity, null] }) })

        await expect(some.service.latestApproved("spa-booking-by-linh")).resolves.toBe(4)
        await expect(none.service.latestApproved("spa-booking-by-linh")).resolves.toBe(0)
    })

    it("names a listing by its key when its package cannot be read", async () => {
        const { service, versions } = await build({
            em: mockEntityManager({ find: [TemplateListingEntity, [rowOf({ status: "submitted" })]] }),
        })
        versions.find.mockResolvedValue(null)

        const [view] = await service.queue(ADMIN)

        expect(view?.name).toEqual({ vi: "spa-booking-by-linh", en: "spa-booking-by-linh" })
    })
})
