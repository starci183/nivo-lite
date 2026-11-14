import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { hashOfPackage, TEMPLATE_FORMAT } from "@nivo-lite/agent-sdk/template"
import { packageOf } from "@nivo-lite/agent-sdk/testing"
import {
    AgentTemplateVersionsService,
    AgentTemplatesErrorCode,
    TemplateRecordsService,
    type StoredVersion,
} from "@modules/domain/agent-templates"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { ModulesService, type ModuleDefinition } from "@modules/domain/modules"
import { AdminAccessService } from "@modules/domain/platform-admin"
import { WorkspaceMembersService, type WorkspaceMember } from "@modules/domain/workspace-members"
import type { Principal } from "@modules/platform/cqrs"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG, type MessageCatalog } from "@modules/platform/i18n"
import { TemplateMarketplaceError, TemplateMarketplaceErrorCode } from "./errors/template-marketplace.error"
import { firstPartyKeyOf, FirstPartyTemplatesService, NIVO_PUBLISHER_ID } from "./first-party-templates.service"
import { TemplateListingsService } from "./template-listings.service"
import { TemplateListingEntity } from "./persistence/entities"

const ADMIN: Principal = { id: "admin-1", email: "admin@nivo.vn", role: "authenticated" }
const USER = "99999999-9999-4999-8999-999999999999"

const moduleOf = (over: Partial<ModuleDefinition> = {}): ModuleDefinition =>
    mock<ModuleDefinition>({
        key: "accounting",
        name: { vi: "Ke toan", en: "Accounting" },
        description: { vi: "Ghi so", en: "Keeps the books" },
        points: { vi: ["Nhanh"], en: ["Fast"] },
        category: "operations",
        connectionProviders: ["sepay"],
        ...over,
    })

const installationOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "accounting",
    name: "Accounting",
    isMulti: false,
    agentId: "agent-1",
    status: "live",
    operatingMode: "assist",
    liveEnabled: true,
    activeContextVersionId: null,
    settings: {},
    createdAt: "2026-11-03T00:00:00.000Z",
})

const memberOf = builder<WorkspaceMember>({
    userId: USER,
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Linh",
    status: "active",
})

interface Options {
    readonly modules?: ReadonlyArray<ModuleDefinition>
    readonly latest?: number
    readonly storedHash?: string
    readonly pages?: ReadonlyArray<ReadonlyArray<InstallationRecord>>
    readonly known?: boolean
    readonly packageExists?: boolean
    readonly notAdmin?: boolean
    readonly template?: { firstParty: boolean } | null
    readonly approved?: number
    readonly keyTaken?: boolean
    readonly source?: StoredVersion
}

type SavedPackage = Parameters<AgentTemplateVersionsService["save"]>[0]

const storedOf = (options: Options, version: number) =>
    options.packageExists === false ? null : { hash: options.storedHash ?? "old", version, package: packageOf() }

const templateOf = (options: Options, key: string) => {
    if (key !== "mine-derivative") return options.template ?? null
    return options.keyTaken === true ? { creatorAccountId: USER } : null
}

const savedRowOf = (input: SavedPackage) => ({
    id: "row",
    key: input.package.key,
    version: input.package.version,
    hash: input.package.hash,
})

const build = async (options: Options = {}) => {
    const em = mockEntityManager({
        insert: [TemplateListingEntity, {}],
    })
    const records = mock<TemplateRecordsService>({
        installedAmong: jest.fn().mockResolvedValue(new Set(options.known === true ? ["inst-1"] : [])),
        adopt: jest.fn().mockResolvedValue(undefined),
    })
    const modules = mock<ModulesService>({
        catalog: jest.fn().mockResolvedValue({ categories: [], modules: options.modules ?? [moduleOf()] }),
    })
    const saved: Array<SavedPackage> = []
    const versions = mock<AgentTemplateVersionsService>({
        latestNumber: jest.fn().mockResolvedValue(options.latest ?? 0),
        find: jest
            .fn()
            .mockImplementation((_key: string, version: number) => Promise.resolve(storedOf(options, version))),
        require: jest.fn().mockResolvedValue(options.source),
        save: jest.fn().mockImplementation((input: SavedPackage) => {
            saved.push(input)
            return Promise.resolve(savedRowOf(input))
        }),
        templateOf: jest.fn().mockImplementation((key: string) => Promise.resolve(templateOf(options, key))),
    })
    const listings = mock<TemplateListingsService>({
        latestApproved: jest.fn().mockResolvedValue(options.approved ?? 2),
    })
    const pages = [...(options.pages ?? [])]
    const installations = mock<InstallationRecordsService>({
        page: jest.fn().mockImplementation(() => Promise.resolve(pages.shift() ?? [])),
    })
    const access = mock<AdminAccessService>({
        requireAdmin:
            options.notAdmin === true
                ? jest.fn().mockImplementation(() => {
                      throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.NotYours })
                  })
                : jest.fn().mockReturnValue({ userId: "admin-1", email: "admin@nivo.vn" }),
    })
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(memberOf()) })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => key) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            FirstPartyTemplatesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: ModulesService, useValue: modules },
            { provide: AgentTemplateVersionsService, useValue: versions },
            { provide: TemplateRecordsService, useValue: records },
            { provide: TemplateListingsService, useValue: listings },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AdminAccessService, useValue: access },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(FirstPartyTemplatesService), em, records, versions, saved, installations, members }
}

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof TemplateMarketplaceError
            ? cause.code
            : cause instanceof Error && "code" in cause
              ? cause.code
              : cause
    }
}

describe("firstPartyKeyOf", () => {
    it("names the package of a module after the platform and the module", () => {
        expect(firstPartyKeyOf("accounting")).toBe("nivo-accounting")
    })
})

describe("FirstPartyTemplatesService.sync", () => {
    it("packages the seed graph of a module as a first-party package, with no parameter, and lists it approved", async () => {
        const { service, saved, em } = await build()

        const report = await service.sync(ADMIN)

        expect(report).toEqual({ packaged: ["nivo-accounting"], unchanged: [], refused: [], adopted: 0 })
        const pkg = saved[0]?.package
        expect(pkg).toMatchObject({
            format: TEMPLATE_FORMAT,
            key: "nivo-accounting",
            version: 1,
            baseModule: "accounting",
            publisher: { creatorId: NIVO_PUBLISHER_ID, displayName: "Nivo" },
        })
        expect(pkg?.parameters).toEqual([])
        expect(saved[0]).toMatchObject({ creatorAccountId: NIVO_PUBLISHER_ID, firstParty: true, breaking: false })
        expect(em.insert).toHaveBeenCalledWith(
            TemplateListingEntity,
            expect.objectContaining({
                templateKey: "nivo-accounting",
                version: 1,
                status: "approved",
                priceVnd: 0,
                firstParty: true,
            }),
        )
    })

    it("does not package again a module whose latest version already says what its seed says", async () => {
        const first = await build()
        await first.service.sync(ADMIN)
        const hash = first.saved[0]?.package.hash ?? ""
        const { service, saved } = await build({ latest: 1, storedHash: hash })

        const report = await service.sync(ADMIN)

        expect(report.unchanged).toEqual(["nivo-accounting"])
        expect(report.packaged).toEqual([])
        expect(saved).toEqual([])
    })

    it("packages a new version, numbered after the latest, when the seed changed", async () => {
        const { service, saved, em } = await build({ latest: 1, storedHash: "an-older-seed" })

        const report = await service.sync(ADMIN)

        expect(report.packaged).toEqual(["nivo-accounting"])
        expect(saved[0]?.package.version).toBe(2)
        expect(em.insert).toHaveBeenCalledWith(TemplateListingEntity, expect.objectContaining({ version: 2 }))
    })

    it("reports a module whose package the packager refuses and lists nothing for it", async () => {
        const { service, saved, em } = await build({
            modules: [moduleOf({ name: { vi: "mail boss@shop.vn", en: "Accounting" } })],
        })

        const report = await service.sync(ADMIN)

        expect(report).toEqual({ packaged: [], unchanged: [], refused: ["nivo-accounting"], adopted: 0 })
        expect(saved).toEqual([])
        expect(em.insert).not.toHaveBeenCalled()
    })
})

describe("FirstPartyTemplatesService.sync: points and admins", () => {
    it("words a point in English when the module gave fewer of them", async () => {
        const autoModule = moduleOf({ points: { vi: ["Nhanh", "Gon"], en: ["Fast"] } })
        const { service, saved } = await build({ modules: [autoModule] })

        await service.sync(ADMIN)

        const pkg = saved[0]?.package
        expect(pkg?.listing.points).toEqual([
            { vi: "Nhanh", en: "Fast" },
            { vi: "Gon", en: "Gon" },
        ])
    })

    it("is for a platform admin alone", async () => {
        const { service, saved } = await build({ notAdmin: true })

        await expect(service.sync(ADMIN)).rejects.toBeInstanceOf(TemplateMarketplaceError)
        expect(saved).toEqual([])
    })
})

describe("FirstPartyTemplatesService.sync: the installations that already run", () => {
    it("records an installation of a built-in module as an install of version 1 of its package, with a free license, and nothing else", async () => {
        const { service, records, installations } = await build({ pages: [[installationOf()]] })

        const report = await service.sync(ADMIN)

        expect(report.adopted).toBe(1)
        expect(installations.page).toHaveBeenCalledTimes(2)
        expect(records.adopt).toHaveBeenCalledWith(installationOf(), "nivo-accounting")
    })

    it("reads the same graph before and after: it writes only the listing, never a graph, a rule or an installation", async () => {
        const { service, em } = await build({ pages: [[installationOf()]] })

        await service.sync(ADMIN)

        const written = new Set(em.insert.mock.calls.map((call) => call[0]))
        expect([...written]).toEqual([TemplateListingEntity])
        expect(em.update).not.toHaveBeenCalled()
        expect(em.save).not.toHaveBeenCalled()
        expect(em.delete).not.toHaveBeenCalled()
    })

    it("leaves alone an installation that already has provenance and one of a module with no package", async () => {
        const known = await build({ pages: [[installationOf()]], known: true })
        const bare = await build({ pages: [[installationOf()]], packageExists: false })

        expect((await known.service.sync(ADMIN)).adopted).toBe(0)
        expect((await bare.service.sync(ADMIN)).adopted).toBe(0)
        expect(known.records.adopt).not.toHaveBeenCalled()
    })

    it("walks every page of installations", async () => {
        const { service, installations } = await build({
            pages: [[installationOf({ id: "a" })], [installationOf({ id: "b" })]],
        })

        const report = await service.sync(ADMIN)

        expect(report.adopted).toBe(2)
        expect(installations.page).toHaveBeenNthCalledWith(2, "a", 200)
    })
})

describe("FirstPartyTemplatesService.fork", () => {
    const FORK = { workspaceId: "ws-1", sourceKey: "nivo-accounting", key: "mine-derivative" }
    const source = (): StoredVersion => {
        const pkg = packageOf()
        return {
            key: "nivo-accounting",
            version: 2,
            package: pkg,
            hash: pkg.hash,
            changelog: "",
            breaking: false,
            creatorAccountId: NIVO_PUBLISHER_ID,
            firstParty: true,
        }
    }

    it("starts a template of the caller from the latest approved first-party package, keeps the provenance of every branch and recomputes the hash", async () => {
        const { service, saved, versions } = await build({ template: { firstParty: true }, source: source() })

        await service.fork(USER, FORK)

        const made = saved[0]?.package
        expect(made).toMatchObject({
            key: "mine-derivative",
            version: 1,
            publisher: { creatorId: USER, displayName: "Linh" },
            baseModule: "accounting",
        })
        const decide = made?.graph.nodes.find((node) => node.key === "decide")
        expect(decide?.sources).toContainEqual({ kind: "template", key: "spa-booking-by-linh", version: 1 })
        expect(decide?.sources).toContainEqual({ kind: "template", key: "mine-derivative", version: 1 })
        expect(
            decide?.decide?.branches.every((branch) =>
                branch.sources.some((s) => s.kind === "template" && s.key === "mine-derivative"),
            ),
        ).toBe(true)
        const { hash, ...body } = made ?? packageOf()
        expect(hash).toBe(hashOfPackage(body))
        expect(saved[0]).toMatchObject({ creatorAccountId: USER, changelog: "Forked from nivo-accounting version 2" })
        expect(versions.require).toHaveBeenCalledWith("nivo-accounting", 2)
    })

    it("hands the key of the source to the store, so the derivative is known as a fork", async () => {
        const { service, versions } = await build({ template: { firstParty: true }, source: source() })

        await service.fork(USER, FORK)

        expect(versions.save).toHaveBeenCalledWith(expect.objectContaining({ forkedFrom: "nivo-accounting" }))
    })

    it("refuses what is not a first-party package, one with no approved version, and a key of the wrong shape", async () => {
        const creator = await build({ template: { firstParty: false }, source: source() })
        const none = await build({ template: null, source: source() })
        const unapproved = await build({ template: { firstParty: true }, approved: 0, source: source() })
        const shape = await build({ template: { firstParty: true }, source: source() })

        expect(await codeOf(creator.service.fork(USER, FORK))).toBe(TemplateMarketplaceErrorCode.ForkNotAllowed)
        expect(await codeOf(none.service.fork(USER, FORK))).toBe(TemplateMarketplaceErrorCode.ForkNotAllowed)
        expect(await codeOf(unapproved.service.fork(USER, FORK))).toBe(TemplateMarketplaceErrorCode.ForkNotAllowed)
        expect(await codeOf(shape.service.fork(USER, { ...FORK, key: "Not A Key" }))).toBe(
            TemplateMarketplaceErrorCode.ForkNotAllowed,
        )
        expect(creator.saved).toEqual([])
    })

    it("refuses a key that is taken, and a caller who is not the owner of the workspace", async () => {
        const taken = await build({ template: { firstParty: true }, source: source(), keyTaken: true })
        const staff = await build({ template: { firstParty: true }, source: source() })
        staff.members.require.mockRejectedValueOnce(new Error("not an owner"))

        expect(await codeOf(taken.service.fork(USER, FORK))).toBe(AgentTemplatesErrorCode.KeyTaken)
        await expect(staff.service.fork(USER, FORK)).rejects.toThrow("not an owner")
        expect(staff.saved).toEqual([])
    })
})
