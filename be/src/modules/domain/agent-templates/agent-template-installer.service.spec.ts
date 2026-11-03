import { Test } from "@nestjs/testing"
import * as sdk from "@nivo-lite/agent-sdk/template"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentGraphPublishService, AgentGraphSeedService } from "@modules/domain/agent-graphs"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModuleInstallService, ModulesService } from "@modules/domain/modules"
import type { ModuleDefinition } from "@modules/domain/modules"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CREATOR, packageOf } from "@tests/fixtures/builders/agent-template.builder"
import { AgentTemplateInstallerService } from "./agent-template-installer.service"
import type { InstallTemplateRequest } from "./agent-template-installer.service"
import { AgentTemplateVersionsService } from "./agent-template-versions.service"
import type { StoredVersion } from "./agent-template-versions.service"
import { AgentTemplatesError, AgentTemplatesErrorCode } from "./errors/agent-templates.error"
import { TemplateInstallEntity, TemplateLicenseEntity } from "./persistence/entities"

const BUYER = "99999999-9999-4999-8999-999999999999"
const memberOf = builder<WorkspaceMember>({
    userId: BUYER,
    workspaceId: "ws-buyer",
    role: "owner",
    staffId: null,
    displayName: "Chu shop",
    status: "active",
})

const stored = (over: Partial<StoredVersion> = {}): StoredVersion => {
    const pkg = packageOf()
    return {
        key: pkg.key,
        version: 1,
        package: pkg,
        hash: pkg.hash,
        changelog: "",
        breaking: false,
        creatorAccountId: CREATOR.accountId,
        firstParty: false,
        ...over,
    }
}

const REQUEST: InstallTemplateRequest = {
    workspaceId: "ws-buyer",
    key: "spa-booking-by-linh",
    version: 1,
    values: { autoLimit: 8_000_000 },
    name: null,
    locale: "vi",
    access: { kind: "licensed", license: "free", listingId: "listing-1", licenseId: null },
}

interface Options {
    readonly member?: Partial<WorkspaceMember>
    readonly module?: Partial<ModuleDefinition>
    readonly present?: object | null
    readonly version?: StoredVersion
}

const build = async (options: Options = {}) => {
    const em = mockEntityManager({
        insert: [
            [TemplateInstallEntity, {}],
            [TemplateLicenseEntity, { identifiers: [{ id: "license-1" }] }],
        ],
        update: [TemplateLicenseEntity, { affected: 1 }],
    })
    const tx = fakeTransaction(em)
    const versions = mock<AgentTemplateVersionsService>({
        require: jest.fn().mockResolvedValue(options.version ?? stored()),
    })
    const members = mock<WorkspaceMembersService>({
        require: jest.fn().mockResolvedValue(memberOf(options.member)),
        idOf: jest.fn().mockResolvedValue("member-owner"),
    })
    const modules = mock<ModulesService>({
        find: jest.fn().mockResolvedValue({ key: "accounting", multiInstance: false, ...options.module }),
    })
    const moduleInstall = mock<ModuleInstallService>({
        install: jest.fn().mockResolvedValue({ installationId: "inst-new", agentId: "agent-new", created: true }),
    })
    const installations = mock<InstallationRecordsService>({
        firstOfModule: jest.fn().mockResolvedValue(options.present ?? null),
    })
    const seed = mock<AgentGraphSeedService>({ ensureFor: jest.fn().mockResolvedValue(null) })
    const publish = mock<AgentGraphPublishService>({
        publishTemplate: jest.fn().mockResolvedValue({ id: "v1" }),
        setMode: jest.fn().mockResolvedValue(null),
    })
    const documents = mock<PublicDocumentsService>({ write: jest.fn().mockResolvedValue({}) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTemplateInstallerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentTemplateVersionsService, useValue: versions },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ModulesService, useValue: modules },
            { provide: ModuleInstallService, useValue: moduleInstall },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentGraphSeedService, useValue: seed },
            { provide: AgentGraphPublishService, useValue: publish },
            { provide: PublicDocumentsService, useValue: documents },
        ],
    }).compile()
    return {
        service: moduleRef.get(AgentTemplateInstallerService),
        em,
        tx,
        members,
        moduleInstall,
        publish,
        documents,
        installations,
    }
}

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof AgentTemplatesError ? cause.code : cause
    }
}

describe("AgentTemplateInstallerService.install", () => {
    it("makes the agent through the module install, publishes the filled graph as a template version, and leaves the agent in shadow", async () => {
        const { service, publish, moduleInstall } = await build()

        const installed = await service.install(BUYER, REQUEST)

        expect(moduleInstall.install).toHaveBeenCalledWith(
            BUYER,
            expect.objectContaining({ moduleKey: "accounting", newInstance: false }),
        )
        const [workspaceId, agentId, document, by] = publish.publishTemplate.mock.calls[0] ?? []
        expect(workspaceId).toBe("ws-buyer")
        expect(agentId).toBe("agent-new")
        expect(by).toEqual({ memberId: "member-owner", role: "owner" })
        expect(document?.rights).toEqual([])
        const small = document?.nodes
            .find((node) => node.key === "decide")
            ?.decide?.branches.find((branch) => branch.key === "small")
        expect(small?.when).toEqual({ fact: "supplier_payment.amount_vnd", op: "lt", value: 8_000_000 })
        expect(publish.setMode).toHaveBeenCalledWith("ws-buyer", "agent-new", "shadow", by)
        expect(installed).toEqual({
            installationId: "inst-new",
            agentId: "agent-new",
            key: "spa-booking-by-linh",
            version: 1,
            licenseId: "license-1",
        })
    })

    it("keeps the provenance of every branch it publishes: the template key and the version", async () => {
        const { service, publish } = await build()

        await service.install(BUYER, REQUEST)

        const document = publish.publishTemplate.mock.calls[0]?.[2]
        const branches = document?.nodes.find((node) => node.key === "decide")?.decide?.branches ?? []
        expect(
            branches.every(
                (branch) =>
                    branch.sources.length === 0 ||
                    branch.sources.some((source) => source.kind === "template" && source.version === 1),
            ),
        ).toBe(true)
        expect(branches.some((branch) => branch.sources.length > 0)).toBe(true)
    })

    it("turns the starter knowledge into drafts the buyer approves again, and records the install and its license", async () => {
        const { service, documents, tx, em } = await build()

        await service.install(BUYER, REQUEST)

        expect(documents.write).toHaveBeenCalledWith(BUYER, "ws-buyer", {
            title: "Gio mo cua",
            body: "Spa mo cua tu 9 gio den 21 gio moi ngay.",
        })
        expect(tx.commits).toBe(1)
        expect(em.insert).toHaveBeenCalledWith(
            TemplateInstallEntity,
            expect.objectContaining({
                installationId: "inst-new",
                templateKey: "spa-booking-by-linh",
                version: 1,
                licenseId: "license-1",
                installedBy: BUYER,
            }),
        )
        expect(em.insert).toHaveBeenCalledWith(
            TemplateLicenseEntity,
            expect.objectContaining({ kind: "free", listingId: "listing-1", installationId: "inst-new" }),
        )
    })

    it("uses the license a payment already wrote and ties it to the installation", async () => {
        const { service, em } = await build()

        const installed = await service.install(BUYER, {
            ...REQUEST,
            access: { kind: "licensed", license: "paid", listingId: "listing-1", licenseId: "license-paid" },
        })

        expect(installed.licenseId).toBe("license-paid")
        expect(em.update).toHaveBeenCalledWith(
            TemplateLicenseEntity,
            { id: "license-paid", workspaceId: "ws-buyer" },
            { installationId: "inst-new" },
        )
        expect(em.insert).not.toHaveBeenCalledWith(TemplateLicenseEntity, expect.anything())
    })

    it("lets a creator run its own template in another workspace of its account as a private license", async () => {
        const { service, em } = await build({ version: stored({ creatorAccountId: BUYER }) })

        await service.install(BUYER, { ...REQUEST, access: { kind: "private" } })

        expect(em.insert).toHaveBeenCalledWith(
            TemplateLicenseEntity,
            expect.objectContaining({ kind: "private", listingId: null }),
        )
    })

    it("refuses a private install of a template of another account, and touches nothing", async () => {
        const { service, moduleInstall } = await build()

        expect(await codeOf(service.install(BUYER, { ...REQUEST, access: { kind: "private" } }))).toBe(
            AgentTemplatesErrorCode.NotYours,
        )
        expect(moduleInstall.install).not.toHaveBeenCalled()
    })

    it("refuses values that do not fit the parameters before it makes any agent", async () => {
        const { service, moduleInstall } = await build()

        expect(await codeOf(service.install(BUYER, { ...REQUEST, values: { autoLimit: 1 } }))).toBe(
            AgentTemplatesErrorCode.ValuesRefused,
        )
        expect(moduleInstall.install).not.toHaveBeenCalled()
    })

    it("asks for the owner of the buyer workspace: whoever the members check refuses installs nothing", async () => {
        const { service, members, moduleInstall } = await build()
        members.require.mockRejectedValueOnce(new Error("not an owner"))

        await expect(service.install(BUYER, REQUEST)).rejects.toThrow("not an owner")
        expect(members.require).toHaveBeenCalledWith(BUYER, "ws-buyer", ["owner"])
        expect(moduleInstall.install).not.toHaveBeenCalled()
    })

    it("never overwrites an agent the workspace has: a kind that allows one is refused, a kind that allows several gets a new instance", async () => {
        const single = await build({ present: { id: "inst-old" } })
        const multi = await build({ present: { id: "inst-old" }, module: { multiInstance: true } })

        expect(await codeOf(single.service.install(BUYER, REQUEST))).toBe(AgentTemplatesErrorCode.BaseAgentExists)
        expect(single.moduleInstall.install).not.toHaveBeenCalled()
        await multi.service.install(BUYER, REQUEST)
        expect(multi.moduleInstall.install).toHaveBeenCalledWith(BUYER, expect.objectContaining({ newInstance: true }))
    })

    it("stops when the install made no agent", async () => {
        const { service, moduleInstall, publish } = await build()
        moduleInstall.install.mockResolvedValueOnce({ installationId: "inst-new", agentId: null, created: true })

        expect(await codeOf(service.install(BUYER, REQUEST))).toBe(AgentTemplatesErrorCode.BaseAgentExists)
        expect(publish.publishTemplate).not.toHaveBeenCalled()
    })

    it("leaves no license and no install row when the buyer graph is refused by the publish checks", async () => {
        const { service, publish, em } = await build()
        publish.publishTemplate.mockRejectedValueOnce(new Error("above the ceiling"))

        await expect(service.install(BUYER, REQUEST)).rejects.toThrow("above the ceiling")
        expect(em.insert).not.toHaveBeenCalled()
        expect(publish.setMode).not.toHaveBeenCalled()
    })

    it("refuses, publishing nothing, a filled graph the graph schema cannot read", async () => {
        const { service, publish } = await build()
        jest.spyOn(sdk, "instantiate").mockReturnValueOnce({
            nodes: [],
            rights: [{ kind: "bogus", scope: "workspace", hide: [], mask: [] }],
        })

        expect(await codeOf(service.install(BUYER, REQUEST))).toBe(AgentTemplatesErrorCode.ValuesRefused)
        expect(publish.publishTemplate).not.toHaveBeenCalled()
    })
})
