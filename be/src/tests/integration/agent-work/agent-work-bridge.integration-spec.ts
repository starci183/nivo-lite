import assert from "node:assert/strict"
import { CLOCK } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { signBridgeToken } from "../../../modules/domain/agent-turns/bridge-credential.policy"
import { AgentTurnAccessService } from "../../../modules/domain/agent-turns/agent-turn-access.service"
import { AgentTurnsService } from "../../../modules/domain/agent-work/agent-turns.service"
import { AgentWakeService } from "../../../modules/domain/agent-work/agent-wake.service"
import type { AgentWake } from "../../../modules/domain/agent-work/agent-work.contracts"
import { agentWakeOf } from "../../fixtures/builders/agent-work.builder"
import { persistOfficeRows } from "../../fixtures/builders/office-chain.builder"
import type { OfficeIdentity } from "../../fixtures/builders/office-chain.builder"
import { AGENT_BRIDGE_MODULES, BRIDGE_PROOF_SECRET } from "../../world/agent-work-bridge.options"
import { removeDrainJobs, settleAgentWork } from "../../world/agent-work-database.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: AGENT_BRIDGE_MODULES })

const identity: OfficeIdentity = {
    workspaceId: world.id(),
    users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
    agents: { sales: world.id(), accounting: world.id(), care: world.id() },
}
const WS = identity.workspaceId
const AGENT = identity.agents.accounting
const OTHER_AGENT = identity.agents.care

const RUNTIME = "ws-0123abcd-accounting"
const OTHER_RUNTIME = "ws-0123abcd-care"

const em = () => world.db.primary

const nowSeconds = (): number => Math.floor(world.resolve<Clock>(CLOCK).now().getTime() / 1000)

const post = (wake: AgentWake) => em().transaction((tx) => world.resolve(AgentWakeService).wake(tx, wake))

const tagWake = (eventKey: string, agentId: string): AgentWake =>
    agentWakeOf({
        workspaceId: WS,
        agentId,
        source: "tag",
        eventKey: `${world.prefix}:${eventKey}`,
        context: { room: "sales", authorUserId: identity.users.nam },
        actorMemberId: null,
    })

/** The credential the plugin signs for a runtime agent and session, valid for the next half minute. */
const credentialOf = (runtimeAgentId: string, sessionKey: string, secret: string = BRIDGE_PROOF_SECRET): string =>
    signBridgeToken(secret, { agentId: runtimeAgentId, sessionKey, exp: nowSeconds() + 30 })

/** Begins the turn of a tag wake and records where it runs, the way the drain does before the model is asked. */
const runningTurn = async (eventKey: string, agentId: string, runtimeAgentId: string, sessionKey: string) => {
    await post(tagWake(eventKey, agentId))
    const turns = world.resolve(AgentTurnsService)
    const begin = await turns.begin(agentId, "agent", `worker-${eventKey}`)
    assert(begin.result === "begun")
    await turns.bind(begin.turn, runtimeAgentId, sessionKey)
    return begin.turn
}

beforeAll(async () => {
    world.cleanup(async () => {
        await removeDrainJobs(em(), WS)
        await removeWorkspace(em(), WS)
        await removeAuthUsers(em(), Object.values(identity.users))
    })
    await persistOfficeRows(em(), identity)
})

afterEach(() => settleAgentWork(em(), WS))

describe("agent-work/bridge-needs-turn: a call of the bridge plugin is for the turn that runs", () => {
    it("agent-work/bridge-needs-turn: refuses a call when no turn runs, and takes the context from the turn when one does", async () => {
        const access = world.resolve(AgentTurnAccessService)
        const session = `agent:${RUNTIME}:work`
        const credential = credentialOf(RUNTIME, session)

        await expect(access.admit(credential)).resolves.toBeNull()

        const turn = await runningTurn("bridge-one", AGENT, RUNTIME, session)

        await expect(access.admit(credential)).resolves.toEqual({
            jobId: turn.wakeId,
            workspaceId: WS,
            agentId: AGENT,
            turnId: turn.turnId,
            wakeId: turn.wakeId,
            source: "tag",
            conversationId: null,
            authorUserId: identity.users.nam,
        })

        await world
            .resolve(AgentTurnsService)
            .finish(turn, { status: "done", reason: null, outcome: null, errorCode: null, usage: null })
        await expect(access.admit(credential)).resolves.toBeNull()
    })

    it("agent-work/bridge-needs-turn: refuses a session that is another agent's, and a credential signed with another secret", async () => {
        const access = world.resolve(AgentTurnAccessService)
        const session = `agent:${RUNTIME}:work`
        await runningTurn("bridge-two", AGENT, RUNTIME, session)

        await expect(access.admit(credentialOf(RUNTIME, `agent:${RUNTIME}:another`))).resolves.toBeNull()
        await expect(access.admit(credentialOf(OTHER_RUNTIME, session))).resolves.toBeNull()
        await expect(access.admit(credentialOf(RUNTIME, session, "not-the-secret"))).resolves.toBeNull()
    })

    it("agent-work/bridge-needs-turn: two agents of one workspace each find only their own running turn", async () => {
        const access = world.resolve(AgentTurnAccessService)
        const mine = await runningTurn("bridge-three", AGENT, RUNTIME, `agent:${RUNTIME}:work`)
        const theirs = await runningTurn("bridge-four", OTHER_AGENT, OTHER_RUNTIME, `agent:${OTHER_RUNTIME}:work`)

        const first = await access.admit(credentialOf(RUNTIME, `agent:${RUNTIME}:work`))
        const second = await access.admit(credentialOf(OTHER_RUNTIME, `agent:${OTHER_RUNTIME}:work`))

        expect(first?.turnId).toBe(mine.turnId)
        expect(second?.turnId).toBe(theirs.turnId)
        expect(first?.agentId).toBe(AGENT)
        expect(second?.agentId).toBe(OTHER_AGENT)
    })
})
