import assert from "node:assert/strict"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import type { DecideOutcome, TeamChatResult } from "@modules/domain/team-chat"
import { DecideChatApprovalCommand } from "../../../features/api/team-chat/application/decide-chat-approval.command"
import { DecideChatApprovalHandler } from "../../../features/api/team-chat/application/decide-chat-approval.handler"
import { persistGraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import {
    openApprovalRequest,
    persistStaffSeat,
    persistStranger,
    seatIdOf,
} from "../../fixtures/builders/team-chat.builder"
import type { GraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { backendRoleSandbox, currentRole } from "../../world/backend-role-sandbox.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useSeedConnection } from "../../world/sales-door-world.service"
import { useTestWorld } from "../../world/use-test-world"

/** The real app opens in about a minute on the world; the whole suite shares that one boot. */
jest.setTimeout(240_000)

const world = useTestWorld({ modules: API_APP_MODULES, sandbox: backendRoleSandbox() })
const seed = useSeedConnection(world)

const who: GraphTenant = { workspaceId: world.id(), userId: world.id(), agentId: world.id(), versionId: world.id() }
const STAFF = world.id()
const STRANGER = world.id()
const principal = (id: string) => ({ id, role: "authenticated" as const })

const seatOf = (userId: string): Promise<string> => seatIdOf(seed.manager, who.workspaceId, userId)

beforeAll(async () => {
    await persistGraphTenant(seed.manager, who)
    await persistStaffSeat(seed.manager, { workspaceId: who.workspaceId, userId: STAFF, displayName: "Staff" })
    await persistStranger(seed.manager, STRANGER)
    world.cleanup(async () => {
        await removeWorkspace(seed.manager, who.workspaceId)
        await removeAuthUsers(seed.manager, [who.userId, STAFF, STRANGER])
    })
})

const chat = (): TeamChatRoomsService => world.resolve(TeamChatRoomsService)

const decide = (userId: string, decisionId: string, verdict: "approve" | "reject"): Promise<DecideOutcome> =>
    world.resolve(DecideChatApprovalHandler).execute(
        new DecideChatApprovalCommand({
            request: { workspaceId: who.workspaceId, decisionId, verdict },
            principal: principal(userId),
        }),
    )

const valueOf = <V>(result: TeamChatResult<V>): V => {
    assert(result.ok, "expected a value, got a refusal")
    return result.value
}

/** A pending request that names the owner as its approver, and its card in a group of the owner and the staff and in the owner direct room with the agent. */
const askedOfOwner = async (): Promise<{ readonly decisionId: string; readonly roomId: string }> => {
    const ownerSeat = await seatOf(who.userId)
    const decisionId = await openApprovalRequest(seed.manager, {
        workspaceId: who.workspaceId,
        id: world.id(),
        chainStepId: world.id(),
        seatIds: [ownerSeat],
        agentId: who.agentId,
        department: "accounting",
    })
    const room = valueOf(
        await chat().createRoom(who.workspaceId, who.userId, {
            kind: "group",
            name: `Approvers ${decisionId.slice(0, 8)}`,
            members: [{ memberKind: "user", memberId: STAFF }],
        }),
    )
    await chat().postApproval(who.workspaceId, {
        decisionId,
        body: "Refund 200000 VND?",
        agentId: who.agentId,
        roomIds: [room.id],
        approverSeatIds: [ownerSeat],
    })
    return { decisionId, roomId: room.id }
}

/** The state the card of the decision shows in the group, to the staff member, and in the owner direct room with the agent, to the owner. */
const cardStates = async (roomId: string): Promise<ReadonlyArray<string | undefined>> => {
    const inGroup = await chat().messages(who.workspaceId, STAFF, roomId, 5, null, false)
    const direct = await chat().rooms(who.workspaceId, who.userId, "direct", who.agentId)
    return [inGroup.nodes[0]?.approval?.status, direct[0]?.lastMessage?.approval?.status]
}

describe("decideChatApproval on the real decisions core, as the back-end role", () => {
    it("runs on the back-end role, so the policies are the deployed ones", async () => {
        expect(await currentRole(world.db.primary)).toBe("app_be")
    })

    it("approves from a card, and every card of the decision then shows it settled", async () => {
        const { decisionId, roomId } = await askedOfOwner()
        expect(await cardStates(roomId)).toEqual(["pending", "pending"])
        const outcome = await decide(who.userId, decisionId, "approve")
        expect(outcome).toMatchObject({ ok: true, approval: { decisionId, status: "approved", canDecide: false } })
        expect(await cardStates(roomId)).toEqual(["approved", "approved"])
    })

    it("refuses from a card, and every card shows the refusal", async () => {
        const { decisionId, roomId } = await askedOfOwner()
        const outcome = await decide(who.userId, decisionId, "reject")
        expect(outcome).toMatchObject({ ok: true, approval: { status: "refused" } })
        expect(outcome.ok && outcome.approval.decidedByName).not.toBeNull()
        expect(await cardStates(roomId)).toEqual(["refused", "refused"])
    })

    it("refuses a person who is not an approver, and a stranger with no seat, as data, and leaves the cards pending", async () => {
        const { decisionId, roomId } = await askedOfOwner()
        expect(await decide(STAFF, decisionId, "approve")).toEqual({ ok: false, refusal: "not_an_approver" })
        expect(await decide(STRANGER, decisionId, "approve")).toEqual({ ok: false, refusal: "not_an_approver" })
        expect(await cardStates(roomId)).toEqual(["pending", "pending"])
    })

    it("refuses a decision that was settled already, and one that does not exist, as data", async () => {
        const { decisionId } = await askedOfOwner()
        expect(await decide(who.userId, decisionId, "approve")).toMatchObject({ ok: true })
        expect(await decide(who.userId, decisionId, "reject")).toEqual({ ok: false, refusal: "decision_closed" })
        expect(await decide(who.userId, world.id(), "approve")).toEqual({ ok: false, refusal: "decision_not_found" })
    })
})
