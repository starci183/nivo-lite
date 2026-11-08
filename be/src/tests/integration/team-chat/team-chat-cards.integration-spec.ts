import assert from "node:assert/strict"
import { TeamChatRoomsService, type ChatMemberRef, type TeamChatResult } from "@modules/domain/team-chat"
import { eachInOrder } from "@modules/platform/primitives"
import {
    openApprovalRequest,
    persistTeamChat,
    teamChatIdentity,
    type TeamChatIdentity,
} from "../../fixtures/builders/team-chat.builder"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { TEAM_CHAT_PROOF_MODULES } from "../../world/team-chat-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: TEAM_CHAT_PROOF_MODULES })

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

const chat = (): TeamChatRoomsService => world.resolve(TeamChatRoomsService)
const user = (memberId: string): ChatMemberRef => ({ memberKind: "user", memberId })

const valueOf = <V>(result: TeamChatResult<V>): V => {
    assert(result.ok, "expected a value, got a refusal")
    return result.value
}

describe("the approval card of an ask", () => {
    it("counts the rooms that hold the card of a decision: none before the hook posts, one per room after, the same on a repeat", async () => {
        const identity = await seed()
        const { workspaceId, agentId, ownerId } = identity
        const [first, second] = identity.staffIds
        const rooms = [
            valueOf(
                await chat().createRoom(workspaceId, ownerId, { kind: "group", name: "A", members: [user(first)] }),
            ),
            valueOf(
                await chat().createRoom(workspaceId, ownerId, { kind: "group", name: "B", members: [user(second)] }),
            ),
        ]
        const decisionId = await openApprovalRequest(world.db.primary, {
            id: world.id(),
            chainStepId: world.id(),
            workspaceId,
            seatIds: [],
            agentId,
            department: "sales",
        })

        expect(await chat().cardRooms(workspaceId, decisionId)).toBe(0)

        const card = {
            decisionId,
            body: "Refund?",
            agentId,
            roomIds: rooms.map((room) => room.id),
            approverSeatIds: [],
        }
        expect(await chat().postApproval(workspaceId, card)).toBe(2)
        expect(await chat().cardRooms(workspaceId, decisionId)).toBe(2)
        await chat().postApproval(workspaceId, card)
        expect(await chat().cardRooms(workspaceId, decisionId)).toBe(2)
        expect(await chat().cardRooms(identity.foreignWorkspaceId, decisionId)).toBe(0)
    })
})

describe("the ask line next to the approval card", () => {
    it("holds one message per room for an ask: where the card stands the engine says no line, an unposted decision keeps its one line", async () => {
        const identity = await seed()
        const { workspaceId, agentId, ownerId } = identity
        const [first] = identity.staffIds
        const room = valueOf(
            await chat().createRoom(workspaceId, ownerId, { kind: "group", name: "Sales", members: [user(first)] }),
        )
        const carded = await openApprovalRequest(world.db.primary, {
            id: world.id(),
            chainStepId: world.id(),
            workspaceId,
            seatIds: [],
            agentId,
            department: "sales",
        })
        await chat().postApproval(workspaceId, {
            decisionId: carded,
            body: "Refund?",
            agentId,
            roomIds: [room.id],
            approverSeatIds: [],
        })
        const unposted = await openApprovalRequest(world.db.primary, {
            id: world.id(),
            chainStepId: world.id(),
            workspaceId,
            seatIds: [],
            agentId,
            department: "sales",
        })

        await eachInOrder([carded, unposted], async (decisionId) => {
            if ((await chat().cardRooms(workspaceId, decisionId)) > 0) return
            await chat().postMessage(workspaceId, {
                authorAgentId: agentId,
                roomId: room.id,
                toUserId: null,
                body: "Ask",
                key: `ask:${decisionId}`,
            })
        })

        const thread = await chat().messages(workspaceId, first, room.id, 10, null, false)
        expect(thread.nodes.filter((node) => node.kind === "approval")).toHaveLength(1)
        expect(thread.nodes.filter((node) => node.kind === "text")).toHaveLength(1)
    })
})
