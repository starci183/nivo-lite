import assert from "node:assert/strict"
import { TeamChatService } from "@modules/domain/team-chat"
import type { MemberRef, TeamChatResult } from "@modules/domain/team-chat"
import { persistTeamChat, teamChatIdentity } from "../../fixtures/builders/team-chat.builder"
import type { TeamChatIdentity } from "../../fixtures/builders/team-chat.builder"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { TeamChatProofModule } from "../../world/team-chat-proof.module"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: [TeamChatProofModule.register()] })

const seed = async (): Promise<TeamChatIdentity> => {
    const identity = teamChatIdentity(() => world.id())
    world.cleanup(async () => {
        await removeWorkspace(world.db.primary, identity.workspaceId)
        await removeWorkspace(world.db.primary, identity.foreignWorkspaceId)
        await removeAuthUsers(world.db.primary, [identity.ownerId, ...identity.staffIds, identity.outsiderId])
    })
    await persistTeamChat(world.db.primary, identity)
    return identity
}

const chat = (): TeamChatService => world.resolve(TeamChatService)
const user = (memberId: string): MemberRef => ({ memberKind: "user", memberId })

const valueOf = <V>(result: TeamChatResult<V>): V => {
    assert(result.ok, "expected a value, got a refusal")
    return result.value
}

interface SeatRow {
    readonly id: string
}

/** The seat id (workspace_members.id) of an account. */
const seatOf = async (workspaceId: string, userId: string): Promise<string> => {
    const rows: Array<SeatRow> = await world.db.primary.query(
        "SELECT id FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2",
        [workspaceId, userId],
    )
    return rows[0]?.id ?? ""
}

/** Writes a pending approval request that names the given seats as approvers. */
const openRequest = async (workspaceId: string, seatIds: ReadonlyArray<string>, agentId: string): Promise<string> => {
    const rows: Array<SeatRow> = await world.db.primary.query(
        `INSERT INTO public.approval_requests
             (workspace_id, chain_step_id, department, action, policy, approvers, timeout_minutes, expires_at, requested_by_agent_id)
         VALUES ($1, gen_random_uuid(), 'sales', 'refund', 'any', $2::jsonb, 30, now() + interval '30 minutes', $3)
         RETURNING id`,
        [
            workspaceId,
            JSON.stringify(seatIds.map((memberId) => ({ memberId, name: "x", role: "staff", roomId: null }))),
            agentId,
        ],
    )
    return rows[0]?.id ?? ""
}

describe("report cards", () => {
    it("writes one report per run in the direct room of the agent and the owner, opened on demand", async () => {
        const identity = await seed()
        const { workspaceId, agentId, ownerId } = identity
        const runId = world.id()
        expect(await chat().rooms(workspaceId, ownerId, "direct", agentId)).toEqual([])
        const first = await chat().postReport(workspaceId, { runId, agentId, body: "Done: 3 orders", roomId: null })
        assert(first !== null)
        expect(first.created).toBe(true)
        const again = await chat().postReport(workspaceId, { runId, agentId, body: "Done: 3 orders", roomId: null })
        expect(again).toEqual({ roomId: first.roomId, messageId: first.messageId, created: false })
        const rooms = await chat().rooms(workspaceId, ownerId, "direct", agentId)
        expect(rooms.map((room) => room.id)).toEqual([first.roomId])
        const thread = await chat().messages(workspaceId, ownerId, first.roomId, 10, null, false)
        expect(thread.nodes).toHaveLength(1)
        expect(thread.nodes[0]).toMatchObject({
            kind: "report",
            authorKind: "agent",
            authorId: agentId,
            authorName: "Bot",
            runId,
            body: "Done: 3 orders",
        })
        const other = await chat().postReport(workspaceId, { runId: world.id(), agentId, body: "Next", roomId: null })
        expect(other?.roomId).toBe(first.roomId)
    })

    it("reports to the room the agent is configured to report to, and reports nowhere for an agent that is gone", async () => {
        const identity = await seed()
        const { workspaceId, ownerId, agentId } = identity
        const made = valueOf(
            await chat().createRoom(workspaceId, ownerId, {
                kind: "group",
                name: "Reports",
                members: [user(identity.staffIds[0])],
            }),
        )
        const posted = await chat().postReport(workspaceId, { runId: world.id(), agentId, body: "x", roomId: made.id })
        expect(posted?.roomId).toBe(made.id)
        const fallback = await chat().postReport(workspaceId, {
            runId: world.id(),
            agentId,
            body: "x",
            roomId: world.id(),
        })
        expect(fallback?.roomId).not.toBe(made.id)
        expect(
            await chat().postReport(workspaceId, { runId: world.id(), agentId: world.id(), body: "x", roomId: null }),
        ).toBeNull()
        expect(await chat().postReport(world.id(), { runId: world.id(), agentId, body: "x", roomId: null })).toBeNull()
    })
})

describe("approval cards", () => {
    it("posts one card per decision per room and to the direct room of each approver, and every card shows the outcome", async () => {
        const identity = await seed()
        const { workspaceId, ownerId, agentId } = identity
        const [first, second] = identity.staffIds
        const room = valueOf(
            await chat().createRoom(workspaceId, ownerId, { kind: "group", name: "Approvers", members: [user(first)] }),
        )
        const firstSeat = await seatOf(workspaceId, first)
        const secondSeat = await seatOf(workspaceId, second)
        const decisionId = await openRequest(workspaceId, [firstSeat, secondSeat], agentId)
        const card = {
            decisionId,
            body: "Refund 200000 VND?",
            agentId,
            roomIds: [room.id, world.id()],
            approverSeatIds: [secondSeat],
        }
        expect(await chat().postApproval(workspaceId, card)).toBe(2)
        expect(await chat().postApproval(workspaceId, card)).toBe(2)
        const inRoom = await chat().messages(workspaceId, first, room.id, 10, null, false)
        expect(inRoom.nodes).toHaveLength(1)
        expect(inRoom.nodes[0]).toMatchObject({
            kind: "approval",
            decisionId,
            approval: { decisionId, status: "pending", canDecide: true, decidedByName: null, decidedAt: null },
        })
        const direct = await chat().rooms(workspaceId, second, "direct", agentId)
        expect(direct).toHaveLength(1)
        expect(direct[0]?.lastMessage?.approval?.canDecide).toBe(true)
        const staffOnly = await chat().messages(workspaceId, ownerId, room.id, 10, null, false)
        expect(staffOnly.nodes[0]?.approval?.canDecide).toBe(false)
        await world.db.primary.query(
            "UPDATE public.approval_requests SET status = 'rejected', resolved_at = now(), resolved_by = $2 WHERE id = $1",
            [decisionId, firstSeat],
        )
        const settled = await chat().messages(workspaceId, first, room.id, 10, null, false)
        expect(settled.nodes[0]?.approval).toMatchObject({
            status: "refused",
            canDecide: false,
            decidedByName: "Staff 1",
        })
        const settledDirect = await chat().rooms(workspaceId, second, "direct", agentId)
        expect(settledDirect[0]?.lastMessage?.approval?.status).toBe("refused")
    })

    it("posts a system card when no agent asked and opens no direct room for it", async () => {
        const identity = await seed()
        const { workspaceId, ownerId } = identity
        const room = valueOf(
            await chat().createRoom(workspaceId, ownerId, { kind: "group", name: "Approvers", members: [] }),
        )
        const decisionId = await openRequest(workspaceId, [], identity.agentId)
        const posted = await chat().postApproval(workspaceId, {
            decisionId,
            body: "Close the month?",
            agentId: null,
            roomIds: [room.id],
            approverSeatIds: [await seatOf(workspaceId, identity.staffIds[0])],
        })
        expect(posted).toBe(1)
        const thread = await chat().messages(workspaceId, ownerId, room.id, 10, null, false)
        expect(thread.nodes[0]).toMatchObject({ kind: "approval", authorKind: "system", authorId: null })
        expect(
            await chat().postApproval(workspaceId, {
                decisionId,
                body: "x",
                agentId: null,
                roomIds: [],
                approverSeatIds: [],
            }),
        ).toBe(0)
    })
})

describe("lines of an agent", () => {
    it("writes a line of an agent to a named room or to one person, once per key, and a system line without an agent", async () => {
        const identity = await seed()
        const { workspaceId, ownerId, agentId } = identity
        const [first] = identity.staffIds
        const room = valueOf(
            await chat().createRoom(workspaceId, ownerId, { kind: "group", name: "Sales", members: [user(first)] }),
        )
        const named = await chat().postMessage(workspaceId, {
            authorAgentId: agentId,
            roomId: room.id,
            toUserId: null,
            body: " Hi ",
            key: "k1",
        })
        assert(named !== null)
        const repeated = await chat().postMessage(workspaceId, {
            authorAgentId: agentId,
            roomId: room.id,
            toUserId: null,
            body: "Hi",
            key: "k1",
        })
        expect(repeated).toEqual(named)
        const toPerson = await chat().postMessage(workspaceId, {
            authorAgentId: agentId,
            roomId: null,
            toUserId: first,
            body: "Private",
            key: null,
        })
        assert(toPerson !== null)
        expect(toPerson.roomId).not.toBe(room.id)
        const system = await chat().postMessage(workspaceId, {
            authorAgentId: null,
            roomId: room.id,
            toUserId: null,
            body: "Month closed",
            key: null,
        })
        assert(system !== null)
        const thread = await chat().messages(workspaceId, first, room.id, 10, null, false)
        expect(thread.nodes.map((node) => [node.authorKind, node.kind, node.body])).toEqual([
            ["system", "system", "Month closed"],
            ["agent", "text", "Hi"],
        ])
        expect(
            await chat().postMessage(workspaceId, {
                authorAgentId: agentId,
                roomId: world.id(),
                toUserId: null,
                body: "x",
                key: null,
            }),
        ).toBeNull()
        expect(
            await chat().postMessage(workspaceId, {
                authorAgentId: null,
                roomId: null,
                toUserId: first,
                body: "x",
                key: null,
            }),
        ).toBeNull()
        expect(
            await chat().postMessage(workspaceId, {
                authorAgentId: agentId,
                roomId: room.id,
                toUserId: null,
                body: "   ",
                key: null,
            }),
        ).toBeNull()
    })
})

describe("postAsAgent", () => {
    it("opens the direct room on the write, by module key or by agent id, to the owner by default, once per key", async () => {
        const identity = await seed()
        const { workspaceId, ownerId, agentId } = identity
        expect(await chat().rooms(workspaceId, ownerId, "direct", agentId)).toEqual([])
        const byModule = await chat().postAsAgent(workspaceId, {
            agent: "chatbot",
            toUserId: null,
            body: "Hello",
            key: "k1",
        })
        assert(byModule !== null)
        expect(byModule.agentId).toBe(agentId)
        const again = await chat().postAsAgent(workspaceId, {
            agent: agentId,
            toUserId: ownerId,
            body: "Hello",
            key: "k1",
        })
        expect(again).toEqual(byModule)
        const rooms = await chat().rooms(workspaceId, ownerId, "direct", agentId)
        expect(rooms.map((room) => room.id)).toEqual([byModule.roomId])
        const thread = await chat().messages(workspaceId, ownerId, byModule.roomId, 10, null, false)
        expect(thread.nodes.map((node) => [node.authorKind, node.authorId, node.kind, node.body])).toEqual([
            ["agent", agentId, "text", "Hello"],
        ])
    })

    it("speaks to the person named and refuses an agent, a module or a person the workspace does not have", async () => {
        const identity = await seed()
        const { workspaceId, agentId } = identity
        const [first] = identity.staffIds
        const toStaff = await chat().postAsAgent(workspaceId, {
            agent: "chatbot",
            toUserId: first,
            body: "Hi",
            key: null,
        })
        assert(toStaff !== null)
        const owners = await chat().rooms(workspaceId, first, "direct", agentId)
        expect(owners.map((room) => room.id)).toEqual([toStaff.roomId])
        expect(
            await chat().postAsAgent(workspaceId, { agent: "sales", toUserId: null, body: "x", key: null }),
        ).toBeNull()
        expect(
            await chat().postAsAgent(workspaceId, { agent: world.id(), toUserId: null, body: "x", key: null }),
        ).toBeNull()
        expect(
            await chat().postAsAgent(workspaceId, {
                agent: "chatbot",
                toUserId: identity.outsiderId,
                body: "x",
                key: null,
            }),
        ).toBeNull()
        expect(
            await chat().postAsAgent(world.id(), { agent: "chatbot", toUserId: null, body: "x", key: null }),
        ).toBeNull()
    })
})
