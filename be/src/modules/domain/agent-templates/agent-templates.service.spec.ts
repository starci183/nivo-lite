import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import type { PublicDocumentView } from "@modules/domain/public-documents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { CREATOR, SECRET_IN_ENV, draftOf, leakyGraph, packageOf } from "@tests/fixtures/builders/agent-template.builder"
import { AgentTemplateVersionsService } from "./agent-template-versions.service"
import type { StoredVersion } from "./agent-template-versions.service"
import { AgentTemplatesService } from "./agent-templates.service"
import type { PackageInput, PackageRequest } from "./agent-templates.contracts"
import { AgentTemplatesError, AgentTemplatesErrorCode } from "./errors/agent-templates.error"
import { agentTemplatePackageSchema } from "./agent-template.schema"
import { PARAMETERS } from "@tests/fixtures/builders/agent-template.builder"
import { AgentTemplateEntity } from "./persistence/entities"

const memberOf = builder<WorkspaceMember>({
    userId: CREATOR.accountId,
    workspaceId: CREATOR.workspaceId,
    role: "owner",
    staffId: null,
    displayName: "Linh",
    status: "active",
})

const documentOf = builder<PublicDocumentView>({
    id: "doc-1",
    title: "Gio mo cua",
    body: "draft text",
    draftRevision: 1,
    publishedBody: "Spa mo cua tu 9 gio den 21 gio moi ngay.",
    status: "published",
    kind: "written",
    question: null,
    gapId: null,
    sources: [],
    leftOut: [],
    needsReview: false,
    hasPendingChange: false,
    approvedByName: "Linh",
    approvedAt: null,
    failureCode: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
})

const REQUEST: PackageRequest = {
    workspaceId: CREATOR.workspaceId,
    agentId: CREATOR.agentId,
    graphVersionId: CREATOR.versionId,
    key: "spa-booking-by-linh",
    listing: draftOf().listing,
    parameters: PARAMETERS,
    bindings: draftOf().bindings,
    starterDocumentIds: ["doc-1"],
    persona: draftOf().persona,
    requiresPlugins: [],
    changelog: "First",
    breaking: false,
}

interface Options {
    readonly role?: "owner" | "manager"
    readonly existing?: Partial<AgentTemplateEntity> | null
    readonly stateless?: boolean
    readonly missingVersion?: boolean
    readonly documents?: ReadonlyArray<PublicDocumentView>
    readonly graph?: ReturnType<typeof leakyGraph>
    readonly installation?: boolean
}

const build = async (options: Options = {}) => {
    const graphs = mock<AgentGraphsService>({
        stateOfAgent: jest
            .fn()
            .mockResolvedValue(options.stateless === true ? null : stateOf({ installationId: "inst-1" })),
        versionAt:
            options.missingVersion === true
                ? jest.fn().mockRejectedValue(new Error("no such version"))
                : jest.fn().mockResolvedValue({ version: 2, document: options.graph ?? leakyGraph() }),
    })
    const installations = mock<InstallationRecordsService>({
        findById: jest
            .fn()
            .mockResolvedValue(options.installation === false ? null : { id: "inst-1", moduleKey: "accounting" }),
    })
    const members = mock<WorkspaceMembersService>({
        require: jest.fn().mockResolvedValue(memberOf({ role: options.role ?? "owner" })),
    })
    const documents = mock<PublicDocumentsService>({
        list: jest
            .fn()
            .mockResolvedValue(
                options.documents ?? [documentOf(), documentOf({ id: "doc-2", status: "draft", publishedBody: null })],
            ),
    })
    const stored = new Map<string, StoredVersion>()
    const versions = mock<AgentTemplateVersionsService>({
        templateOf: jest
            .fn()
            .mockResolvedValue(
                options.existing === undefined || options.existing === null
                    ? null
                    : Object.assign(new AgentTemplateEntity(), options.existing),
            ),
        latestNumber: jest.fn().mockResolvedValue(0),
        save: jest.fn().mockImplementation((input: Parameters<AgentTemplateVersionsService["save"]>[0]) => {
            stored.set(input.package.key, {
                key: input.package.key,
                version: input.package.version,
                package: input.package,
                hash: input.package.hash,
                changelog: "",
                breaking: false,
                creatorAccountId: CREATOR.accountId,
                firstParty: false,
            })
            return Promise.resolve({
                id: "row-1",
                key: input.package.key,
                version: input.package.version,
                hash: input.package.hash,
            })
        }),
        require: jest.fn().mockImplementation((key: string) => Promise.resolve(stored.get(key))),
        listOf: jest.fn().mockResolvedValue([{ id: "t", key: "spa-booking-by-linh", versions: [] }]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTemplatesService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: PublicDocumentsService, useValue: documents },
            { provide: AgentTemplateVersionsService, useValue: versions },
        ],
    }).compile()
    return { service: moduleRef.get(AgentTemplatesService), versions, members, stored }
}

const jsonOf = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch (cause) {
        return cause
    }
}

const INPUT: PackageInput = {
    agentId: CREATOR.agentId,
    graphVersionId: CREATOR.versionId,
    key: "spa-booking-by-linh",
    name: draftOf().listing.name,
    summary: draftOf().listing.summary,
    category: draftOf().listing.category,
    parameters: [
        {
            key: "shop",
            kind: "text",
            label: { vi: "Ten shop", en: "Shop name" },
            required: true,
            defaultValue: "Spa Linh",
        },
    ],
    bindings: [],
    starterDocumentIds: ["doc-1"],
    soul: "Than thien, ngan gon.",
    changelog: "First",
    breaking: false,
}

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof AgentTemplatesError ? cause.code : cause
    }
}

describe("AgentTemplatesService.preview", () => {
    it("shows what would be kept and what left out, from the frozen version, and writes nothing", async () => {
        const { service, versions } = await build()

        const preview = await service.preview(CREATOR.accountId, REQUEST)

        expect(preview.problems).toEqual([])
        expect(preview.report.brainRefs).toBeGreaterThan(0)
        expect(preview.package?.version).toBe(1)
        expect(preview.package?.starterKnowledge).toEqual([
            { title: "Gio mo cua", body: "Spa mo cua tu 9 gio den 21 gio moi ngay." },
        ])
        expect(preview.package?.publisher).toEqual({ creatorId: CREATOR.accountId, displayName: "Linh" })
        expect(versions.save).not.toHaveBeenCalled()
    })

    it("takes only published public documents the creator named, never an internal one, a draft or one left out", async () => {
        const { service } = await build()

        const preview = await service.preview(CREATOR.accountId, { ...REQUEST, starterDocumentIds: ["doc-2"] })

        expect(preview.package?.starterKnowledge).toEqual([])
    })

    it("is for the owner of the creator workspace alone", async () => {
        const { service, members } = await build()
        members.require.mockRejectedValueOnce(new Error("not an owner"))

        await expect(service.preview(CREATOR.accountId, REQUEST)).rejects.toThrow("not an owner")
        expect(members.require).toHaveBeenCalledWith(CREATOR.accountId, CREATOR.workspaceId, ["owner"])
    })

    it("refuses an agent without a graph, an installation that is gone, a version that is not the agent, and a key of another account", async () => {
        const stateless = await build({ stateless: true })
        const orphan = await build({ installation: false })
        const missing = await build({ missingVersion: true })
        const taken = await build({ existing: { creatorAccountId: "someone-else" } })

        expect(await codeOf(stateless.service.preview(CREATOR.accountId, REQUEST))).toBe(
            AgentTemplatesErrorCode.GraphVersionNotFound,
        )
        expect(await codeOf(orphan.service.preview(CREATOR.accountId, REQUEST))).toBe(
            AgentTemplatesErrorCode.GraphVersionNotFound,
        )
        expect(await codeOf(missing.service.preview(CREATOR.accountId, REQUEST))).toBe(
            AgentTemplatesErrorCode.GraphVersionNotFound,
        )
        expect(await codeOf(taken.service.preview(CREATOR.accountId, REQUEST))).toBe(AgentTemplatesErrorCode.KeyTaken)
    })
})

describe("AgentTemplatesService.packageVersion", () => {
    it("saves the next version of the template with the package the preview showed", async () => {
        const { service, versions } = await build()

        await service.packageVersion(CREATOR.accountId, REQUEST)

        const saved = versions.save.mock.calls[0]?.[0]
        expect(saved).toMatchObject({
            creatorAccountId: CREATOR.accountId,
            sourceWorkspaceId: CREATOR.workspaceId,
            changelog: "First",
            breaking: false,
        })
        expect(JSON.stringify(saved?.package)).not.toContain(SECRET_IN_ENV)
        expect(saved?.package.version).toBe(1)
    })

    it("refuses, writing nothing, a package whose preview has a problem", async () => {
        const dirty = leakyGraph()
        const graph = {
            ...dirty,
            nodes: dirty.nodes.map((node) => (node.key === "decide" ? { ...node, does: `Mail boss@shop.vn` } : node)),
        }
        const { service, versions } = await build({ graph })

        expect(await codeOf(service.packageVersion(CREATOR.accountId, REQUEST))).toBe(
            AgentTemplatesErrorCode.PackageRefused,
        )
        expect(versions.save).not.toHaveBeenCalled()
    })

    it("refuses a graph that holds branches of a template another account made, so a bought process is not resold", async () => {
        const base = leakyGraph()
        const graph = {
            ...base,
            nodes: base.nodes.map((node) =>
                node.key === "decide"
                    ? { ...node, sources: [{ kind: "template" as const, key: "bought-process", version: 2 }] }
                    : node,
            ),
        }
        const foreign = await build({ graph, existing: null })
        foreign.versions.templateOf.mockImplementation((key: string) =>
            Promise.resolve(
                key === "bought-process"
                    ? Object.assign(new AgentTemplateEntity(), { creatorAccountId: "someone-else" })
                    : null,
            ),
        )

        expect(await codeOf(foreign.service.packageVersion(CREATOR.accountId, REQUEST))).toBe(
            AgentTemplatesErrorCode.ForeignTemplate,
        )
        expect(foreign.versions.save).not.toHaveBeenCalled()
    })
})

describe("AgentTemplatesService.packageVersion template sources", () => {
    it("allows a graph whose branches come from a first-party package, so a derivative of a built-in can be packaged and listed", async () => {
        const base = leakyGraph()
        const graph = {
            ...base,
            nodes: base.nodes.map((node) =>
                node.key === "decide"
                    ? { ...node, sources: [{ kind: "template" as const, key: "nivo-accounting", version: 1 }] }
                    : node,
            ),
        }
        const derived = await build({ graph })
        derived.versions.templateOf.mockImplementation((key: string) =>
            Promise.resolve(
                key === "nivo-accounting"
                    ? Object.assign(new AgentTemplateEntity(), { creatorAccountId: "nivo", firstParty: true })
                    : null,
            ),
        )

        await expect(derived.service.packageVersion(CREATOR.accountId, REQUEST)).resolves.toBeDefined()
    })

    it("allows a graph whose template branches are of a template of the same account, or of the template itself", async () => {
        const base = leakyGraph()
        const graph = {
            ...base,
            nodes: base.nodes.map((node) =>
                node.key === "decide"
                    ? {
                          ...node,
                          sources: [
                              { kind: "template" as const, key: "my-older-template", version: 1 },
                              { kind: "template" as const, key: "spa-booking-by-linh", version: 1 },
                          ],
                      }
                    : node,
            ),
        }
        const own = await build({ graph })
        own.versions.templateOf.mockImplementation((key: string) =>
            Promise.resolve(
                key === "my-older-template"
                    ? Object.assign(new AgentTemplateEntity(), { creatorAccountId: CREATOR.accountId })
                    : null,
            ),
        )

        await expect(own.service.packageVersion(CREATOR.accountId, REQUEST)).resolves.toBeDefined()
    })
})

describe("AgentTemplatesService from the editor", () => {
    it("shows the preview the way the editor reads it, the default of a setting as text", async () => {
        const { service, versions } = await build()

        const view = await service.previewDraft(CREATOR.accountId, CREATOR.workspaceId, INPUT)

        expect(view.problems).toEqual([])
        expect(view.package?.parameters).toEqual([
            expect.objectContaining({ key: "shop", kind: "text", defaultValue: "Spa Linh", hint: null }),
        ])
        expect(versions.save).not.toHaveBeenCalled()
    })

    it("packages and saves what the creator typed in the editor for the workspace", async () => {
        const { service, versions } = await build()

        await service.packageDraft(CREATOR.accountId, CREATOR.workspaceId, INPUT)

        const saved = versions.save.mock.calls[0]?.[0]
        expect(saved).toMatchObject({ creatorAccountId: CREATOR.accountId, sourceWorkspaceId: CREATOR.workspaceId })
        expect(saved?.package.parameters.map((parameter) => parameter.key)).toEqual(["shop"])
    })
})

describe("AgentTemplatesService export and listing", () => {
    it("lists the templates of the caller", async () => {
        const { service, versions } = await build()

        await expect(service.mine(CREATOR.accountId)).resolves.toHaveLength(1)
        expect(versions.listOf).toHaveBeenCalledWith(CREATOR.accountId)
    })

    it("exports a file that reads back through the closed schema to the same package and hash", async () => {
        const { service } = await build()
        await service.packageVersion(CREATOR.accountId, REQUEST)

        const file = await service.exportFile(CREATOR.accountId, "spa-booking-by-linh", 1)

        const parsed = agentTemplatePackageSchema.parse(jsonOf(file))
        expect(parsed).toEqual(packageOf(leakyGraph(), draftOf()))
        expect(await service.exportFile(CREATOR.accountId, "spa-booking-by-linh", 1)).toBe(file)
    })

    it("refuses to export a template of another account", async () => {
        const { service } = await build()
        await service.packageVersion(CREATOR.accountId, REQUEST)

        expect(await codeOf(service.exportFile("someone-else", "spa-booking-by-linh", 1))).toBe(
            AgentTemplatesErrorCode.NotYours,
        )
    })
})
