import assert from "node:assert/strict"
import { TeamChatErrorCode, TeamChatService } from "@modules/domain/team-chat"
import type { MemberRef, RoomView, SendInput, TeamChatResult } from "@modules/domain/team-chat"
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

const refusalOf = <V>(result: TeamChatResult<V>): TeamChatErrorCode | null => (result.ok ? null : result.refusal)

const message = (roomId: string | null, body: string, extra: Partial<SendInput> = {}): SendInput => ({
    roomId,
    to: null,
    body,
    mentions: [],
    fileKeys: [],
    clientId: null,
    ...extra,
})

const group = async (
    identity: TeamChatIdentity,
    name = "Sales team",
    members: ReadonlyArray<string> = identity.staffIds.slice(0, 2),
): Promise<RoomView> =>
    valueOf(
        await chat().createRoom(identity.workspaceId, identity.ownerId, {
            kind: "group",
            name,
            members: members.map(user),
        }),
    )

describe("rooms", () => {
    it("opens a direct room once per pair, whoever asks first", async () => {
        const identity = await seed()
        const [first, second] = identity.staffIds
        const direct = { kind: "direct", name: null } as const
        const opened = valueOf(
            await chat().createRoom(identity.workspaceId, first, { ...direct, members: [user(second)] }),
        )
        const again = valueOf(
            await chat().createRoom(identity.workspaceId, second, { ...direct, members: [user(first)] }),
        )
        expect(again.id).toBe(opened.id)
        expect(opened.members.map((member) => member.memberId).toSorted()).toEqual([first, second].toSorted())
        expect(opened.name).toBe("Staff 2")
        expect(again.name).toBe("Staff 1")
    })

    it("opens a group with its creator as owner and refuses a bad shape as data", async () => {
        const identity = await seed()
        const made = await group(identity)
        expect(made.kind).toBe("group")
        expect(made.members.find((member) => member.memberId === identity.ownerId)?.role).toBe("owner")
        const { workspaceId, ownerId } = identity
        const [first, second, third] = identity.staffIds
        const open = (input: Parameters<TeamChatService["createRoom"]>[2]) =>
            chat().createRoom(workspaceId, ownerId, input)
        expect(refusalOf(await open({ kind: "group", name: "  ", members: [user(first)] }))).toBe(
            TeamChatErrorCode.GroupNeedsName,
        )
        expect(refusalOf(await open({ kind: "direct", name: null, members: [user(first), user(second)] }))).toBe(
            TeamChatErrorCode.DirectNeedsTwo,
        )
        expect(refusalOf(await open({ kind: "direct", name: "no", members: [user(third)] }))).toBe(
            TeamChatErrorCode.DirectNeedsTwo,
        )
        expect(refusalOf(await open({ kind: "group", name: "x", members: [user(identity.outsiderId)] }))).toBe(
            TeamChatErrorCode.MemberUnknown,
        )
        expect(
            refusalOf(
                await open({ kind: "group", name: "x", members: [{ memberKind: "agent", memberId: world.id() }] }),
            ),
        ).toBe(TeamChatErrorCode.MemberUnknown)
    })

    it("shows a person only the rooms they sit in and an owner every room", async () => {
        const identity = await seed()
        const [first, second, third] = identity.staffIds
        await group(identity, "Sales team", [first, second])
        const mine = await chat().rooms(identity.workspaceId, first, null)
        expect(mine.map((room) => room.name)).toEqual(["Sales team"])
        expect(await chat().rooms(identity.workspaceId, third, null)).toEqual([])
        expect(await chat().rooms(identity.workspaceId, identity.ownerId, null)).toHaveLength(1)
        expect(await chat().rooms(identity.foreignWorkspaceId, identity.outsiderId, null)).toEqual([])
        expect(await chat().room(identity.workspaceId, third, mine[0]?.id ?? "")).toBeNull()
    })

    it("lists the direct room a viewer shares with one member, and nothing before it exists", async () => {
        const identity = await seed()
        const [first, second] = identity.staffIds
        expect(await chat().rooms(identity.workspaceId, first, "direct", second)).toEqual([])
        const opened = valueOf(
            await chat().createRoom(identity.workspaceId, first, {
                kind: "direct",
                name: null,
                members: [user(second)],
            }),
        )
        expect((await chat().rooms(identity.workspaceId, first, "direct", second)).map((room) => room.id)).toEqual([
            opened.id,
        ])
    })
})

describe("members", () => {
    it("adds and removes members of a group under the owner of the room, and keeps the last owner", async () => {
        const identity = await seed()
        const [first, second, third] = identity.staffIds
        const { workspaceId, ownerId } = identity
        const made = await group(identity, "Team", [first])
        expect(valueOf(await chat().addMember(workspaceId, ownerId, made.id, user(second))).members).toHaveLength(3)
        expect(refusalOf(await chat().addMember(workspaceId, ownerId, made.id, user(second)))).toBe(
            TeamChatErrorCode.AlreadyMember,
        )
        expect(refusalOf(await chat().addMember(workspaceId, first, made.id, user(third)))).toBe(
            TeamChatErrorCode.Forbidden,
        )
        expect(refusalOf(await chat().removeMember(workspaceId, ownerId, made.id, user(third)))).toBe(
            TeamChatErrorCode.NotAMemberToRemove,
        )
        expect(valueOf(await chat().removeMember(workspaceId, second, made.id, user(second)))).toBeNull()
        expect((await chat().room(workspaceId, ownerId, made.id))?.members).toHaveLength(2)
        expect(refusalOf(await chat().removeMember(workspaceId, ownerId, made.id, user(ownerId)))).toBe(
            TeamChatErrorCode.LastOwner,
        )
        expect(valueOf(await chat().removeMember(workspaceId, ownerId, made.id, user(first)))?.members).toHaveLength(1)
        expect(valueOf(await chat().removeMember(workspaceId, ownerId, made.id, user(ownerId)))).toBeNull()
    })

    it("keeps a direct room fixed", async () => {
        const identity = await seed()
        const [first, second, third] = identity.staffIds
        const direct = valueOf(
            await chat().createRoom(identity.workspaceId, first, {
                kind: "direct",
                name: null,
                members: [user(second)],
            }),
        )
        expect(refusalOf(await chat().addMember(identity.workspaceId, first, direct.id, user(third)))).toBe(
            TeamChatErrorCode.Forbidden,
        )
        expect(refusalOf(await chat().removeMember(identity.workspaceId, first, direct.id, user(second)))).toBe(
            TeamChatErrorCode.Forbidden,
        )
    })
})

describe("messages", () => {
    it("sends once per client id, mentions members and refuses bad input as data", async () => {
        const identity = await seed()
        const [first, second, third] = identity.staffIds
        const { workspaceId } = identity
        const made = await group(identity, "Team", [first, second])
        const send = (body: string, extra: Partial<SendInput> = {}) =>
            chat().send(workspaceId, first, message(made.id, body, extra))
        const sent = valueOf(await send("hello", { mentions: [user(second)], clientId: "c1" }))
        const retried = valueOf(await send("hello", { mentions: [user(second)], clientId: "c1" }))
        expect(retried.id).toBe(sent.id)
        expect(sent).toMatchObject({
            kind: "text",
            authorKind: "user",
            authorId: first,
            authorName: "Staff 1",
            roomId: made.id,
        })
        expect(sent.mentions.map((mention) => mention.name)).toEqual(["Staff 2"])
        expect(refusalOf(await send("   "))).toBe(TeamChatErrorCode.BodyEmpty)
        expect(refusalOf(await send("x".repeat(8001)))).toBe(TeamChatErrorCode.BodyTooLong)
        const crowd = Array.from({ length: 21 }, (_, index) => user(index === 0 ? second : world.id()))
        expect(refusalOf(await send("hi", { mentions: crowd }))).toBe(TeamChatErrorCode.TooManyMentions)
        const files = Array.from({ length: 11 }, (_, index) => `k${String(index)}`)
        expect(refusalOf(await send("hi", { fileKeys: files }))).toBe(TeamChatErrorCode.TooManyFiles)
        expect(refusalOf(await send("hi", { mentions: [user(identity.outsiderId)] }))).toBe(
            TeamChatErrorCode.MemberUnknown,
        )
        expect(refusalOf(await chat().send(workspaceId, third, message(made.id, "hi")))).toBe(
            TeamChatErrorCode.NotFound,
        )
    })

    it("opens the direct room with the first message to a member", async () => {
        const identity = await seed()
        const [first, second] = identity.staffIds
        const { workspaceId } = identity
        const sent = valueOf(await chat().send(workspaceId, first, message(null, "first", { to: user(second) })))
        const again = valueOf(await chat().send(workspaceId, first, message(null, "second", { to: user(second) })))
        expect(again.roomId).toBe(sent.roomId)
        expect(refusalOf(await chat().send(workspaceId, first, message(null, "x")))).toBe(TeamChatErrorCode.NotFound)
    })

    it("pages a thread newest first with a cursor", async () => {
        const identity = await seed()
        const [first, second, third] = identity.staffIds
        const { workspaceId } = identity
        const made = await group(identity, "Team", [first, second])
        for (let index = 1; index <= 5; index += 1) {
            valueOf(await chat().send(workspaceId, first, message(made.id, `m${String(index)}`)))
        }
        const page1 = await chat().messages(workspaceId, second, made.id, 2, null, false)
        expect(page1.nodes.map((node) => node.body)).toEqual(["m5", "m4"])
        expect(page1.hasNextPage).toBe(true)
        const page2 = await chat().messages(workspaceId, second, made.id, 2, page1.endCursor, false)
        expect(page2.nodes.map((node) => node.body)).toEqual(["m3", "m2"])
        const page3 = await chat().messages(workspaceId, second, made.id, 2, page2.endCursor, false)
        expect(page3).toMatchObject({ hasNextPage: false, endCursor: null })
        expect(page3.nodes.map((node) => node.body)).toEqual(["m1"])
        expect((await chat().messages(workspaceId, second, made.id, 2, "garbage", false)).nodes).toEqual([])
        expect((await chat().messages(workspaceId, third, made.id, 2, null, false)).nodes).toEqual([])
    })
})

describe("unread and pins", () => {
    it("counts what others wrote after the read position, and the mentions among it", async () => {
        const identity = await seed()
        const [first, second, third] = identity.staffIds
        const { workspaceId, ownerId } = identity
        const made = await group(identity, "Team", [first, second])
        valueOf(await chat().send(workspaceId, second, message(made.id, "mine")))
        valueOf(await chat().send(workspaceId, first, message(made.id, "one")))
        valueOf(await chat().send(workspaceId, first, message(made.id, "two", { mentions: [user(second)] })))
        const before = await chat().unread(workspaceId, second)
        expect(before).toMatchObject({ total: 2, mentionTotal: 1 })
        expect(before.rooms).toEqual([{ roomId: made.id, unreadCount: 2, mentionCount: 1 }])
        expect(valueOf(await chat().markRead(workspaceId, second, made.id, null))).toEqual({
            roomId: made.id,
            unreadCount: 0,
            mentionCount: 0,
        })
        expect((await chat().unread(workspaceId, second)).rooms).toEqual([])
        expect(refusalOf(await chat().markRead(workspaceId, second, made.id, world.id()))).toBe(
            TeamChatErrorCode.NotFound,
        )
        expect(refusalOf(await chat().markRead(workspaceId, ownerId, made.id, null))).toBeNull()
        expect(refusalOf(await chat().markRead(workspaceId, third, made.id, null))).toBe(TeamChatErrorCode.NotFound)
    })

    it("pins and unpins a message once and lists only the pinned", async () => {
        const identity = await seed()
        const [first, second] = identity.staffIds
        const { workspaceId } = identity
        const made = await group(identity, "Team", [first, second])
        const kept = valueOf(await chat().send(workspaceId, first, message(made.id, "keep")))
        valueOf(await chat().send(workspaceId, first, message(made.id, "skip")))
        expect(valueOf(await chat().pin(workspaceId, second, made.id, kept.id)).pinned).toBe(true)
        expect(valueOf(await chat().pin(workspaceId, second, made.id, kept.id)).pinned).toBe(true)
        const pinned = await chat().messages(workspaceId, first, made.id, 10, null, true)
        expect(pinned.nodes.map((node) => node.body)).toEqual(["keep"])
        expect(valueOf(await chat().unpin(workspaceId, first, made.id, kept.id)).pinned).toBe(false)
        expect(refusalOf(await chat().pin(workspaceId, first, made.id, world.id()))).toBe(TeamChatErrorCode.NotFound)
        expect((await chat().room(workspaceId, first, made.id))?.lastMessage?.body).toBe("skip")
    })
})
