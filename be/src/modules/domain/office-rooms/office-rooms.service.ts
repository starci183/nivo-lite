import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ChatActivityService } from "@modules/domain/chat-activity"
import { isOfficeRoomKey, OfficeCardsService } from "@modules/domain/messages"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog, type Locale, type MessageCatalog } from "@modules/platform/i18n"
import { OfficeRoomsError, OfficeRoomsErrorCode } from "./errors/office-rooms.error"
import type { RoomChoice, RoomView } from "./office-rooms.contracts"
import { OfficeRoomMembersService } from "./office-room-members.service"
import { OfficeRoomReadsService } from "./office-room-reads.service"

/** Only owners and managers open the department rooms of a workspace. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]
/** The read marker key of the general Office room. */
const OFFICE_READ_KEY = ""

/** The function that records a read marker, and the one that opens the rooms of a workspace. */
const MARK_READ = "public.mark_office_room_read"
const ENSURE_ROOMS = "public.ensure_office_rooms"

@Injectable()
/** The Hub rooms: the general Office room first, then the department rooms, each with the caller's unread count. */
export class OfficeRoomsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly cards: OfficeCardsService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly activity: ChatActivityService,
        private readonly reads: OfficeRoomReadsService,
        private readonly seats: OfficeRoomMembersService,
    ) {}

    /** The rooms the caller sees; a workspace without department rooms answers the Office room alone. */
    async rooms(principalId: string, workspaceId: string): Promise<ReadonlyArray<RoomView>> {
        const member = await this.members.require(principalId, workspaceId)
        const [summary, rows] = await Promise.all([
            this.reads.summary(workspaceId, member.userId, member.displayName),
            this.reads.rooms(workspaceId, member.userId, member.displayName),
        ])
        const memberViews = await this.seats.read(
            workspaceId,
            rows.map((row) => row.key),
        )
        const emptyMembers = { count: 0, preview: [] }
        const office: RoomView = {
            ...summary,
            key: null,
            name: "",
            position: 0,
            agent_ids: [],
            home_agent_ids: [],
            user_ids: [],
            pins: [],
            members: memberViews.get(null) ?? emptyMembers,
        }
        return [office, ...rows.map((row): RoomView => ({ ...row, members: memberViews.get(row.key) ?? emptyMembers }))]
    }

    /** Marks a room (null = the Office room) read by the caller up to now. */
    async markRead(principalId: string, workspaceId: string, room: RoomChoice): Promise<void> {
        const member = await this.members.require(principalId, workspaceId)
        if (room !== null && !isOfficeRoomKey(room))
            throw new OfficeRoomsError({ code: OfficeRoomsErrorCode.RoomInvalid, params: { room } })
        await callDbFunction(this.entityManager, MARK_READ, [workspaceId, member.userId, room ?? OFFICE_READ_KEY])
        const target = `room:${room ?? "office"}`
        await this.activity.receipt(workspaceId, target)
        await this.activity.unread(workspaceId, target, member.userId)
    }

    /** Opens the six department rooms of the workspace and seats its active agents; running it again changes nothing. */
    async setup(principalId: string, workspaceId: string, locale: Locale): Promise<ReadonlyArray<RoomView>> {
        await this.members.require(principalId, workspaceId, MANAGERS)
        const [row] = await callDbFunction<{ ensure_office_rooms: number }>(this.entityManager, ENSURE_ROOMS, [
            workspaceId,
        ])
        const rooms = await this.rooms(principalId, workspaceId)
        if ((row?.ensure_office_rooms ?? 0) > 0) await this.announce(workspaceId, rooms, locale)
        return rooms
    }

    /** Posts the NIVO note that the department rooms are open, in the Office room. */
    private async announce(workspaceId: string, rooms: ReadonlyArray<RoomView>, locale: Locale): Promise<void> {
        const names = rooms
            .filter((room) => room.key !== null)
            .map((room) => room.name)
            .join(", ")
        const title = this.catalog.get("officeRooms.openedTitle", {}, locale)
        await this.cards.post(
            { workspaceId },
            {
                room: null,
                agentId: null,
                authorName: "NIVO",
                body: title,
                leadId: null,
                workItemId: null,
                card: {
                    v: 1,
                    type: "handoff_note",
                    title,
                    body: this.catalog.get("officeRooms.openedBody", { names }, locale),
                },
            },
        )
    }
}
