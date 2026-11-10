import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectChannelProvisioningOptions } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import type { ChatSeedMessage, ChatSeedRoom, ChatSeedWho } from "./chat-seed.contracts"
import { instantsOf, readChatSeedRooms } from "./chat-seed.policy"

/** The most workspaces looked through for the named one, and the most members read. */
const WORKSPACE_SCAN_LIMIT = 1000
const MEMBER_SCAN_LIMIT = 200

/**
 * The statements of the seed, as plain text: a row that is there already is kept, so a rerun writes nothing twice; only a seat's right to
 * post follows the document, so the seed grants or takes back that right on a database it seeded before.
 */
export const INSERT_ROOM =
    "INSERT INTO public.chat_rooms (id, workspace_id, kind, name, purpose, purpose_module, created_by) VALUES ($1, $2, 'group', $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING"
export const INSERT_SEAT =
    "INSERT INTO public.chat_room_members (room_id, workspace_id, member_kind, member_id, role, may_post) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (room_id, member_kind, member_id) DO UPDATE SET may_post = EXCLUDED.may_post"
export const INSERT_LINE =
    "INSERT INTO public.chat_room_messages (id, room_id, workspace_id, author_kind, author_id, body, kind, ref, client_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, 'text', $7::jsonb, $8, $9) ON CONFLICT DO NOTHING"

/** A person or an agent of the workspace as a seat of a room and the author of a line. */
interface Seat {
    readonly kind: "user" | "agent"
    readonly id: string
}

const refused = (field: string): ConnectionsError =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

const keyOf = (who: ChatSeedWho): string => ("agent" in who ? `agent:${who.agent}` : `role:${who.role}`)

/** The id of a seeded line: stable from its room and key, shaped as a version 5 uuid. */
const lineIdOf = (roomId: string, key: string): string => {
    const hex = createHash("sha1").update(`${roomId}:${key}`).digest("hex")
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

@Injectable()
/**
 * The seed of the group rooms of a workspace chat: each room, its members and its lines are written under the ids the document gives
 * (a line's id comes from its room and key), so a rerun finds what it wrote and adds nothing. People are named by role and agents by
 * module, never by id. A person or agent the workspace does not have is left out with its lines. It prints what it did, never a line.
 */
export class ChatSeedService {
    constructor(
        @InjectChannelProvisioningOptions() private readonly options: ChannelProvisioningOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly agents: AgentDirectoryService,
        private readonly members: WorkspaceMembersReadService,
        private readonly workspaces: WorkspacesService,
    ) {}

    /** Seeds the rooms of the envelope read from `text` into the workspace named `workspaceName`; a refused document stops the run. */
    async run(text: string, workspaceName: string): Promise<void> {
        const rooms = readChatSeedRooms(text)
        const workspaceId = await this.workspaceOf(workspaceName)
        const owner = await this.seatOf(workspaceId, { role: "owner" })
        if (owner === null) throw refused("owner")
        await eachInOrder(rooms, async (room) => {
            await this.entityManager.transaction((manager) => this.write(manager, workspaceId, owner, room))
            this.options.print(`chat ${room.id} saved`)
        })
    }

    private async write(manager: EntityManager, workspaceId: string, owner: Seat, room: ChatSeedRoom): Promise<void> {
        await manager.query(INSERT_ROOM, [room.id, workspaceId, room.name, room.purpose, room.module, owner.id])
        const seats = new Map<string, Seat>()
        const posters = new Set<string>()
        await eachInOrder(room.members, async (who) => {
            const seat = await this.seatOf(workspaceId, who)
            if (seat !== null) seats.set(keyOf(who), seat)
            if (seat !== null && "agent" in who && who.mayPost === true) posters.add(seat.id)
        })
        await eachInOrder([...seats.values()], (seat) =>
            manager.query(INSERT_SEAT, [
                room.id,
                workspaceId,
                seat.kind,
                seat.id,
                seat.id === owner.id ? "owner" : "member",
                posters.has(seat.id),
            ]),
        )
        const lines = room.messages.filter((message) => seats.has(keyOf(message.from)))
        const at = instantsOf(lines, this.clock.now())
        await eachInOrder(lines, async (line, index) => {
            const author = seats.get(keyOf(line.from))
            const when = at[index]
            if (author !== undefined && when !== undefined)
                await this.writeLine(manager, workspaceId, room.id, author, line, when)
        })
    }

    private async writeLine(
        manager: EntityManager,
        workspaceId: string,
        roomId: string,
        author: Seat,
        line: ChatSeedMessage,
        at: Date,
    ): Promise<void> {
        const ref =
            line.agentMessage === undefined
                ? null
                : JSON.stringify({ agent_message: JSON.stringify(line.agentMessage) })
        await manager.query(INSERT_LINE, [
            lineIdOf(roomId, line.key),
            roomId,
            workspaceId,
            author.kind,
            author.id,
            line.body,
            ref,
            line.key,
            at,
        ])
    }

    private async seatOf(workspaceId: string, who: ChatSeedWho): Promise<Seat | null> {
        if ("agent" in who) {
            const id = await this.agents.firstActiveIdOfModule(workspaceId, who.agent)
            return id === null ? null : { kind: "agent", id }
        }
        const rows = await this.members.directory(workspaceId, MEMBER_SCAN_LIMIT)
        const found = rows.find((row) => row.role === who.role && row.status === "active")
        return found === undefined ? null : { kind: "user", id: found.user_id }
    }

    private async workspaceOf(name: string): Promise<string> {
        const found = (await this.workspaces.list(WORKSPACE_SCAN_LIMIT)).filter((workspace) => workspace.name === name)
        const [only] = found
        if (only === undefined || found.length > 1) throw refused("workspace")
        return only.id
    }
}
