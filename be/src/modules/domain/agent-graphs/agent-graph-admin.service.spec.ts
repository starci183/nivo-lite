import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphAdminService } from "./agent-graph-admin.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphPublishService } from "./agent-graph-publish.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphViewService } from "./agent-graph-view.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { OptionalGraphState } from "./agent-graphs.service"

const ACTOR = { workspaceId: "ws-1", principalId: "user-1" }
const VIEW = { agentId: "agent-1" }
const VERSION = { id: "version-2" }

const build = async (options: { role?: "owner" | "manager" | "staff" | null; state?: OptionalGraphState; installed?: boolean } = {}) => {
    const role = options.role === undefined ? "manager" : options.role
    const seats = mock<WorkspaceMemberSeatsService>({
        activeSeatOfUser: jest.fn().mockResolvedValue(role === null ? null : { memberId: "member-1", userId: "user-1", role, displayName: "An", status: "active" }),
    })
    const graphs = mock<AgentGraphsService>({
        stateOfAgent: jest.fn().mockResolvedValue(options.state === undefined ? stateOf() : options.state),
        versionsOf: jest.fn().mockResolvedValue([VERSION]),
        saveDraft: jest.fn().mockResolvedValue({ draftRev: 5 }),
    })
    const seed = mock<AgentGraphSeedService>({ ensureFor: jest.fn().mockResolvedValue(stateOf()) })
    const view = mock<AgentGraphViewService>({ viewOf: jest.fn().mockResolvedValue(VIEW) })
    const publishing = mock<AgentGraphPublishService>({
        publishDraft: jest.fn().mockResolvedValue(VERSION),
        restore: jest.fn().mockResolvedValue(VERSION),
        setMode: jest.fn().mockResolvedValue(stateOf()),
    })
    const proposals = mock<AgentGraphProposalsService>({ decline: jest.fn().mockResolvedValue(undefined) })
    const installations = mock<InstallationRecordsService>({
        ofAgent: jest.fn().mockResolvedValue(options.installed === false ? null : { id: "inst-1" }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphAdminService,
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphSeedService, useValue: seed },
            { provide: AgentGraphViewService, useValue: view },
            { provide: AgentGraphPublishService, useValue: publishing },
            { provide: AgentGraphProposalsService, useValue: proposals },
            { provide: InstallationRecordsService, useValue: installations },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphAdminService), graphs, seed, view, publishing, proposals }
}

describe("AgentGraphAdminService access", () => {
    it.each([["staff" as const], [null]])("refuses a seat that is %s, whatever the call", async (role) => {
        const { service } = await build({ role })

        await expect(service.open(ACTOR, "agent-1", "vi")).rejects.toEqual(expect.objectContaining({ code: AgentGraphsErrorCode.Forbidden }))
        await expect(service.versions(ACTOR, "agent-1")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.saveDraft(ACTOR, "agent-1", 1, "{}")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.publish(ACTOR, "agent-1", "")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.restore(ACTOR, "agent-1", "v")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.setMode(ACTOR, "agent-1", "shadow")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.decline(ACTOR, "agent-1", "p")).rejects.toBeInstanceOf(AgentGraphsError)
    })
})

describe("AgentGraphAdminService.open", () => {
    it("opens a graph that exists without seeding it", async () => {
        const { service, seed, view } = await build()

        await expect(service.open(ACTOR, "agent-1", "en")).resolves.toMatchObject({ agentId: "agent-1" })

        expect(seed.ensureFor).not.toHaveBeenCalled()
        expect(view.viewOf).toHaveBeenCalledWith("ws-1", "agent-1", "en")
    })

    it("seeds the graph of the installation on the first open", async () => {
        const { service, seed } = await build({ state: null })

        await service.open(ACTOR, "agent-1", "vi")

        expect(seed.ensureFor).toHaveBeenCalledWith("inst-1", "vi")
    })

    it("seeds nothing for an agent that has no installation", async () => {
        const { service, seed } = await build({ state: null, installed: false })

        await service.open(ACTOR, "agent-1", "vi")

        expect(seed.ensureFor).not.toHaveBeenCalled()
    })
})

describe("AgentGraphAdminService changes", () => {
    it("lists the versions and saves a draft read from JSON text, answering the new revision", async () => {
        const { service, graphs } = await build()

        await expect(service.versions(ACTOR, "agent-1")).resolves.toEqual([VERSION])
        await expect(service.saveDraft(ACTOR, "agent-1", 4, "{\"nodes\":[],\"rights\":[]}")).resolves.toBe(5)
        await expect(service.saveDraft(ACTOR, "agent-1", 4, "not json")).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.DocumentInvalid }),
        )

        expect(graphs.saveDraft.mock.calls).toEqual([["ws-1", "agent-1", 4, { nodes: [], rights: [] }]])
    })

    it("publishes and restores as the seat that asked, with the role it holds", async () => {
        const { service, publishing } = await build({ role: "owner" })

        await expect(service.publish(ACTOR, "agent-1", "Raised")).resolves.toBe(VERSION)
        await expect(service.restore(ACTOR, "agent-1", "version-1")).resolves.toBe(VERSION)

        expect(publishing.publishDraft).toHaveBeenCalledWith("ws-1", "agent-1", { memberId: "member-1", role: "owner" }, "Raised")
        expect(publishing.restore).toHaveBeenCalledWith("ws-1", "agent-1", "version-1", { memberId: "member-1", role: "owner" })
    })

    it("sets the mode and declines a proposal as the seat that asked", async () => {
        const { service, publishing, proposals } = await build()

        await service.setMode(ACTOR, "agent-1", "shadow")
        await service.decline(ACTOR, "agent-1", "p1")

        expect(publishing.setMode).toHaveBeenCalledWith("ws-1", "agent-1", "shadow", { memberId: "member-1", role: "manager" })
        expect(proposals.decline).toHaveBeenCalledWith("ws-1", "agent-1", "p1", "member-1")
    })
})
