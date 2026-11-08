import assert from "node:assert/strict"
import { TeamChatRoomsService, type ChatMemberRef, type TeamChatResult } from "@modules/domain/team-chat"
import {
    TEAM_CHAT_CODES,
    openApprovalRequest,
    persistTeamChat,
    rejectApprovalRequest,
    seatIdOf,
    teamChatIdentity,
    type TeamChatIdentity,
} from "../../fixtures/builders/team-chat.builder"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { TEAM_CHAT_PROOF_MODULES } from "../../world/team-chat-capabilities.options"
import { TeamChatProofStorage, TeamChatTagRecorder } from "../../world/team-chat-proof.module"
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

const refusalOf = <V>(result: TeamChatResult<V>): string | null => (result.ok ? null : result.refusal)

const seatOf = (workspaceId: string, userId: string): Promise<string> => seatIdOf(world.db.primary, workspaceId, userId)

const openRequest = (workspaceId: string, seatIds: ReadonlyArray<string>, agentId: string): Promise<string> =>
    openApprovalRequest(world.db.primary, {
        id: world.id(),
        chainStepId: world.id(),
        workspaceId,
        seatIds,
        agentId,
        department: "sales",
    })

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
        await rejectApprovalRequest(world.db.primary, decisionId, firstSeat)
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

describe("the tag trigger", () => {
    it("hands a message that mentions an agent to the work core once, with the room and the message, and not a retried one", async () => {
        const identity = await seed()
        const { workspaceId, ownerId, agentId } = identity
        const recorder = world.resolve(TeamChatTagRecorder)
        recorder.handed.length = 0
        recorder.allowed = [agentId]
        const room = valueOf(
            await chat().createRoom(workspaceId, ownerId, {
                kind: "group",
                name: "Ops",
                members: [{ memberKind: "agent", memberId: agentId }],
            }),
        )
        const send = () =>
            chat().send(workspaceId, ownerId, {
                roomId: room.id,
                to: null,
                body: "@Bot quote two lanterns",
                mentions: [{ memberKind: "agent", memberId: agentId }, user(identity.staffIds[0])],
                fileKeys: [],
                clientId: "tag-1",
            })
        const sent = valueOf(await send())
        valueOf(await send())
        expect(recorder.handed).toEqual([
            {
                workspaceId,
                tag: { userId: ownerId, agentId, roomId: room.id, messageId: sent.id, text: "@Bot quote two lanterns" },
            },
        ])
    })

    it("hands nothing over for a message that mentions only people", async () => {
        const identity = await seed()
        const recorder = world.resolve(TeamChatTagRecorder)
        recorder.handed.length = 0
        const [first] = identity.staffIds
        const room = valueOf(
            await chat().createRoom(identity.workspaceId, identity.ownerId, {
                kind: "direct",
                name: null,
                members: [user(first)],
            }),
        )
        valueOf(
            await chat().send(identity.workspaceId, identity.ownerId, {
                roomId: room.id,
                to: null,
                body: "hi",
                mentions: [user(first)],
                fileKeys: [],
                clientId: null,
            }),
        )
        expect(recorder.handed).toEqual([])
    })
})

const facts = (extra: object = {}) => ({
    fileName: "Bao gia.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
    ...extra,
})

describe("files of a room", () => {
    it("issues an upload address to a person of the room, refuses a bad type or size as data, and refuses a stranger", async () => {
        const identity = await seed()
        const { workspaceId, ownerId } = identity
        const [first, , third] = identity.staffIds
        const room = valueOf(
            await chat().createRoom(workspaceId, ownerId, { kind: "group", name: "Files", members: [user(first)] }),
        )
        const upload = valueOf(await chat().requestUpload(workspaceId, first, room.id, facts()))
        expect(upload).toMatchObject({ method: "PUT", headers: [{ name: "Content-Type", value: "application/pdf" }] })
        expect(upload.fileKey).toMatch(new RegExp(`^${workspaceId}/team-chat/${room.id}/[0-9a-f-]{36}/Bao gia\\.pdf$`))
        expect(upload.uploadUrl).toContain(upload.fileKey)
        expect(
            refusalOf(
                await chat().requestUpload(
                    workspaceId,
                    first,
                    room.id,
                    facts({ mimeType: "application/x-msdownload" }),
                ),
            ),
        ).toBe(TEAM_CHAT_CODES.fileTypeNotAllowed)
        expect(
            refusalOf(await chat().requestUpload(workspaceId, first, room.id, facts({ sizeBytes: 26 * 1024 * 1024 }))),
        ).toBe(TEAM_CHAT_CODES.fileTooLarge)
        expect(refusalOf(await chat().requestUpload(workspaceId, first, room.id, facts({ sizeBytes: 0 })))).toBe(
            TEAM_CHAT_CODES.fileTooLarge,
        )
        expect(refusalOf(await chat().requestUpload(workspaceId, third, room.id, facts()))).toBe(
            TEAM_CHAT_CODES.notFound,
        )
        const store = world.resolve(TeamChatProofStorage)
        store.reachable = false
        expect(refusalOf(await chat().requestUpload(workspaceId, first, room.id, facts()))).toBe(
            TEAM_CHAT_CODES.storageUnavailable,
        )
        store.reachable = true
    })
    it("stores the checked files with the message and signs their read addresses, and removes a file over the limit", async () => {
        const identity = await seed()
        const { workspaceId, ownerId } = identity
        const [first] = identity.staffIds
        const store = world.resolve(TeamChatProofStorage)
        const room = valueOf(
            await chat().createRoom(workspaceId, ownerId, { kind: "group", name: "Files", members: [user(first)] }),
        )
        const upload = valueOf(await chat().requestUpload(workspaceId, first, room.id, facts()))
        const send = (keys: Array<string>, body = "") =>
            chat().send(workspaceId, first, {
                roomId: room.id,
                to: null,
                body,
                mentions: [],
                fileKeys: keys,
                clientId: null,
            })
        expect(refusalOf(await send([upload.fileKey]))).toBe(TEAM_CHAT_CODES.storageUnavailable)
        store.sizes.set(upload.fileKey, 1234)
        const sent = valueOf(await send([upload.fileKey]))
        expect(sent.attachments).toEqual([
            {
                fileKey: upload.fileKey,
                name: "Bao gia.pdf",
                mimeType: "application/pdf",
                sizeBytes: 1234,
                url: `https://store.test/get/${upload.fileKey}`,
            },
        ])
        const thread = await chat().messages(workspaceId, first, room.id, 5, null, false)
        expect(thread.nodes[0]?.attachments[0]?.url).toBe(`https://store.test/get/${upload.fileKey}`)
        const big = valueOf(await chat().requestUpload(workspaceId, first, room.id, facts()))
        store.sizes.set(big.fileKey, 30 * 1024 * 1024)
        expect(refusalOf(await send([big.fileKey]))).toBe(TEAM_CHAT_CODES.fileTooLarge)
        expect(store.removed).toEqual([big.fileKey])
        expect(refusalOf(await send(["somewhere/else.pdf"]))).toBe(TEAM_CHAT_CODES.fileTypeNotAllowed)
        expect(refusalOf(await send([`${workspaceId}/team-chat/${room.id}/${world.id()}/run.exe`]))).toBe(
            TEAM_CHAT_CODES.fileTypeNotAllowed,
        )
    })
})

describe("mute", () => {
    it("mutes a room for one member only, and an owner who sits in no room has nothing to mute", async () => {
        const identity = await seed()
        const { workspaceId, ownerId } = identity
        const [first, second] = identity.staffIds
        const room = valueOf(
            await chat().createRoom(workspaceId, ownerId, {
                kind: "group",
                name: "Quiet",
                members: [user(first), user(second)],
            }),
        )
        expect(valueOf(await chat().setMuted(workspaceId, first, room.id, true)).muted).toBe(true)
        expect((await chat().room(workspaceId, second, room.id))?.muted).toBe(false)
        expect(valueOf(await chat().setMuted(workspaceId, first, room.id, false)).muted).toBe(false)
        const other = valueOf(
            await chat().createRoom(workspaceId, first, { kind: "group", name: "Other", members: [user(second)] }),
        )
        expect(refusalOf(await chat().setMuted(workspaceId, ownerId, other.id, true))).toBe(TEAM_CHAT_CODES.notMember)
        expect(refusalOf(await chat().setMuted(workspaceId, identity.staffIds[2], room.id, true))).toBe(
            TEAM_CHAT_CODES.notFound,
        )
    })
})
