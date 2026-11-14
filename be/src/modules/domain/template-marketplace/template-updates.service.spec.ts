import { Test } from "@nestjs/testing"
import * as sdk from "@nivo-lite/agent-sdk/template"
import { instantiate, type GraphDocument as SdkGraph } from "@nivo-lite/agent-sdk/template"
import { builder, mock } from "@starci/jest-preset"
import {
    AgentGraphPublishService,
    AgentGraphsService,
    graphDocumentSchema,
    type GraphDocument,
} from "@modules/domain/agent-graphs"
import {
    AgentTemplateVersionsService,
    TemplateRecordsService,
    type TemplateInstallView,
    type TemplateLicenseView,
    type StoredVersion,
} from "@modules/domain/agent-templates"
import { WorkspaceMembersService, type WorkspaceMember } from "@modules/domain/workspace-members"
import { amountIs, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import {
    CREATOR,
    draftOf,
    leakyGraph,
    packageOf,
    withExtraBranch,
} from "@tests/fixtures/builders/agent-template.builder"
import { INSTALL_VALUES } from "@tests/fixtures/builders/template-rows.builder"
import { TemplateMarketplaceError, TemplateMarketplaceErrorCode } from "./errors/template-marketplace.error"
import { TemplateListingsService } from "./template-listings.service"
import { TemplateUpdatesService } from "./template-updates.service"

const VALUES = INSTALL_VALUES
const BUYER = "99999999-9999-4999-8999-999999999999"

const v1 = packageOf()
/** Version 2 of the creator: a stricter approval on the middle branch, and a new branch. */
const stricter = (graph: SdkGraph): SdkGraph => ({
    ...graph,
    nodes: graph.nodes.map((node) =>
        node.decide === undefined
            ? node
            : {
                  ...node,
                  decide: {
                      ...node.decide,
                      branches: node.decide.branches.map((branch) =>
                          branch.key === "middle" && branch.approver !== null
                              ? { ...branch, approver: { ...branch.approver, policy: "all" as const } }
                              : branch,
                      ),
                  },
              },
    ),
})
const v2 = packageOf(stricter(withExtraBranch(leakyGraph())), draftOf({ version: 2 }))

const storedOf = (pkg: typeof v1, breaking = false): StoredVersion => ({
    key: pkg.key,
    version: pkg.version,
    package: pkg,
    hash: pkg.hash,
    changelog: `v${pkg.version}`,
    breaking,
    creatorAccountId: CREATOR.accountId,
    firstParty: false,
})

const installRow = (over: Partial<TemplateInstallView> = {}): TemplateInstallView => ({
    installationId: "inst-1",
    workspaceId: "ws-buyer",
    templateKey: "spa-booking-by-linh",
    version: 1,
    parameterValues: VALUES,
    licenseId: "license-1",
    ...over,
})

const licenseRow = (over: Partial<TemplateLicenseView> = {}): TemplateLicenseView => ({
    id: "license-1",
    kind: "free",
    installationId: null,
    status: "active",
    ...over,
})

const memberOf = builder<WorkspaceMember>({
    userId: BUYER,
    workspaceId: "ws-buyer",
    role: "owner",
    staffId: null,
    displayName: "Chu",
    status: "active",
})

/** What the buyer has now: version 1, edited by hand on the branch named. */
const editedSmall = (graph: GraphDocument): GraphDocument => ({
    ...graph,
    nodes: graph.nodes.map((node) =>
        node.decide === undefined
            ? node
            : {
                  ...node,
                  decide: {
                      ...node.decide,
                      branches: node.decide.branches.map((branch) =>
                          branch.key === "small" ? { ...branch, when: amountIs("lt", 9_000_000) } : branch,
                      ),
                  },
              },
    ),
})

interface Options {
    readonly install?: TemplateInstallView | null
    readonly license?: TemplateLicenseView | null
    readonly current?: GraphDocument | null
    readonly latestApproved?: number
    readonly latestPrivate?: number
    readonly breaking?: boolean
    readonly installs?: ReadonlyArray<TemplateInstallView>
    readonly agentless?: boolean
    readonly vanishing?: boolean
}

const build = async (options: Options = {}) => {
    const current =
        options.current === undefined
            ? editedSmall(graphDocumentSchema.parse(instantiate(v1, VALUES)))
            : options.current
    const records = mock<TemplateRecordsService>({
        installsOf: jest
            .fn()
            .mockResolvedValue(options.installs ?? (options.install === null ? [] : [options.install ?? installRow()])),
        installOf: jest.fn().mockResolvedValue(options.install === undefined ? installRow() : options.install),
        licenseById: jest.fn().mockResolvedValue(options.license === undefined ? licenseRow() : options.license),
        moveInstall: jest.fn().mockResolvedValue(undefined),
    })
    const versions = mock<AgentTemplateVersionsService>({
        latestNumber: jest.fn().mockResolvedValue(options.latestPrivate ?? 2),
        require: jest
            .fn()
            .mockImplementation((_key: string, version: number) =>
                Promise.resolve(version === 1 ? storedOf(v1) : storedOf(v2, options.breaking === true)),
            ),
    })
    const listings = mock<TemplateListingsService>({
        latestApproved: jest.fn().mockResolvedValue(options.latestApproved ?? 2),
    })
    const stateOfAgent = jest
        .fn()
        .mockResolvedValue(
            current === null ? stateOf({ active: null }) : stateOf({ active: current, activeKind: "template" }),
        )
    if (options.vanishing === true)
        stateOfAgent.mockResolvedValueOnce(stateOf({ active: current })).mockResolvedValue(null)
    const graphs = mock<AgentGraphsService>({
        stateOfAgent,
        stateOfInstallation: jest
            .fn()
            .mockResolvedValue(options.agentless === true ? null : stateOf({ agentId: "agent-new" })),
    })
    const publish = mock<AgentGraphPublishService>({ publishTemplate: jest.fn().mockResolvedValue({ id: "v-new" }) })
    const members = mock<WorkspaceMembersService>({
        require: jest.fn().mockResolvedValue(memberOf()),
        idOf: jest.fn().mockResolvedValue("member-owner"),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TemplateUpdatesService,
            { provide: TemplateRecordsService, useValue: records },
            { provide: AgentTemplateVersionsService, useValue: versions },
            { provide: TemplateListingsService, useValue: listings },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphPublishService, useValue: publish },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(TemplateUpdatesService), records, publish, members, listings, versions }
}

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof TemplateMarketplaceError ? cause.code : cause
    }
}

describe("TemplateUpdatesService.offer", () => {
    it("offers the newer version by branch: the edited branch is untouched by it, the one the creator changed is an upgrade, the new one is added", async () => {
        const { service } = await build()

        const offer = await service.offer(BUYER, "ws-buyer", "inst-1")

        expect(offer).toMatchObject({
            installationId: "inst-1",
            key: "spa-booking-by-linh",
            installed: 1,
            offered: 2,
            breaking: false,
            changelog: "v2",
        })
        expect(offer?.units).toContainEqual({
            id: "branch:decide:middle",
            nodeKey: "decide",
            branchKey: "middle",
            change: "upgrade",
        })
        expect(offer?.units).toContainEqual({
            id: "branch:decide:tiny",
            nodeKey: "decide",
            branchKey: "tiny",
            change: "added",
        })
        expect(offer?.units.some((unit) => unit.id === "branch:decide:small")).toBe(false)
    })

    it("marks a version the creator flagged as breaking, so the buyer reads it first", async () => {
        const { service } = await build({ breaking: true })

        await expect(service.offer(BUYER, "ws-buyer", "inst-1")).resolves.toMatchObject({ breaking: true })
    })
})

describe("TemplateUpdatesService.offer by kind of license", () => {
    it("takes the newest approved version for an install from a listing and the newest saved one for a private install", async () => {
        const listed = await build({ latestApproved: 1 })
        const privately = await build({ license: licenseRow({ kind: "private" }), latestPrivate: 2, latestApproved: 1 })

        await expect(listed.service.offer(BUYER, "ws-buyer", "inst-1")).resolves.toBeNull()
        await expect(privately.service.offer(BUYER, "ws-buyer", "inst-1")).resolves.toMatchObject({ offered: 2 })
        expect(listed.listings.latestApproved).toHaveBeenCalledWith("spa-booking-by-linh")
        expect(privately.listings.latestApproved).not.toHaveBeenCalled()
    })

    it("offers nothing without an active license, with no template install, or when the buyer already has the new version", async () => {
        const revoked = await build({ license: licenseRow({ status: "revoked" }) })
        const noLicense = await build({ install: installRow({ licenseId: null }) })
        const none = await build({ install: null })
        const same = await build({ current: graphDocumentSchema.parse(instantiate(v2, VALUES)) })

        await expect(revoked.service.offer(BUYER, "ws-buyer", "inst-1")).resolves.toBeNull()
        await expect(noLicense.service.offer(BUYER, "ws-buyer", "inst-1")).resolves.toBeNull()
        expect(await codeOf(none.service.offer(BUYER, "ws-buyer", "inst-1"))).toBe(
            TemplateMarketplaceErrorCode.NotATemplateInstall,
        )
        await expect(same.service.offer(BUYER, "ws-buyer", "inst-1")).resolves.toBeNull()
    })

    it("offers nothing for an agent whose graph has no version yet", async () => {
        const { service } = await build({ current: null })

        await expect(service.offer(BUYER, "ws-buyer", "inst-1")).resolves.toBeNull()
    })

    it("offers nothing for an installation that has no agent any more", async () => {
        const { service } = await build({ agentless: true })

        await expect(service.offer(BUYER, "ws-buyer", "inst-1")).resolves.toBeNull()
    })

    it("lists the offers of every installation of the workspace that has one, for any member", async () => {
        const { service, members } = await build()

        const offers = await service.offers(BUYER, "ws-buyer")

        expect(offers).toHaveLength(1)
        expect(members.require).toHaveBeenCalledWith(BUYER, "ws-buyer")
    })

    it("leaves out the installation that is up to date from the list of offers", async () => {
        const { service } = await build({
            installs: [installRow(), installRow({ installationId: "inst-2", licenseId: null })],
        })

        const offers = await service.offers(BUYER, "ws-buyer")

        expect(offers.map((offer) => offer.installationId)).toEqual(["inst-1"])
    })
})

describe("TemplateUpdatesService.accept", () => {
    it("takes only the units named, keeps the edit of the buyer, and publishes through the same checks as any change", async () => {
        const { service, publish } = await build()

        await service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:middle"])

        const [workspaceId, agentId, document, by] = publish.publishTemplate.mock.calls[0] ?? []
        expect([workspaceId, agentId, by]).toEqual([
            "ws-buyer",
            "agent-new",
            { memberId: "member-owner", role: "owner" },
        ])
        const branches = document?.nodes.find((node) => node.key === "decide")?.decide?.branches ?? []
        expect(branches.find((branch) => branch.key === "small")?.when).toEqual(amountIs("lt", 9_000_000))
        expect(branches.find((branch) => branch.key === "middle")?.approver?.policy).toBe("all")
        expect(branches.some((branch) => branch.key === "tiny")).toBe(false)
    })

    it("moves the install to the newer version only when every unit was taken, so what is left stays on offer", async () => {
        const part = await build()
        const all = await build()
        const offer = await all.service.offer(BUYER, "ws-buyer", "inst-1")
        const ids = offer?.units.map((unit) => unit.id) ?? []

        await part.service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:tiny"])
        await all.service.accept(BUYER, "ws-buyer", "inst-1", ids)

        expect(part.records.moveInstall).not.toHaveBeenCalled()
        expect(all.records.moveInstall).toHaveBeenCalledWith({
            installationId: "inst-1",
            version: 2,
            parameterValues: VALUES,
        })
    })
})

describe("TemplateUpdatesService.accept refusals", () => {
    it("refuses an empty choice, a unit that is not on offer and an install with nothing to offer, and publishes nothing", async () => {
        const { service, publish } = await build()
        const nothing = await build({ latestApproved: 1 })
        const bare = await build({ current: null })

        expect(await codeOf(service.accept(BUYER, "ws-buyer", "inst-1", []))).toBe(
            TemplateMarketplaceErrorCode.UpdateUnavailable,
        )
        expect(await codeOf(service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:ghost"]))).toBe(
            TemplateMarketplaceErrorCode.UpdateUnavailable,
        )
        expect(await codeOf(nothing.service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:tiny"]))).toBe(
            TemplateMarketplaceErrorCode.UpdateUnavailable,
        )
        expect(await codeOf(bare.service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:tiny"]))).toBe(
            TemplateMarketplaceErrorCode.UpdateUnavailable,
        )
        expect(publish.publishTemplate).not.toHaveBeenCalled()
    })

    it("refuses, publishing nothing, when the agent has no active graph any more by the time it is taken", async () => {
        const { service, publish } = await build({ vanishing: true })

        expect(await codeOf(service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:tiny"]))).toBe(
            TemplateMarketplaceErrorCode.UpdateUnavailable,
        )
        expect(publish.publishTemplate).not.toHaveBeenCalled()
    })

    it("lets the publish checks refuse the result: an update never goes round the ceiling of the buyer", async () => {
        const { service, publish, records } = await build()
        publish.publishTemplate.mockRejectedValueOnce(new Error("above the ceiling"))

        await expect(service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:tiny"])).rejects.toThrow(
            "above the ceiling",
        )
        expect(records.moveInstall).not.toHaveBeenCalled()
    })

    it("asks for an owner or a manager, whoever the members check refuses publishes nothing", async () => {
        const { service, members, publish } = await build()
        members.require.mockRejectedValueOnce(new Error("staff"))

        await expect(service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:tiny"])).rejects.toThrow("staff")
        expect(members.require).toHaveBeenCalledWith(BUYER, "ws-buyer", ["owner", "manager"])
        expect(publish.publishTemplate).not.toHaveBeenCalled()
    })

    it("refuses, publishing nothing, a result the graph schema cannot read", async () => {
        const { service, publish } = await build()
        const unreadable = Object.assign({}, graphDocumentSchema.parse(instantiate(v2, VALUES)), {
            nodes: [{ key: "x" }],
        })
        jest.spyOn(sdk, "applyUnits").mockReturnValueOnce(unreadable)

        expect(await codeOf(service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:tiny"]))).toBe(
            TemplateMarketplaceErrorCode.UpdateUnavailable,
        )
        expect(publish.publishTemplate).not.toHaveBeenCalled()
    })
})

describe("TemplateUpdatesService.accept and the rights the updated flow asks for", () => {
    const AGREED = [{ nodeKey: "ledger", connectionId: "c-books", operation: "op", mode: "ask" }]

    it("publishes exactly as before when the call agrees nothing: no fifth argument, with or without an empty list", async () => {
        const { service, publish } = await build()

        await service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:tiny"])
        await service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:tiny"], [])
        await service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:tiny"], null)

        expect(publish.publishTemplate.mock.calls.map((call) => call.length)).toEqual([4, 4, 4])
    })

    it("hands the entries the owner agreed to the publish, read as modes: one that is neither auto nor ask agrees nothing", async () => {
        const { service, publish } = await build()
        const sent = [...AGREED, { nodeKey: "ledger", connectionId: "c-books", operation: "other", mode: "always" }]

        await service.accept(BUYER, "ws-buyer", "inst-1", ["branch:decide:tiny"], sent)

        expect(publish.publishTemplate.mock.calls[0]?.[4]).toEqual(AGREED)
    })

    it("lets the refusal that lists the rights reach the caller as it is, and leaves the install on its version", async () => {
        const { service, publish, records } = await build()
        const offer = await service.offer(BUYER, "ws-buyer", "inst-1")
        const every = offer?.units.map((unit) => unit.id) ?? []
        const refusal = new TemplateMarketplaceError({
            // The gate's own refusal passes through unchanged; this capability's error stands in for it here.
            code: TemplateMarketplaceErrorCode.UpdateUnavailable,
            params: { rights: "[the list]" },
        })
        publish.publishTemplate.mockRejectedValueOnce(refusal)

        await expect(service.accept(BUYER, "ws-buyer", "inst-1", every)).rejects.toBe(refusal)
        expect(records.moveInstall).not.toHaveBeenCalled()
        await service.accept(BUYER, "ws-buyer", "inst-1", every, AGREED)

        expect(records.moveInstall).toHaveBeenCalledTimes(1)
    })
})
