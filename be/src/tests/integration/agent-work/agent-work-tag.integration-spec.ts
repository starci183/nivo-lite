import assert from "node:assert/strict"
import { OfficeLinesService } from "@modules/domain/messages"
import { OfficeTagService } from "@modules/domain/office-command-candidates"
import { AgentDrainService } from "../../../modules/domain/agent-work"
import type { AgentTurnView } from "../../../modules/domain/agent-work/agent-work.contracts"
import type { AgentHandlerEnding } from "../../../modules/domain/agent-work/agent-work.port"
import { persistOfficeRows } from "../../fixtures/builders/office-chain.builder"
import type { OfficeIdentity } from "../../fixtures/builders/office-chain.builder"
import { ScriptedAgentWork } from "../../world/agent-work-capabilities.options"
import {
    linesOfWorkspace,
    removeDrainJobs,
    settleAgentWork,
    turnsOfWake,
    wakeOfFact,
    wakesOfFact,
} from "../../world/agent-work-database.service"
import { AGENT_TAG_MODULES } from "../../world/agent-work-tag.options"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: AGENT_TAG_MODULES })

const identity: OfficeIdentity = {
    workspaceId: world.id(),
    users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
    agents: { sales: world.id(), accounting: world.id(), care: world.id() },
}
const WS = identity.workspaceId
const ACCOUNTING = identity.agents.accounting
const SALES = identity.agents.sales

const REPLY = "Five million is due this week."
const DONE: AgentHandlerEnding = { status: "done", reason: null, outcome: { replied: true } }

const em = () => world.db.primary
const work = () => world.resolve(ScriptedAgentWork)
const drain = () => world.resolve(AgentDrainService).drain({ workspaceId: WS, agentId: ACCOUNTING, scopeKey: "agent" })
const linesOfRoom = () => linesOfWorkspace(em(), WS)

/** What the real tag handler does in its settle: the agent says its reply in the room, once per wake. */
const sayReply = async (turn: Pick<AgentTurnView, "workspaceId" | "agentId" | "wakeCreatedAt">) => {
    await world.resolve(OfficeLinesService).post(
        { workspaceId: turn.workspaceId },
        {
            body: REPLY,
            lead_id: null,
            work_item_id: null,
            agent_id: turn.agentId,
            unlessSaidSince: turn.wakeCreatedAt,
        },
    )
    return DONE
}

beforeAll(async () => {
    world.cleanup(async () => {
        await removeDrainJobs(em(), WS)
        await removeWorkspace(em(), WS)
        await removeAuthUsers(em(), Object.values(identity.users))
    })
    await persistOfficeRows(em(), identity)
})

beforeEach(() => {
    work().reset()
    work().script = { settle: sayReply }
})

afterEach(() => settleAgentWork(em(), WS))

describe("agent-work/tag: a line that tags an agent", () => {
    it("agent-work/tag-to-reply: a member's line ends as the agent's line in the room, with one turn and one wake", async () => {
        const posted = await world
            .resolve(OfficeTagService)
            .post(identity.users.van, WS, { body: "@accounting-proof how much is due?", room: null, locale: "en" })

        const wake = await wakeOfFact(em(), ACCOUNTING, "tag", posted.id)
        assert.equal(wake.status, "pending")
        await drain()
        await drain()

        const ended = await wakeOfFact(em(), ACCOUNTING, "tag", posted.id)
        expect(ended.status).toBe("done")
        expect(await wakesOfFact(em(), ACCOUNTING, posted.id)).toBe(1)
        expect(await turnsOfWake(em(), wake.id)).toHaveLength(1)
        expect(work().ran).toEqual([wake.id])
        const replies = (await linesOfRoom()).filter((line) => line.agentId === ACCOUNTING)
        expect(replies.map((line) => [line.authorKind, line.body])).toEqual([["agent", REPLY]])
    })

    it("agent-work/tag-to-reply: the reply is posted once when the settle is retried", async () => {
        const posted = await world
            .resolve(OfficeTagService)
            .post(identity.users.van, WS, { body: "@accounting-proof and the second one?", room: null, locale: "en" })
        const wake = await wakeOfFact(em(), ACCOUNTING, "tag", posted.id)

        await sayReply({ workspaceId: WS, agentId: ACCOUNTING, wakeCreatedAt: wake.createdAt })
        await sayReply({ workspaceId: WS, agentId: ACCOUNTING, wakeCreatedAt: wake.createdAt })

        const replies = (await linesOfRoom()).filter((line) => line.agentId === ACCOUNTING && line.body === REPLY)
        expect(replies.length).toBe(1)
    })

    it("agent-work/tag-to-reply: a staff member without the right gets one NIVO line and writes no wake", async () => {
        const posted = await world
            .resolve(OfficeTagService)
            .post(identity.users.lan, WS, { body: "@accounting-proof please book this", room: null, locale: "en" })

        expect(await wakesOfFact(em(), ACCOUNTING, posted.id)).toBe(0)
        const notes = (await linesOfRoom()).filter(
            (line) => line.authorKind === "system" && line.createdAt >= new Date(posted.created_at),
        )
        expect(notes).toHaveLength(1)
        expect(notes[0]?.agentId).toBeNull()
        expect(work().ran).toEqual([])
    })

    it("agent-work/agent-line-no-wake: an agent's line that names a handle writes no wake", async () => {
        await world.resolve(OfficeLinesService).post(
            { workspaceId: WS },
            {
                body: "@sales-proof please look at the invoice",
                lead_id: null,
                work_item_id: null,
                agent_id: ACCOUNTING,
            },
        )

        const woken = await world
            .resolve(AgentDrainService)
            .drain({ workspaceId: WS, agentId: SALES, scopeKey: "agent" })
        expect(woken).toBeUndefined()
        expect(work().ran).toEqual([])
    })
})
