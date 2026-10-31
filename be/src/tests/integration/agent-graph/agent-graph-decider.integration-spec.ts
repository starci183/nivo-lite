import { WORK_BRANCH_DECIDER, evaluateGate } from "@modules/domain/authority-rules"
import type { AuthorityRule, BranchRequest, WorkBranchDecider } from "@modules/domain/authority-rules"
import type { GraphDocument } from "@modules/domain/agent-graphs"
import type { WorkItem } from "@modules/domain/decisions"
import { AMOUNT_FACT, OWNER_EXAMPLE, graphOf } from "../../fixtures/builders/agent-graph.builder"
import {
    persistGraph,
    persistGraphTenant,
    persistPaymentItem,
    restartGraph,
} from "../../fixtures/builders/agent-graph-world.builder"
import { ruleOf } from "../../fixtures/builders/authority-rules.builder"
import { itemOf } from "../../fixtures/builders/reconcile-payment-performer.builder"
import { AGENT_GRAPH_DECIDER_MODULES, BooksReader } from "../../world/agent-graph-decider-capabilities.options"
import { decisionsOf } from "../../world/agent-graph-database.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: AGENT_GRAPH_DECIDER_MODULES })

const tenant = { workspaceId: world.id(), userId: world.id(), agentId: world.id(), versionId: world.id() }
const ACTION = "confirm_supplier_payment"
const RULE: AuthorityRule = ruleOf({
    department: "accounting",
    action: ACTION,
    mode: "auto",
    limit_vnd: 20_000_000,
    required_fields: [],
})

/** The graph with its decide point on the action of the proof. */
const forAction = (document: GraphDocument): GraphDocument => ({
    ...document,
    nodes: document.nodes.map((node) =>
        node.decide === undefined ? node : { ...node, decide: { ...node.decide, intent: ACTION } },
    ),
})

/** The request the engine makes of the decider for an item the model priced at `modelVnd`, with the owner rule as the gate. */
const requestFor = (item: WorkItem, modelVnd: number): BranchRequest => ({
    workspaceId: tenant.workspaceId,
    item,
    proposal: { summary: "Supplier payment", amount_vnd: modelVnd, fields: {} },
    gate: (judged) => Promise.resolve(evaluateGate({ action: ACTION, rule: RULE, maxMode: null, proposal: judged })),
    turnId: null,
    wakeId: null,
})

/** A work item about a payment record, which the books hold at that amount unless it is left out. */
const itemAbout = (vnd: number | null): Promise<WorkItem> => {
    const record = world.id()
    if (vnd !== null) world.resolve(BooksReader).amounts.set(record, vnd)
    return persistPaymentItem(world.db.primary, tenant, ACTION, record, `${world.prefix}:${record}`)
}

const decide = (item: WorkItem, modelVnd: number) =>
    world.resolve<WorkBranchDecider>(WORK_BRANCH_DECIDER).decide(requestFor(item, modelVnd))
const decisionsFor = (item: WorkItem) => decisionsOf(world.db.primary, tenant.agentId, item.id)

beforeAll(async () => {
    world.cleanup(async () => {
        await removeWorkspace(world.db.primary, tenant.workspaceId)
        await removeAuthUsers(world.db.primary, [tenant.userId])
    })
    await persistGraphTenant(world.db.primary, tenant)
    await persistGraph(world.db.primary, tenant, forAction(graphOf(OWNER_EXAMPLE)), "enforced")
})

describe("agent-graph/decider: the branch of an enforced graph", () => {
    beforeEach(() => restartGraph(world.db.primary, tenant.agentId, "enforced"))

    it("agent-graph/model-amount-ignored: the amount of the record decides, not the one the model wrote", async () => {
        const item = await itemAbout(25_000_000)

        const judgement = await decide(item, 1_000_000)

        expect(judgement?.verdict.verdict).toBe("ask")
        expect(judgement?.proposal?.amount_vnd).toBe(25_000_000)
        await expect(decisionsFor(item)).resolves.toMatchObject([
            { branchKey: "else", outcome: "ask", facts: { [AMOUNT_FACT]: 25_000_000 } },
        ])
    })

    it("agent-graph/boundary-exact: exactly five million is the asked band, and the stricter of the gate and the branch wins", async () => {
        const item = await itemAbout(5_000_000)

        const judgement = await decide(item, 1_000_000)

        expect(judgement?.verdict).toMatchObject({ verdict: "ask", reason: "branch_ask" })
        await expect(decisionsFor(item)).resolves.toEqual([
            expect.objectContaining({ branchKey: "middle", outcome: "ask" }),
        ])
    })

    it("agent-graph/under-bound-runs: a record just under five million runs alone when the gate agrees", async () => {
        const item = await itemAbout(4_999_999)

        const judgement = await decide(item, 1_000_000)

        expect(judgement?.verdict.verdict).toBe("auto")
        await expect(decisionsFor(item)).resolves.toEqual([
            expect.objectContaining({ branchKey: "small", outcome: "auto", shadowDiff: false }),
        ])
    })

    it("agent-graph/unread-fact-asks: a payment the books cannot read is asked about, never run alone on a guess", async () => {
        const item = await itemAbout(null)

        const judgement = await decide(item, 1_000_000)

        expect(judgement?.verdict).toMatchObject({ verdict: "ask", reason: "branch_ask" })
        await expect(decisionsFor(item)).resolves.toEqual([expect.objectContaining({ branchKey: "else", facts: {} })])
    })

    it("agent-graph/decision-once: the same item judged twice leaves one decision", async () => {
        const item = await itemAbout(7_200_000)

        await decide(item, 1_000_000)
        await decide(item, 1_000_000)

        await expect(decisionsFor(item)).resolves.toHaveLength(1)
    })
})

describe("agent-graph/decider: a graph that only records", () => {
    it("agent-graph/shadow-no-effect: the gate decides alone, and the difference the graph would have made is kept", async () => {
        await restartGraph(world.db.primary, tenant.agentId, "shadow")
        const item = await itemAbout(25_000_000)

        const judgement = await decide(item, 1_000_000)

        expect(judgement).toBeNull()
        await expect(decisionsFor(item)).resolves.toEqual([
            expect.objectContaining({ branchKey: "else", shadowDiff: true }),
        ])
    })

    it("agent-graph/no-graph-no-effect: an item of an installation with no graph is left to the gate", async () => {
        const item = itemOf({
            id: world.id(),
            workspace_id: tenant.workspaceId,
            action: ACTION,
            installation_id: world.id(),
        })

        await expect(decide(item, 1_000_000)).resolves.toBeNull()
    })
})
