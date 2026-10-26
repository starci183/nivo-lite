import { OfficeRoomsService } from "@modules/domain/office-rooms"
import {
    officeDirectUnreadIdentity,
    persistOfficeDirectUnread,
} from "../../fixtures/builders/office-direct-unread.builder"
import { CLEAN_USERS } from "../../fixtures/persistence/office-chain.sql"
import {
    CLEAN_AGENT_CHAT,
    CLEAN_AGENTS,
    CLEAN_LEADS,
    CLEAN_MEMBERS,
    CLEAN_MESSAGES,
    CLEAN_READS,
    CLEAN_WORKSPACES,
    MARKERS_OF,
} from "../../fixtures/persistence/office-direct-unread.sql"
import { OfficeRoomMembersProofModule } from "../../world/office-room-members-proof.module"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: [OfficeRoomMembersProofModule.register()] })
/** The newest line a row previews, as the caller draws it. */
const lastLine = (authorId?: string | null): unknown =>
    expect.objectContaining({ body: "line from Owner Person", ...(authorId === undefined ? {} : { authorId }) })

const identity = officeDirectUnreadIdentity(() => world.id())

beforeAll(async () => {
    world.cleanup(async () => {
        const workspaces = [identity.workspaceId, identity.foreignWorkspaceId]
        await world.db.primary.query(CLEAN_MESSAGES, [workspaces])
        await world.db.primary.query(CLEAN_AGENT_CHAT, [workspaces])
        await world.db.primary.query(CLEAN_READS, [workspaces])
        await world.db.primary.query(CLEAN_AGENTS, [[...identity.agentIds]])
        await world.db.primary.query(CLEAN_LEADS, [[...identity.leadIds]])
        // Cascade clears the seated owners; the last-owner guard only bars lone deletes.
        await world.db.primary.query(CLEAN_WORKSPACES, [workspaces])
        await world.db.primary.query(CLEAN_MEMBERS, [workspaces])
        await world.db.primary.query(CLEAN_USERS, [[identity.ownerId, identity.foreignUserId]])
    })
    await persistOfficeDirectUnread(world.db.primary, identity)
})

describe("direct conversation unread over PostgreSQL", () => {
    it("counts foreign-authored lines per agent and lead, recognising the caller by account id and not by display name", async () => {
        const rooms = world.resolve(OfficeRoomsService)
        const unread = await rooms.unread(identity.ownerId, identity.workspaceId)

        expect(unread).toEqual({
            agents: [
                // Three counted lines; the newest line is the caller's own, still drawn as the row's preview.
                {
                    id: identity.agentIds[0],
                    unread: 3,
                    last: lastLine(null),
                },
                // The chatbot line and the homonym account count; the renamed own line (account id) and the legacy own line (name) do not.
                {
                    id: identity.agentIds[1],
                    unread: 2,
                    last: lastLine(identity.foreignUserId),
                },
            ],
            leads: [{ id: identity.leadIds[0], unread: 2 }],
        })
        // The second lead and every foreign row stay silent.
        expect(unread.agents.map((entry) => entry.id)).not.toContain(identity.agentIds[2])
        expect(unread.leads.map((entry) => entry.id)).not.toContain(identity.leadIds[1])
        expect(unread.leads.map((entry) => entry.id)).not.toContain(identity.leadIds[2])
    })
})

describe("direct conversation read markers over PostgreSQL", () => {
    it("marks an agent conversation read and clears its badge only", async () => {
        const rooms = world.resolve(OfficeRoomsService)
        await rooms.markConversationRead(identity.ownerId, identity.workspaceId, "agent", identity.agentIds[0])

        const unread = await rooms.unread(identity.ownerId, identity.workspaceId)
        expect(unread).toEqual({
            // A read conversation keeps its newest line for the row's preview and shows no badge.
            agents: [
                {
                    id: identity.agentIds[0],
                    unread: 0,
                    last: lastLine(),
                },
                {
                    id: identity.agentIds[1],
                    unread: 2,
                    last: lastLine(),
                },
            ],
            leads: [{ id: identity.leadIds[0], unread: 2 }],
        })
        expect(
            await world.db.primary.query(MARKERS_OF, [identity.workspaceId, `agent:${identity.agentIds[0]}`]),
        ).toEqual([{ n: 1 }])
    })

    it("marks a customer conversation read", async () => {
        const rooms = world.resolve(OfficeRoomsService)
        await rooms.markConversationRead(identity.ownerId, identity.workspaceId, "lead", identity.leadIds[0])

        expect(await rooms.unread(identity.ownerId, identity.workspaceId)).toEqual({
            agents: [
                {
                    id: identity.agentIds[0],
                    unread: 0,
                    last: lastLine(),
                },
                {
                    id: identity.agentIds[1],
                    unread: 2,
                    last: lastLine(),
                },
            ],
            leads: [],
        })
        expect(await world.db.primary.query(MARKERS_OF, [identity.workspaceId, `lead:${identity.leadIds[0]}`])).toEqual(
            [{ n: 1 }],
        )
    })

    it("refuses a kind that is not a direct conversation and writes no marker", async () => {
        const rooms = world.resolve(OfficeRoomsService)
        await expect(
            rooms.markConversationRead(identity.ownerId, identity.workspaceId, "room", "sales"),
        ).rejects.toMatchObject({ code: "OFFICE_ROOMS_CONVERSATION_INVALID", params: { id: "sales" } })
        expect(await world.db.primary.query(MARKERS_OF, [identity.workspaceId, "room:sales"])).toEqual([{ n: 0 }])
    })

    it("refuses a conversation of a foreign workspace and writes no marker for it", async () => {
        const rooms = world.resolve(OfficeRoomsService)
        await expect(
            rooms.markConversationRead(identity.ownerId, identity.workspaceId, "agent", identity.agentIds[2]),
        ).rejects.toMatchObject({
            code: "OFFICE_ROOMS_CONVERSATION_INVALID",
            params: { id: identity.agentIds[2] },
        })
        expect(
            await world.db.primary.query(MARKERS_OF, [identity.workspaceId, `agent:${identity.agentIds[2]}`]),
        ).toEqual([{ n: 0 }])
    })

    it("rejects a caller outside the workspace without reading or writing", async () => {
        const rooms = world.resolve(OfficeRoomsService)
        await expect(rooms.unread(identity.foreignUserId, identity.workspaceId)).rejects.toThrow()
        await expect(
            rooms.markConversationRead(identity.foreignUserId, identity.workspaceId, "agent", identity.agentIds[0]),
        ).rejects.toThrow()
    })
})
