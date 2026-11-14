import { AgentRunEntity, AgentRunStepEntity } from "../../../modules/domain/agent-runs/persistence/entities"
import { persistGraphTenant, type GraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { backendRoleSandbox, currentRole } from "../../world/backend-role-sandbox.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { doorCallsOf, useSeedConnection } from "../../world/sales-door-world.service"
import { useTestWorld } from "../../world/use-test-world"

/** The real app opens in about a minute on the world; the whole suite shares that one boot. */
jest.setTimeout(240_000)

const world = useTestWorld({ modules: API_APP_MODULES, sandbox: backendRoleSandbox() })
const seed = useSeedConnection(world)

const who: GraphTenant = { workspaceId: world.id(), userId: world.id(), agentId: world.id(), versionId: world.id() }
const door = doorCallsOf(world, who.workspaceId)
const RUN = world.id()
const STEP = world.id()
const SUBJECT = world.id()

/** A run the OLD engine parked on its failed step, about an accounting entry: the rows it wrote when a step failed (history rows). */
const parkedRun = async (): Promise<void> => {
    const at = new Date("2026-11-06T09:00:00.000Z")
    await seed.manager.save(AgentRunEntity, {
        id: RUN,
        workspaceId: who.workspaceId,
        engine: "legacy",
        agentId: who.agentId,
        wakeId: world.id(),
        trigger: "payment.settled",
        planning: false,
        status: "parked",
        context: { adapter: "bank", idempotencyKey: "k1" },
        resumeAttempts: 0,
        stepSeq: 1,
        startedAt: at,
        endedAt: at,
    })
    await seed.manager.save(AgentRunStepEntity, {
        id: STEP,
        workspaceId: who.workspaceId,
        runId: RUN,
        ordinal: 1,
        stepKey: "post",
        nodeKey: "accounting.post-payment",
        kind: "node",
        effect: { kind: "pivot" },
        input: { trigger: { subject: { kind: "accounting.entry", id: SUBJECT } } },
        status: "failed",
        attempt: 3,
        maxAttempts: 3,
        compAttempts: 0,
        deadlineMs: 30000,
        errorCode: "INVALID_STEP_INPUT",
        doorCalls: { calls: [] },
    })
}

beforeAll(async () => {
    await persistGraphTenant(seed.manager, who)
    world.cleanup(async () => {
        await removeWorkspace(seed.manager, who.workspaceId)
        await removeAuthUsers(seed.manager, [who.userId])
    })
    await parkedRun()
})

const statusOfRun = async (): Promise<unknown> => {
    const row = await seed.manager.findOneBy(AgentRunEntity, { workspaceId: who.workspaceId, id: RUN })
    return row?.status
}

describe("the platform module through the door, as the back-end role", () => {
    it("runs on a connection that is the back-end role, so the policies are the deployed ones", async () => {
        expect(await currentRole(world.db.primary)).toBe("app_be")
    })

    it("serves the platform module whole: the installation read answers beside the agent reads", async () => {
        expect(await door.read(who.userId, "platform.installation")).toHaveProperty("modules")
    })

    it("answers the connections and knowledge regions of the agent in the language of the request", async () => {
        const connections = await door.read(who.userId, "platform.agent-connections", { agent: who.agentId })
        expect(connections).toMatchObject({ rows: [] })
        expect(typeof connections["manageLabel"]).toBe("string")
        const knowledge = await door.read(who.userId, "platform.agent-knowledge", { agent: who.agentId })
        expect(knowledge).toMatchObject({ gaps: null })
        expect(typeof knowledge["publicTitle"]).toBe("string")
    })

    // Phase 3 (package D): the engine parks no run any more (a thread run that cannot go on stops for the founder), so the parked-runs
    // port answers an empty list and resumes nothing, even over an old-engine row left `parked` in the runs table.
    it("lists no parked run, whatever the runs table holds and however it is narrowed", async () => {
        expect(await door.read(who.userId, "platform.parked-runs")).toMatchObject({ count: null, rows: [] })
        expect(await door.read(who.userId, "platform.parked-runs", { module: "accounting" })).toMatchObject({ count: null })
        expect(await door.read(who.userId, "platform.parked-runs", { subjectId: SUBJECT })).toMatchObject({ count: null })
    })

    it("refuses to resume the old parked row as a run it does not know, and leaves the row as it is", async () => {
        expect(await door.act(who.userId, "platform.resume-run", { id: RUN })).toMatchObject({
            ok: false,
            reason: "refused",
            message: { key: "refusal_missing" },
        })
        expect(await statusOfRun()).toBe("parked")
    })
})
