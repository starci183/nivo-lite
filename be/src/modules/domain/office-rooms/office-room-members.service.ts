import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { RoomMemberPreviewView, RoomMembersView } from "./office-rooms.contracts"
import { OfficeRoomEntity, OfficeRoomMemberEntity } from "./persistence/entities"

/** The Auth-side function that answers the profile photos of accounts. */
const AVATARS = "be_access.workspace_member_avatars"
/** How many members a room previews. */
const PREVIEW_SIZE = 4
/** The sortable text of a creation instant: digits only, fixed width, microsecond exact, so text order is time order. */
const SORTABLE_AT = "to_char(%s AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS')"

/** The count a grouped or plain count read answers. */
interface CountFacts {
    /** The room key; absent for an ungrouped count. */
    readonly key?: string
    /** How many seats. */
    readonly count: number
}

/** One seat read for a preview, a person or an agent. */
interface SeatFacts {
    /** The room key; absent for the Office room. */
    readonly key?: string
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
    if (left.kind === right.kind) return 0
    return left.kind < right.kind ? -1 : 1
}

/** The first four seats of the people and the agents of one group, in preview order. */
const firstSeats = ({ humans, agents }: GroupSeats): ReadonlyArray<KindedSeat> =>
    [
        ...humans.map((seat): KindedSeat => ({ kind: "human", seat })),
        ...agents.map((seat): KindedSeat => ({ kind: "agent", seat })),
    ]
        .sort(bySeatOrder)
        .slice(0, PREVIEW_SIZE)

/** Groups seats by their room key; the Office room's seats carry no key. */
const groupByKey = (seats: ReadonlyArray<SeatFacts>): ReadonlyMap<string | null, ReadonlyArray<SeatFacts>> => {
    const grouped = new Map<string | null, Array<SeatFacts>>()
    for (const seat of seats) {
        const key = seat.key ?? null
        grouped.set(key, [...(grouped.get(key) ?? []), seat])
    }
    return grouped
}

/** The counts of a grouped read by room key. */
const countsByKey = (counts: ReadonlyArray<CountFacts>): ReadonlyMap<string, number> =>
    new Map(counts.flatMap((fact) => (fact.key === undefined ? [] : [[fact.key, fact.count] as const])))

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
/** The member counts and four-seat previews of the Hub rooms, read in one snapshot. */
export class OfficeRoomMembersService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The Office room (key null) and each given department key with its full member count and its first four members. The
     * general Office room holds every active account and every agent; a department holds its seated active accounts and
     * agents, and the active owners and managers when it seats no active account. Only the previewed accounts reach Auth.
     */
    read(workspaceId: string, keys: ReadonlyArray<string>): Promise<ReadonlyMap<string | null, RoomMembersView>> {
        return this.entityManager.transaction("REPEATABLE READ", async (manager) => {
            const office = await this.officeGroup(workspaceId, manager)
            const departments = keys.length === 0 ? [] : await this.departmentGroups(workspaceId, keys, manager)
            const groups = [office, ...departments]
            const previewed = groups.flatMap(({ seats }) => firstSeats(seats))
            const photos = await this.photosOf(
                workspaceId,
                previewed.filter(({ kind }) => kind === "human").map(({ seat }) => seat.id),
                manager,
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
        })
    }

    /** The Office room: every active account and every agent of the workspace. */
    private async officeGroup(workspaceId: string, manager: EntityManager): Promise<MemberGroup> {
        const people = (): SelectQueryBuilder<object> =>
            manager
                .createQueryBuilder()
                .from("public.workspace_members", "m")
                .where("m.workspace_id = :workspaceId AND m.status = 'active'", { workspaceId })
        const agents = (): SelectQueryBuilder<object> =>
            manager
                .createQueryBuilder()
                .from("public.agents", "a")
                .where("a.workspace_id = :workspaceId", { workspaceId })
        const humanCount = await people().select("count(*)::int", "count").getRawOne<CountFacts>()
        const agentCount = await agents().select("count(*)::int", "count").getRawOne<CountFacts>()
        const humans = await people()
            .select("m.id", "seat_id")
            .addSelect("m.user_id", "id")
            .addSelect("m.display_name", "name")
            .addSelect(atOf("m.created_at"), "at")
            .orderBy("m.created_at")
            .addOrderBy("m.id")
            .limit(PREVIEW_SIZE)
            .getRawMany<SeatFacts>()
        const agentSeats = await agents()
            .select("a.id", "seat_id")
            .addSelect("a.id", "id")
            .addSelect("a.name", "name")
            .addSelect("a.module", "module")
            .addSelect("a.avatar_url", "avatar_url")
            .addSelect(atOf("a.created_at"), "at")
            .orderBy("a.created_at")
            .addOrderBy("a.id")
            .limit(PREVIEW_SIZE)
            .getRawMany<SeatFacts>()
        return {
            key: null,
            count: (humanCount?.count ?? 0) + (agentCount?.count ?? 0),
            seats: { humans, agents: agentSeats },
        }
    }

    /** The department rooms: seated accounts (or the owners and managers when none are seated) plus seated agents. */
    private async departmentGroups(
        workspaceId: string,
        keys: ReadonlyArray<string>,
        manager: EntityManager,
    ): Promise<ReadonlyArray<MemberGroup>> {
        const params = { workspaceId, keys }
        const seated = (): SelectQueryBuilder<object> =>
            manager
                .createQueryBuilder(OfficeRoomEntity, "r")
                .innerJoin(OfficeRoomMemberEntity, "rm", "rm.room_id = r.id")
                .where("r.workspace_id = :workspaceId AND r.key IN (:...keys)", params)
        const people = (): SelectQueryBuilder<object> =>
            seated().innerJoin(
                "workspace_members",
                "m",
                "m.user_id = rm.user_id AND m.workspace_id = r.workspace_id AND m.status = 'active'",
            )
        const agents = (): SelectQueryBuilder<object> =>
            seated().innerJoin("agents", "a", "a.id = rm.agent_id AND a.workspace_id = r.workspace_id")
        const stewards = (): SelectQueryBuilder<object> =>
            manager
                .createQueryBuilder()
                .from("public.workspace_members", "m")
                .where("m.workspace_id = :workspaceId AND m.status = 'active' AND m.role IN ('owner', 'manager')", {
                    workspaceId,
                })
        const humanCounts = countsByKey(
            await people()
                .select("r.key", "key")
                .addSelect("count(*)::int", "count")
                .groupBy("r.key")
                .getRawMany<CountFacts>(),
        )
        const agentCounts = countsByKey(
            await agents()
                .select("r.key", "key")
                .addSelect("count(*)::int", "count")
                .groupBy("r.key")
                .getRawMany<CountFacts>(),
        )
        const stewardCount = await stewards().select("count(*)::int", "count").getRawOne<CountFacts>()
        const humanSeats = groupByKey(
            await this.firstPerRoom(
                people()
                    .select("r.key", "key")
                    .addSelect("rm.id", "seat_id")
                    .addSelect("m.user_id", "id")
                    .addSelect("m.display_name", "name")
                    .addSelect(atOf("rm.created_at"), "at")
                    .addSelect("row_number() OVER (PARTITION BY r.key ORDER BY rm.created_at, rm.id)", "position"),
                manager,
            ),
        )
        const agentSeats = groupByKey(
            await this.firstPerRoom(
                agents()
                    .select("r.key", "key")
                    .addSelect("rm.id", "seat_id")
                    .addSelect("a.id", "id")
                    .addSelect("a.name", "name")
                    .addSelect("a.module", "module")
                    .addSelect("a.avatar_url", "avatar_url")
                    .addSelect(atOf("rm.created_at"), "at")
                    .addSelect("row_number() OVER (PARTITION BY r.key ORDER BY rm.created_at, rm.id)", "position"),
                manager,
            ),
        )
        const stewardSeats = await stewards()
            .select("m.id", "seat_id")
            .addSelect("m.user_id", "id")
            .addSelect("m.display_name", "name")
            .addSelect(atOf("m.created_at"), "at")
            .orderBy("m.created_at")
            .addOrderBy("m.id")
            .limit(PREVIEW_SIZE)
            .getRawMany<SeatFacts>()
        return keys.map((key): MemberGroup => {
            const seatedPeople = humanCounts.get(key) ?? 0
            const people = seatedPeople > 0 ? (humanSeats.get(key) ?? []) : stewardSeats
            return {
                key,
                count: (seatedPeople > 0 ? seatedPeople : (stewardCount?.count ?? 0)) + (agentCounts.get(key) ?? 0),
                seats: { humans: people, agents: agentSeats.get(key) ?? [] },
            }
        })
    }

    /** The first four ranked seats of each room: the ranked read becomes a sub query and is cut at the preview size. */
    private firstPerRoom(ranked: SelectQueryBuilder<object>, manager: EntityManager): Promise<Array<SeatFacts>> {
        return manager
            .createQueryBuilder()
            .select("ranked.*")
            .from(`(${ranked.getQuery()})`, "ranked")
            .setParameters(ranked.getParameters())
            .where("ranked.position <= :previewSize", { previewSize: PREVIEW_SIZE })
            .orderBy("ranked.key")
            .addOrderBy("ranked.position")
            .getRawMany<SeatFacts>()
    }

    /** The profile photos of the previewed accounts, keyed by account id. */
    private async photosOf(
        workspaceId: string,
        accountIds: ReadonlyArray<string>,
        manager: EntityManager,
    ): Promise<ReadonlyMap<string, string | null>> {
        if (accountIds.length === 0) return new Map()
        const rows = await callDbFunction<{ id: string; avatar_url: string | null }>(manager, AVATARS, [
            workspaceId,
            [...new Set(accountIds)],
        ])
        return new Map(rows.map((row) => [row.id, row.avatar_url]))
    }
}
