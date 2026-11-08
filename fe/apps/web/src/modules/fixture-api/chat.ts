import { PROTOTYPE_WORKSPACE_ID } from "@/modules/config"
import chat from "./chat.json"

/** The variables of one operation. */
type Variables = Readonly<Record<string, unknown>>

/** One fixture answer: the data an operation returns. */
type FixtureAnswer = (variables: Variables) => Record<string, unknown>

/** One message of the fixture chat, as the state keeps it. */
interface StoredMessage {
    id: string
    roomId: string
    kind: string
    author: string
    body: string
    createdAt: string
    pinned: boolean
    runId: string | null
    decisionId: string | null
    status: string
    decidedBy: string
    decidedAt: string | null
}

/** One room of the fixture chat, as the state keeps it. */
interface StoredRoom {
    id: string
    kind: string
    name: string
    members: string[]
    unread: number
    mentions: number
    muted: boolean
}

const MINUTE_MS = 60_000

/** The moment `minutes` before now, as ISO text. */
const agoOf = (minutes: number): string => new Date(Date.now() - minutes * MINUTE_MS).toISOString()

/** The name of a person or an agent of the fixture workspace. */
const nameOf = (id: string): string => {
    if (id === chat.viewer.id) return chat.viewer.name
    return [...chat.people, ...chat.agents].find((party) => party.id === id)?.name ?? ""
}

/** The kind of a party id: an agent id starts with "agent-". */
const kindOf = (id: string): "agent" | "user" => (id.startsWith("agent-") ? "agent" : "user")

const rooms: StoredRoom[] = chat.rooms.map((room) => ({ ...room, members: [...room.members], muted: false }))

const messages: StoredMessage[] = chat.messages.map((seed) => ({
    id: seed.id,
    roomId: seed.roomId,
    kind: seed.kind,
    author: seed.author,
    body: seed.body,
    createdAt: agoOf(seed.minutesAgo),
    pinned: seed.pinned,
    runId: seed.runId,
    decisionId: seed.decisionId,
    status: seed.status,
    decidedBy: seed.decidedBy,
    decidedAt: seed.decidedMinutesAgo === null ? null : agoOf(seed.decidedMinutesAgo),
}))

let nextId = 100

/** A new id for something the viewer makes. */
const freshId = (prefix: string): string => {
    nextId += 1
    return `${prefix}-${nextId}`
}

/** The messages of one room, newest first. */
const ofRoom = (roomId: string): StoredMessage[] =>
    messages.filter((message) => message.roomId === roomId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

/** The GraphQL object of a stored message. */
const messageOf = (message: StoredMessage): Record<string, unknown> => ({
    __typename: "ChatMessage",
    id: message.id,
    roomId: message.roomId,
    kind: message.kind,
    authorKind: message.kind === "system" ? "system" : kindOf(message.author),
    authorId: message.kind === "system" ? null : message.author,
    authorName: message.kind === "system" ? "" : nameOf(message.author),
    body: message.body,
    createdAt: message.createdAt,
    editedAt: null,
    pinned: message.pinned,
    mentions: [],
    attachments: [],
    report:
        message.runId === null ? null : { __typename: "ChatReportRef", runId: message.runId, agentId: message.author },
    approval: message.decisionId === null ? null : approvalOf(message),
})

/** The approval card state of a stored message. */
const approvalOf = (message: StoredMessage): Record<string, unknown> => ({
    __typename: "ChatApproval",
    decisionId: message.decisionId,
    status: message.status,
    decidedByName: message.status === "pending" ? null : message.decidedBy,
    decidedAt: message.status === "pending" ? null : message.decidedAt,
    canDecide: message.status === "pending",
})

/** The GraphQL object of a stored room. */
const roomOf = (room: StoredRoom): Record<string, unknown> => {
    const last = ofRoom(room.id)[0]
    return {
        __typename: "ChatRoom",
        id: room.id,
        kind: room.kind,
        name: room.name,
        position: 0,
        createdBy: chat.viewer.id,
        createdAt: agoOf(5000),
        members: room.members.map((id) => ({
            __typename: "ChatMember",
            memberKind: kindOf(id),
            memberId: id,
            name: nameOf(id),
            role: id === chat.viewer.id ? "owner" : "member",
            lastReadAt: null,
            muted: false,
        })),
        unreadCount: room.unread,
        mentionCount: room.mentions,
        muted: room.muted,
        lastMessage:
            last === undefined
                ? null
                : {
                      __typename: "ChatMessage",
                      id: last.id,
                      kind: last.kind,
                      authorKind: last.kind === "system" ? "system" : kindOf(last.author),
                      authorName: last.kind === "system" ? "" : nameOf(last.author),
                      body: last.body,
                      createdAt: last.createdAt,
                  },
    }
}

/** The input an operation carries. */
const inputOf = (variables: Variables): Record<string, unknown> => {
    const input = variables.input
    return typeof input === "object" && input !== null ? Object.fromEntries(Object.entries(input)) : {}
}

/** The text of an input field, or the empty text. */
const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** The room with that id, or undefined. */
const roomById = (id: string): StoredRoom | undefined => rooms.find((room) => room.id === id)

/** The party a `to` or a member reference names, as its id. */
const refIdOf = (value: unknown): string =>
    typeof value === "object" && value !== null && "memberId" in value ? textOf(value.memberId) : ""

/** The direct room of the viewer with a party; made on the first message to it. */
const directRoomWith = (partyId: string): StoredRoom => {
    const found = rooms.find((room) => room.kind === "direct" && room.members.includes(partyId))
    if (found !== undefined) return found
    const made: StoredRoom = {
        id: freshId("room"),
        kind: "direct",
        name: nameOf(partyId),
        members: [chat.viewer.id, partyId],
        unread: 0,
        mentions: 0,
        muted: false,
    }
    rooms.push(made)
    return made
}

/** Adds the message of the viewer and, in a room with an agent, the agent's canned answer. */
const sendTo = (room: StoredRoom, body: string): StoredMessage => {
    const sent: StoredMessage = {
        id: freshId("m"),
        roomId: room.id,
        kind: "text",
        author: chat.viewer.id,
        body,
        createdAt: agoOf(0),
        pinned: false,
        runId: null,
        decisionId: null,
        status: "pending",
        decidedBy: "",
        decidedAt: null,
    }
    messages.push(sent)
    const agent = room.members.find((id) => kindOf(id) === "agent")
    if (agent !== undefined)
        messages.push({ ...sent, id: freshId("m"), author: agent, body: chat.agentReply, createdAt: agoOf(-0.05) })
    return sent
}

/** The chat operations the prototype answers, by operation name. State lives in this module while the page stays open. */
const CHAT_ANSWERS: Readonly<Record<string, FixtureAnswer>> = {
    ChatRooms: (variables) => {
        const input = inputOf(variables)
        const kind = textOf(input.kind)
        const member = textOf(input.member)
        const wanted = rooms
            .filter((room) => kind === "" || room.kind === kind)
            .filter((room) => member === "" || room.members.includes(member))
            .sort((a, b) => (ofRoom(b.id)[0]?.createdAt ?? "").localeCompare(ofRoom(a.id)[0]?.createdAt ?? ""))
        return { chatRooms: wanted.map((room) => roomOf(room)) }
    },
    ChatMessages: (variables) => {
        const input = inputOf(variables)
        const nodes = ofRoom(textOf(input.roomId)).filter((message) => input.pinnedOnly !== true || message.pinned)
        return {
            chatMessages: {
                __typename: "ChatMessagePage",
                nodes: nodes.map((message) => messageOf(message)),
                pageInfo: { __typename: "ChatPageInfo", hasNextPage: false, endCursor: null },
            },
        }
    },
    ChatUnread: () => ({
        chatUnread: {
            __typename: "ChatUnread",
            total: rooms.filter((room) => !room.muted).reduce((sum, room) => sum + room.unread, 0),
            mentionTotal: rooms.reduce((sum, room) => sum + room.mentions, 0),
            rooms: rooms
                .filter((room) => room.unread > 0)
                .map((room) => ({
                    __typename: "ChatRoomUnread",
                    roomId: room.id,
                    unreadCount: room.unread,
                    mentionCount: room.mentions,
                })),
        },
    }),
    SendChatMessage: (variables) => {
        const input = inputOf(variables)
        const roomId = textOf(input.roomId)
        const room = roomId === "" ? directRoomWith(refIdOf(input.to)) : roomById(roomId)
        if (room === undefined)
            return { sendChatMessage: { __typename: "ChatMessagePayload", message: null, refusal: "not_found" } }
        return {
            sendChatMessage: {
                __typename: "ChatMessagePayload",
                message: messageOf(sendTo(room, textOf(input.body))),
                refusal: null,
            },
        }
    },
    MarkChatRoomRead: (variables) => {
        const room = roomById(textOf(inputOf(variables).roomId))
        if (room !== undefined) {
            room.unread = 0
            room.mentions = 0
        }
        return {
            markChatRoomRead: {
                __typename: "ChatReadPayload",
                unread: { __typename: "ChatRoomUnread", roomId: room?.id ?? "", unreadCount: 0, mentionCount: 0 },
                refusal: null,
            },
        }
    },
    PinChatMessage: (variables) => pinned(variables, true),
    UnpinChatMessage: (variables) => pinned(variables, false),
    CreateChatRoom: (variables) => {
        const input = inputOf(variables)
        const members = Array.isArray(input.members) ? input.members.map((value) => refIdOf(value)) : []
        const room =
            input.kind === "direct"
                ? directRoomWith(members[0] ?? "")
                : (() => {
                      const made: StoredRoom = {
                          id: freshId("room"),
                          kind: "group",
                          name: textOf(input.name),
                          members: [chat.viewer.id, ...members],
                          unread: 0,
                          mentions: 0,
                          muted: false,
                      }
                      rooms.push(made)
                      return made
                  })()
        return { createChatRoom: { __typename: "ChatRoomPayload", room: roomOf(room), refusal: null } }
    },
    SetChatRoomMuted: (variables) => {
        const input = inputOf(variables)
        const room = roomById(textOf(input.roomId))
        if (room !== undefined) room.muted = input.muted === true
        return {
            setChatRoomMuted: {
                __typename: "ChatRoomPayload",
                room: { __typename: "ChatRoom", id: room?.id ?? "", muted: room?.muted === true },
                refusal: null,
            },
        }
    },
    SetChatTyping: (variables) => ({
        setChatTyping: {
            __typename: "ChatTypingSignalType",
            id: chat.viewer.id,
            name: chat.viewer.name,
            avatarSeed: chat.viewer.id,
            typing: inputOf(variables).typing === true,
            expiresAt: agoOf(-5 / 60),
        },
    }),
    DecideChatApproval: (variables) => {
        const input = inputOf(variables)
        const status = input.verdict === "approve" ? "approved" : "refused"
        const settled = messages.filter((message) => message.decisionId === textOf(input.decisionId))
        for (const message of settled) {
            message.status = status
            message.decidedBy = chat.viewer.name
            message.decidedAt = agoOf(0)
        }
        const first = settled[0]
        return {
            decideChatApproval: {
                __typename: "ChatDecisionPayload",
                approval: first === undefined ? null : approvalOf(first),
                refusal: first === undefined ? "decision_not_found" : null,
            },
        }
    },
    RequestChatFileUpload: () => ({
        requestChatFileUpload: { __typename: "ChatFileUploadPayload", upload: null, refusal: "storage_unavailable" },
    }),
    WorkspaceMembers: () => ({
        workspaceMembers: [{ id: chat.viewer.id, name: chat.viewer.name }, ...chat.people].map((person) => ({
            __typename: "MemberListingType",
            avatarUrl: null,
            displayName: person.name,
            email: `${person.id}@nivo.vn`,
            lastSignInAt: null,
            role: person.id === chat.viewer.id ? "owner" : "staff",
            staffId: null,
            status: "active",
            userId: person.id,
            workspaceId: PROTOTYPE_WORKSPACE_ID,
        })),
    }),
    Agents: () => ({
        agents: chat.agents.map((agent) => ({
            __typename: "AgentType",
            id: agent.id,
            handle: agent.id.replace("agent-", ""),
            module: agent.id.replace("agent-", ""),
            name: agent.name,
        })),
    }),
}

/** The pin or unpin of one message. */
const pinned = (variables: Variables, isPinned: boolean): Record<string, unknown> => {
    const input = inputOf(variables)
    const message = messages.find((entry) => entry.id === textOf(input.messageId))
    if (message !== undefined) message.pinned = isPinned
    const payload = {
        __typename: "ChatMessagePayload",
        message:
            message === undefined
                ? null
                : { __typename: "ChatMessage", id: message.id, roomId: message.roomId, pinned: message.pinned },
        refusal: null,
    }
    return isPinned ? { pinChatMessage: payload } : { unpinChatMessage: payload }
}

/** The answer of a chat operation of the prototype, or null when the operation is not a chat one. */
export const chatAnswerOf = (operationName: string, variables: Variables): Record<string, unknown> | null =>
    CHAT_ANSWERS[operationName]?.(variables) ?? null
