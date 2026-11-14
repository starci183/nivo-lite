import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    AgentGraphPublishService,
    AgentGraphSeedService,
    AgentGraphsError,
    AgentGraphsService,
    AgentWorkflowsService,
} from "@modules/domain/agent-graphs"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import type { ContextVersionRecord } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentInstancesLogEvent } from "./agent-instances.log-events"

/** The code the graph checks give a widening someone who is not the owner tried. */
const WIDENS_NEEDS_OWNER = "AGENT_GRAPHS_WIDENS_NEEDS_OWNER"
import { AgentKnowledgeCopyService } from "./agent-knowledge-copy.service"
import { AgentSetupCopyService } from "./agent-setup-copy.service"

const SOURCE: InstallationRecord = {
    id: "inst-lan",
    workspaceId: "w1",
    moduleKey: "sales",
    name: "Sales Lan",
    isMulti: true,
    agentId: "agent-lan",
    status: "ready",
    operatingMode: "autopilot",
    liveEnabled: true,
    activeContextVersionId: "ver-lan-3",
    settings: { processor: "nivo", holdingMessage: "Wait a moment" },
    createdAt: "2026-11-01T00:00:00.000Z",
}

const KNOWLEDGE = { knowledgeFacts: 2, knowledgeDocuments: 1, knowledgeWaiting: 1, knowledgeSkipped: 0 }
const TARGET = { installationId: "inst-minh", agentId: "agent-minh" }
const BY = { userId: "u-owner", memberId: "m-owner", role: "owner" as const }
const DOCUMENT = { nodes: [] }

const VERSION: ContextVersionRecord = {
    id: "ver-lan-3",
    installationId: "inst-lan",
    version: 3,
    snapshot: { summary: "A flower shop", facts: [], gates: {} },
    appliedBy: "Owner",
    appliedAt: "2026-11-02T00:00:00.000Z",
}

/** The graph state of an agent, as the graphs service answers it. */
type GraphState = NonNullable<Awaited<ReturnType<AgentGraphsService["stateOfAgent"]>>>

const stateOf = (overrides: Partial<GraphState> = {}): GraphState =>
    ({
        workspaceId: "w1",
        agentId: "agent-lan",
        installationId: "inst-lan",
        mode: "enforced",
        draft: DOCUMENT,
        draftRev: 1,
        activeVersionId: "gv-1",
        active: DOCUMENT,
        activeKind: "edit",
        ...overrides,
    }) satisfies GraphState

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    installations.saveSettings.mockResolvedValue("done")
    installations.activateVersion.mockResolvedValue("done")
    const versions = mock<ContextVersionsService>()
    versions.find.mockResolvedValue(VERSION)
    versions.insert.mockResolvedValue({ ...VERSION, id: "ver-minh-1", installationId: "inst-minh", version: 1 })
    const graphs = mock<AgentGraphsService>()
    graphs.stateOfAgent.mockResolvedValue(stateOf())
    const seed = mock<AgentGraphSeedService>()
    seed.ensureFor.mockResolvedValue(stateOf({ agentId: "agent-minh", activeKind: "seed" }))
    const publish = mock<AgentGraphPublishService>()
    const grants = mock<ConnectionGrantsService>()
    grants.candidatesOf.mockResolvedValue([
        {
            id: "db1",
            name: "Sheet",
            provider: "database",
            botUsername: null,
            accountMasked: null,
            status: "connected",
            purpose: "data_source",
            bound: true,
        },
        {
            id: "tg1",
            name: "Shop bot",
            provider: "telegram",
            botUsername: "shop_bot",
            accountMasked: null,
            status: "connected",
            purpose: "outbound_chat",
            bound: true,
        },
    ])
    const logger = mock<Logger>()
    const workflows = mock<AgentWorkflowsService>()
    workflows.copyWorkflows.mockResolvedValue(2)
    const knowledge = mock<AgentKnowledgeCopyService>()
    knowledge.copy.mockResolvedValue(KNOWLEDGE)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentSetupCopyService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ContextVersionsService, useValue: versions },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphSeedService, useValue: seed },
            { provide: AgentGraphPublishService, useValue: publish },
            { provide: ConnectionGrantsService, useValue: grants },
            { provide: LOGGER, useValue: logger },
            { provide: AgentWorkflowsService, useValue: workflows },
            { provide: AgentKnowledgeCopyService, useValue: knowledge },
        ],
    }).compile()
    return {
        service: moduleRef.get(AgentSetupCopyService),
        installations,
        versions,
        graphs,
        seed,
        publish,
        grants,
        logger,
        workflows,
        knowledge,
    }
}

describe("AgentSetupCopyService", () => {
    it("copies the settings, the setup version, the graph and the shared connections", async () => {
        const { service, installations, versions, seed, publish } = await build()

        const outcome = await service.copy(SOURCE, TARGET, BY, "vi")

        expect(outcome).toEqual({
            copied: {
                fromInstallationId: "inst-lan",
                settings: true,
                contextVersion: true,
                graph: "copied",
                ...KNOWLEDGE,
            },
            grants: [{ connectionId: "db1" }],
        })
        expect(installations.saveSettings).toHaveBeenCalledWith("w1", "inst-minh", SOURCE.settings)
        expect(versions.insert).toHaveBeenCalledWith({
            workspaceId: "w1",
            installationId: "inst-minh",
            version: 1,
            snapshot: VERSION.snapshot,
            appliedBy: "Owner",
        })
        expect(installations.activateVersion).toHaveBeenCalledWith("w1", "inst-minh", "ver-minh-1", "ready")
        expect(seed.ensureFor).toHaveBeenCalledWith("inst-minh", "vi")
        // The target was made in the same call: what its flow asks beyond what is agreed waits, it never refuses the copy.
        expect(publish.publishCopy).toHaveBeenCalledWith("w1", "agent-minh", DOCUMENT, BY, [], "wait")
    })

    it("copies every workflow of the sibling after its graph, as the member who copies", async () => {
        const { service, workflows } = await build()

        await service.copy(SOURCE, TARGET, BY, "vi")

        expect(workflows.copyWorkflows).toHaveBeenCalledWith(
            "w1",
            { fromInstallationId: "inst-lan", toInstallationId: "inst-minh" },
            { kind: "owner", memberId: BY.memberId },
        )
    })

    it("copies the knowledge kept for the sibling alone onto the new agent's installation, by the same member", async () => {
        const { service, knowledge } = await build()

        await service.copy(SOURCE, TARGET, BY, "vi")

        expect(knowledge.copy).toHaveBeenCalledWith(SOURCE, "inst-minh", BY)
    })

    it("copies that knowledge even from a sibling that has no agent", async () => {
        const { service, knowledge } = await build()

        await service.copy({ ...SOURCE, agentId: null }, TARGET, BY, "vi")

        expect(knowledge.copy).toHaveBeenCalledWith({ ...SOURCE, agentId: null }, "inst-minh", BY)
    })

    it("never copies a channel the sibling answers", async () => {
        const { service } = await build()

        const outcome = await service.copy(SOURCE, TARGET, BY, "vi")

        expect(outcome.grants.map((grant) => grant.connectionId)).not.toContain("tg1")
    })
})

describe("AgentSetupCopyService, refusals and nothing to copy", () => {
    it("keeps the seed graph, copies no workflow and logs when the checks refuse the copied graph", async () => {
        const { service, publish, logger, workflows } = await build()
        publish.publishCopy.mockRejectedValue(
            Object.assign(Object.create(AgentGraphsError.prototype), { code: WIDENS_NEEDS_OWNER }),
        )

        const outcome = await service.copy(
            SOURCE,
            TARGET,
            { userId: "u-mgr", memberId: "m-mgr", role: "manager" },
            "vi",
        )

        expect(outcome.copied.graph).toBe("refused")
        expect(workflows.copyWorkflows).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(AgentInstancesLogEvent.GraphCopyRefused, {
            workspaceId: "w1",
            agentId: "agent-minh",
            code: WIDENS_NEEDS_OWNER,
        })
    })

    it("lets any other failure of the graph publish through", async () => {
        const { service, publish } = await build()
        const failure = new Error("database down")
        publish.publishCopy.mockRejectedValue(failure)

        await expect(service.copy(SOURCE, TARGET, BY, "vi")).rejects.toBe(failure)
    })

    it("copies no graph from a sibling still on its seed, and no version before the sibling applied one", async () => {
        const { service, graphs, versions, seed, publish } = await build()
        graphs.stateOfAgent.mockResolvedValue(stateOf({ activeKind: "seed" }))

        const outcome = await service.copy({ ...SOURCE, activeContextVersionId: null }, TARGET, BY, "en")

        expect(outcome.copied).toMatchObject({ contextVersion: false, graph: "none" })
        expect(versions.find).not.toHaveBeenCalled()
        expect(seed.ensureFor).not.toHaveBeenCalled()
        expect(publish.publishCopy).not.toHaveBeenCalled()
    })

    it("copies only the settings and the version of a sibling that has no agent", async () => {
        const { service, grants } = await build()

        const outcome = await service.copy({ ...SOURCE, agentId: null }, TARGET, BY, "vi")

        expect(outcome).toEqual({
            copied: {
                fromInstallationId: "inst-lan",
                settings: true,
                contextVersion: true,
                graph: "none",
                ...KNOWLEDGE,
            },
            grants: [],
        })
        expect(grants.candidatesOf).not.toHaveBeenCalled()
    })
})
