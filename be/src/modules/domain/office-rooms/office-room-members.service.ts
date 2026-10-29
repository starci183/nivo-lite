import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { MemberSeat } from "@modules/domain/workspace-members"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { RoomMemberPreviewView, RoomMembersView } from "./office-rooms.contracts"
import { InjectRoomsAgents } from "./office-rooms.decorators"
import type { RoomAgentSeat, RoomsAgents } from "./office-rooms.port"
import { OfficeRoomEntity, OfficeRoomMemberEntity } from "./persistence/entities"

/** The Auth-side function that answers the profile photos of accounts. */
const AVATARS = "be_access.workspace_member_avatars"
/** How many members a room previews. */
const PREVIEW_SIZE = 4
/** The sortable text of a creation instant: digits only, fixed width, microsecond exact, so text order is time order. */
const SORTABLE_AT = "to_char(%s AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS')"

/** The most seat rows the departments of one read hold in all. */
const SEAT_LIMIT = 2000

/** One seat row of a department room as the room's own tables hold it. */
interface SeatRow {
    /** The room key. */
    readonly key: string
    /** The seat id. */
    readonly seat_id: string
    /** The account seated; null for an agent seat. */
    readonly user_id: string | null
    /** The agent seated; null for a person seat. */
    readonly agent_id: string | null
    /** When the seat was taken, sortable text. */
    readonly at: string
}

/** One seat read for a preview, a person or an agent. */
interface SeatFacts {
    /** The room key; absent for the Office room. */
    readonly key?: string | undefined
    /** The seat id, the second ordering key. */
    readonly seat_id: string
    /** The account id for a person or the agent id. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** The agent's module; null for a person. */
    readonly module: string | null
    /** The agent's own picture; null for a person. */
    readonly avatar_url: string | null
    /** When the seat was taken, sortable text. */
    readonly at: string
}

/** The seats of one group, split by what they are. */
interface GroupSeats {
    /** People. */
    readonly humans: ReadonlyArray<SeatFacts>
    /** Agents. */
    readonly agents: ReadonlyArray<SeatFacts>
}

/** A seat with the kind that decides ties. */
interface KindedSeat {
    /** What the seat holds. */
    readonly kind: "human" | "agent"
    /** The seat. */
    readonly seat: SeatFacts
}

/** The sortable text of a creation column. */
const atOf = (column: string): string => SORTABLE_AT.replace("%s", column)

/** Orders seats by when they were taken, then the seat id, then the kind: the order a room previews them. */
const bySeatOrder = (left: KindedSeat, right: KindedSeat): number => {
    if (left.seat.at !== right.seat.at) return left.seat.at < right.seat.at ? -1 : 1
    if (left.seat.seat_id !== right.seat.seat_id) return left.seat.seat_id < right.seat.seat_id ? -1 : 1
    return left.kind.localeCompare(right.kind)
}

/** The first four seats of the people and the agents of one group, in preview order. */
const firstSeats = ({ humans, agents }: GroupSeats): ReadonlyArray<KindedSeat> =>
    [
        ...humans.map((seat): KindedSeat => ({ kind: "human", seat })),
        ...agents.map((seat): KindedSeat => ({ kind: "agent", seat })),
    ]
        .sort(bySeatOrder)
        .slice(0, PREVIEW_SIZE)

/** Groups seats by their room key. */
const groupByKey = (seats: ReadonlyArray<SeatFacts>): ReadonlyMap<string | undefined, ReadonlyArray<SeatFacts>> => {
    const grouped = new Map<string | undefined, Array<SeatFacts>>()
    for (const seat of seats) grouped.set(seat.key, [...(grouped.get(seat.key) ?? []), seat])
    return grouped
}

/** A person's seat as the preview draws it. */
const humanSeatOf = (
    seat: MemberSeat,
    key?: string,
    taken?: { readonly id: string; readonly at: string },
): SeatFacts => ({
    key,
    seat_id: taken?.id ?? seat.seat_id,
    id: seat.id,
    name: seat.name,
    module: null,
    avatar_url: null,
    at: taken?.at ?? seat.at,
})

/** An agent's seat as the preview draws it. */
const agentSeatOf = (
    seat: RoomAgentSeat,
    key?: string,
    taken?: { readonly id: string; readonly at: string },
): SeatFacts => ({
    key,
    seat_id: taken?.id ?? seat.id,
    id: seat.id,
    name: seat.name,
    module: seat.module,
    avatar_url: seat.avatar_url,
    at: taken?.at ?? seat.at,
})

/** One group of seats with its full count. */
interface MemberGroup {
    /** The room key; null is the general Office room. */
    readonly key: string | null
    /** The full member count. */
    readonly count: number
    /** The first seats of the group, by kind. */
    readonly seats: GroupSeats
}

/** One preview entry: a person keeps the photo the auth side gives, an agent its own picture. */
const previewOf = (
    kind: "human" | "agent",
    seat: SeatFacts,
    photos: ReadonlyMap<string, string | null>,
): RoomMemberPreviewView => ({
    id: seat.id,
    kind,
    module: kind === "agent" ? seat.module : null,
    name: seat.name,
    avatarUrl: kind === "human" ? (photos.get(seat.id) ?? null) : seat.avatar_url,
})

@Injectable()
/** The member counts and four-seat previews of the Hub rooms. */
export class OfficeRoomMembersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly people: WorkspaceMembersReadService,
        @InjectRoomsAgents() private readonly agents: RoomsAgents,
    ) {}

    /**
     * The Office room (key null) and each given department key with its full member count and its first four members. The
     * general Office room holds every active account and every agent; a department holds its seated active accounts and
     * agents, and the active owners and managers when it seats no active account. Only the previewed accounts reach Auth.
     */
    async read(workspaceId: string, keys: ReadonlyArray<string>): Promise<ReadonlyMap<string | null, RoomMembersView>> {
        const office = await this.officeGroup(workspaceId)
        const departments = keys.length === 0 ? [] : await this.departmentGroups(workspaceId, keys)
        const groups = [office, ...departments]
        const previewed = groups.flatMap(({ seats }) => firstSeats(seats))
        const photos = await this.photosOf(
            workspaceId,
            previewed.filter(({ kind }) => kind === "human").map(({ seat }) => seat.id),
        )
        return new Map(
            groups.map(({ key, count, seats }): [string | null, RoomMembersView] => [
                key,
                {
                    count,
                    preview: firstSeats(seats).map(({ kind, seat }) => previewOf(kind, seat, photos)),
                },
            ]),
        )
    }

    /** The Office room: every active account and every agent of the workspace. */
    private async officeGroup(workspaceId: string): Promise<MemberGroup> {
        const [humanCount, agentCount, humans, agentSeats] = await Promise.all([
            this.people.activeCount(workspaceId),
            this.agents.countOf(workspaceId),
            this.people.firstActive(workspaceId, PREVIEW_SIZE),
            this.agents.firstSeats(workspaceId, PREVIEW_SIZE),
        ])
        return {
            key: null,
            count: humanCount + agentCount,
            seats: {
                humans: humans.map((seat) => humanSeatOf(seat)),
                agents: agentSeats.map((seat) => agentSeatOf(seat)),
            },
        }
    }

    /** The department rooms: seated accounts (or the owners and managers when none are seated) plus seated agents. */
    private async departmentGroups(
        workspaceId: string,
        keys: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<MemberGroup>> {
        const rows = await this.seatRows(workspaceId, keys)
        const [accounts, agentCards, stewardCount, stewards] = await Promise.all([
            this.people.activeByUserIds(
                workspaceId,
                rows.flatMap((row) => (row.user_id === null ? [] : [row.user_id])),
            ),
            this.agents.seatsOf(
                workspaceId,
                rows.flatMap((row) => (row.agent_id === null ? [] : [row.agent_id])),
            ),
            this.people.stewardCount(workspaceId),
            this.people.firstStewards(workspaceId, PREVIEW_SIZE),
        ])
        const accountOf = new Map(accounts.map((account) => [account.id, account]))
        const agentOf = new Map(agentCards.map((card) => [card.id, card]))
        const humanSeats = rows.flatMap((row): Array<SeatFacts> => {
            const account = accountOf.get(row.user_id ?? "")
            return account === undefined ? [] : [humanSeatOf(account, row.key, { id: row.seat_id, at: row.at })]
        })
        const agentSeats = rows.flatMap((row): Array<SeatFacts> => {
            const card = agentOf.get(row.agent_id ?? "")
            return card === undefined ? [] : [agentSeatOf(card, row.key, { id: row.seat_id, at: row.at })]
        })
        const humansByKey = groupByKey(humanSeats)
        const agentsByKey = groupByKey(agentSeats)
        const stewardSeats = stewards.map((seat) => humanSeatOf(seat))
        return keys.map((key): MemberGroup => {
            const seatedPeople = humansByKey.get(key) ?? []
            const seatedAgents = agentsByKey.get(key) ?? []
            return {
                key,
                count: (seatedPeople.length > 0 ? seatedPeople.length : stewardCount) + seatedAgents.length,
                seats: {
                    humans: seatedPeople.length > 0 ? seatedPeople.slice(0, PREVIEW_SIZE) : stewardSeats,
                    agents: seatedAgents.slice(0, PREVIEW_SIZE),
                },
            }
        })
    }

    /** The seats of the given department rooms in seat order: by room, then when the seat was taken, then the seat id. */
    private seatRows(workspaceId: string, keys: ReadonlyArray<string>): Promise<Array<SeatRow>> {
        return this.entityManager
            .createQueryBuilder(OfficeRoomEntity, "r")
            .innerJoin(OfficeRoomMemberEntity, "rm", "rm.room_id = r.id")
            .select("r.key", "key")
            .addSelect("rm.id", "seat_id")
            .addSelect("rm.user_id", "user_id")
            .addSelect("rm.agent_id", "agent_id")
            .addSelect(atOf("rm.created_at"), "at")
            .where("r.workspace_id = :workspaceId AND r.key IN (:...keys)", { workspaceId, keys })
            .orderBy("r.key")
            .addOrderBy("rm.created_at")
            .addOrderBy("rm.id")
            .limit(SEAT_LIMIT)
            .getRawMany<SeatRow>()
    }

    /** The profile photos of the previewed accounts, keyed by account id. */
    private async photosOf(
        workspaceId: string,
        accountIds: ReadonlyArray<string>,
    ): Promise<ReadonlyMap<string, string | null>> {
        if (accountIds.length === 0) return new Map()
        const rows = await callDbFunction<{ id: string; avatar_url: string | null }>(this.entityManager, AVATARS, [
            workspaceId,
            [...new Set(accountIds)],
        ])
        return new Map(rows.map((row) => [row.id, row.avatar_url]))
    }
}
