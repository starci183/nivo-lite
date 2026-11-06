import assert from "node:assert/strict"
import { TeamChatService } from "@modules/domain/team-chat"
import type { TeamChatResult } from "@modules/domain/team-chat"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { DecideChatApprovalCommand } from "../../../features/api/team-chat/application/decide-chat-approval.command"
import { DecideChatApprovalHandler } from "../../../features/api/team-chat/application/decide-chat-approval.handler"
import type { DecideOutcome } from "../../../features/api/team-chat/application/team-chat.contracts"
import { persistGraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import type { GraphTenant } from "../../fixtures/builders/agent-graph-world.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { backendRoleSandbox, currentRole } from "../../world/backend-role-sandbox.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useSeedConnection } from "../../world/sales-door-world.service"
import { useTestWorld } from "../../world/use-test-world"

/** The real app opens in about a minute on the world; the whole suite shares that one boot. */
jest.setTimeout(240_000)

const [WorkspaceMemberEntity] = workspaceMembersEntities

const world = useTestWorld({ modules: API_APP_MODULES, sandbox: backendRoleSandbox() })
const seed = useSeedConnection(world)

const who: GraphTenant = { workspaceId: world.id(), userId: world.id(), agentId: world.id(), versionId: world.id() }
const STAFF = world.id()
const STRANGER = world.id()
const principal = (id: string) => ({ id, role: "authenticated" as const })

interface SeatRow {
    readonly id: string
}

const seatOf = async (userId: string): Promise<string> => {
    const rows: Array<SeatRow> = await seed.manager.query(
        "SELECT id FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2",
        [who.workspaceId, userId],
    )
    return rows[0]?.id ?? ""
}

beforeAll(async () => {
    await persistGraphTenant(seed.manager, who)
    await seed.manager.insert("auth.users", { id: STAFF })
    await seed.manager.insert("auth.users", { id: STRANGER })
    await seed.manager.insert(WorkspaceMemberEntity, {
        workspaceId: who.workspaceId,
        userId: STAFF,
        role: "staff",
        displayName: "Staff",
        status: "active",
    })
    world.cleanup(async () => {
        await removeWorkspace(seed.manager, who.workspaceId)
        await removeAuthUsers(seed.manager, [who.userId, STAFF, STRANGER])
    })
})

const chat = (): TeamChatService => world.resolve(TeamChatService)

const decide = (userId: string, decisionId: string, verdict: "approve" | "reject"): Promise<DecideOutcome> =>
    world
        .resolve(DecideChatApprovalHandler)
        .execute(
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
    const rows: Array<SeatRow> = await seed.manager.query(
        `INSERT INTO public.approval_requests
             (workspace_id, chain_step_id, department, action, policy, approvers, timeout_minutes, expires_at, requested_by_agent_id)
         VALUES ($1, gen_random_uuid(), 'accounting', 'refund', 'any', $2::jsonb, 30, now() + interval '30 minutes', $3)
         RETURNING id`,
        [
            who.workspaceId,
            JSON.stringify([{ memberId: ownerSeat, name: "Owner", role: "owner", roomId: null }]),
            who.agentId,
        ],
    )
    const decisionId = rows[0]?.id ?? ""
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
        expect(outcome).toMatchObject({ ok: true, approval: { status: "refused", decidedByName: expect.any(String) } })
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
