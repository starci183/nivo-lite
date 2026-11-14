import { EntityEngineService } from "@modules/domain/entity-engine"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import { AgentGraphProposalsService } from "../../../modules/domain/agent-graphs/agent-graph-proposals.service"
import { AgentGraphRecordsService } from "../../../modules/domain/agent-graphs/agent-graph-records.service"
import { OWNER_EXAMPLE, graphOf } from "../../fixtures/builders/agent-graph.builder"
import { persistGraph, persistGraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import { AGENT_GRAPH_STORE_MODULES } from "../../world/agent-graph-decider-capabilities.options"
import {
    AgentGraphEntity,
    AgentGraphProposalEntity,
    AgentGraphVersionEntity,
} from "../../../modules/domain/agent-graphs/persistence/entities"
import { withBackendTransaction } from "../../world/entity-engine-scope-proof.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: AGENT_GRAPH_STORE_MODULES })

const tenant = { workspaceId: world.id(), userId: world.id(), agentId: world.id(), versionId: world.id() }
const stranger = world.id()
const graphs = () => world.resolve(AgentGraphsService)

const TABLES = {
    graph: AgentGraphEntity,
    version: AgentGraphVersionEntity,
    proposal: AgentGraphProposalEntity,
} as const

/** The record ids of the graph of the tenant, read in its own scope. */
const idsOf = () =>
    world.resolve(EntityEngineService).scoped(tenant.workspaceId, async (scoped) => {
        const records = world.resolve(AgentGraphRecordsService)
        const graph = await records.graphOf(scoped, tenant.agentId)
        const [proposal] = await records.openProposalsOf(scoped, tenant.agentId, 5)
        return { graph: graph?.id, version: tenant.versionId, proposal: proposal?.id }
    })

beforeAll(async () => {
    world.cleanup(async () => {
        await removeWorkspace(world.db.primary, tenant.workspaceId)
        await removeAuthUsers(world.db.primary, [tenant.userId])
    })
    await persistGraphTenant(world.db.primary, tenant)
    await persistGraph(world.db.primary, tenant, graphOf(OWNER_EXAMPLE), "enforced")
})

describe("agent-graph/isolation: the graph of an agent belongs to its workspace", () => {
    it("agent-graph/isolation: another workspace's scope cannot see, change or delete the graph, a version or a proposal, and the owner's scope sees them all", async () => {
        await world.resolve(AgentGraphProposalsService).raiseGap({
            workspaceId: tenant.workspaceId,
            agentId: tenant.agentId,
            versionId: tenant.versionId,
            trigger: "customer_message",
            question: "Do you ship to Hue?",
            topic: "Shipping",
        })
        const ids = await idsOf()
        const held = [
            [TABLES.graph, ids.graph],
            [TABLES.version, ids.version],
            [TABLES.proposal, ids.proposal],
        ] as const

        await withBackendTransaction(world, async (probe) => {
            await probe.enter(stranger)
            await eachInOrder(held, async ([table, id]) => {
                expect(id).toEqual(expect.any(String))
                expect(await probe.manager.findOneBy(table, { id: id ?? "" })).toBeNull()
                expect((await probe.manager.update(table, { id: id ?? "" }, { workspaceId: tenant.workspaceId })).affected).toBe(0)
                expect((await probe.manager.delete(table, { id: id ?? "" })).affected).toBe(0)
            })
        })

        await withBackendTransaction(world, async (probe) => {
            await probe.enter(tenant.workspaceId)
            await eachInOrder(held, async ([table, id]) => {
                expect(await probe.manager.findOneBy(table, { id: id ?? "" })).not.toBeNull()
            })
        })
    })

    it("agent-graph/isolation: the store answers no graph or version for a workspace that does not own them", async () => {
        const mine = await graphs().stateOfAgent(tenant.workspaceId, tenant.agentId)

        expect(mine).toMatchObject({ agentId: tenant.agentId, mode: "enforced", activeVersionId: tenant.versionId })
        await expect(graphs().stateOfAgent(stranger, tenant.agentId)).resolves.toBeNull()
        await expect(graphs().stateOfInstallation(stranger, mine?.installationId ?? "")).resolves.toBeNull()
        await expect(graphs().versionsOf(stranger, tenant.agentId)).resolves.toEqual([])
        await expect(graphs().documentOf(stranger, tenant.agentId, tenant.versionId)).rejects.toMatchObject({
            code: "AGENT_GRAPHS_VERSION_NOT_FOUND",
        })
        await expect(graphs().missingGraph(stranger, [tenant.agentId])).resolves.toEqual([tenant.agentId])
    })
})

describe("agent-graph/store: the draft, the versions and the seed on the core tables", () => {
    it("agent-graph/store: a publish freezes the next version, makes it decide and indexes its Brain sources; a stale draft is refused", async () => {
        const factId = world.id()
        const base = graphOf(OWNER_EXAMPLE)
        const cited = {
            ...base,
            nodes: base.nodes.map((node) =>
                node.key === "decide"
                    ? {
                          ...node,
                          sources: [{ kind: "brain" as const, factId, passage: "Over 5tr ask Dinh", valueHash: "h" }],
                      }
                    : node,
            ),
        }

        const published = await graphs().publish({
            workspaceId: tenant.workspaceId,
            agentId: tenant.agentId,
            document: cited,
            kind: "edit",
            note: "cites a rule",
            memberId: null,
            contextVersionId: null,
        })
        const state = await graphs().stateOfAgent(tenant.workspaceId, tenant.agentId)

        expect(published).toMatchObject({ version: 2, changeKind: "edit" })
        expect(state).toMatchObject({ activeVersionId: published.id, draftRev: 2 })
        await expect(graphs().latestVersionOf(tenant.workspaceId, tenant.agentId)).resolves.toBe(2)
        await expect(graphs().versionsOf(tenant.workspaceId, tenant.agentId)).resolves.toHaveLength(2)
        await expect(graphs().brainSourcesInForce(tenant.workspaceId, 50)).resolves.toEqual([
            expect.objectContaining({ agentId: tenant.agentId, versionId: published.id, factId, valueHash: "h" }),
        ])
        await expect(graphs().saveDraft(tenant.workspaceId, tenant.agentId, 1, cited)).rejects.toMatchObject({
            code: "AGENT_GRAPHS_DRAFT_CONFLICT",
        })
        await expect(graphs().saveDraft(tenant.workspaceId, tenant.agentId, 2, cited)).resolves.toMatchObject({
            draftRev: 3,
        })
        await expect(graphs().setMode(tenant.workspaceId, tenant.agentId, "shadow", world.id())).resolves.toMatchObject(
            { mode: "shadow" },
        )
    })

    it("agent-graph/store: an agent with no graph is given its seed once, and the second call changes nothing", async () => {
        const agentId = world.id()
        const installationId = world.id()
        const seed = graphOf(OWNER_EXAMPLE)

        const first = await graphs().ensure(tenant.workspaceId, agentId, installationId, seed)
        const second = await graphs().ensure(tenant.workspaceId, agentId, installationId, seed)

        expect(first).toMatchObject({ mode: "enforced", activeKind: "seed", draftRev: 1 })
        expect(second.activeVersionId).toBe(first.activeVersionId)
        await expect(graphs().latestVersionOf(tenant.workspaceId, agentId)).resolves.toBe(1)
        await expect(graphs().missingGraph(tenant.workspaceId, [agentId, world.id()])).resolves.toHaveLength(1)
    })
})
