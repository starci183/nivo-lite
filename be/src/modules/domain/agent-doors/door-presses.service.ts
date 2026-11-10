import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import type { DoorName, DoorPress, DoorPressWrite, OptionalDoorPress } from "./agent-doors.contracts"

/** The longest subject a press keeps (an item key, a lead id, a conversation id). */
export const PRESS_SUBJECT_MAX = 300

/** The most presses one read lists. */
export const PRESSES_MAX = 200

const INSERT_SQL =
    "INSERT INTO public.agent_door_presses (workspace_id, door, subject, member_id, outcome, detail) " +
    "VALUES ($1, $2, $3, $4, $5, $6::jsonb)"

/** The last press on one subject: the index `agent_door_presses_subject` (workspace_id, door, subject, pressed_at desc). */
const LATEST_SQL =
    "SELECT door, subject, member_id, outcome, detail, pressed_at FROM public.agent_door_presses " +
    "WHERE workspace_id = $1 AND door = $2 AND subject = $3 ORDER BY pressed_at DESC LIMIT 1"

/** The newest presses of a door: the index `agent_door_presses_recent` (workspace_id, door, pressed_at desc). */
const RECENT_SQL =
    "SELECT door, subject, member_id, outcome, detail, pressed_at FROM public.agent_door_presses " +
    "WHERE workspace_id = $1 AND door = $2 ORDER BY pressed_at DESC LIMIT $3"

const DOORS: ReadonlyArray<DoorName> = ["schedule.run_now", "care.opt_out", "conversation.release"]

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** A press as its row holds it, or null for a row that is not one. */
export const pressOfRow = (row: unknown): OptionalDoorPress => {
    if (!isRecord(row)) return null
    const door = DOORS.find((one) => one === row.door)
    const subject = textOf(row.subject)
    const memberId = textOf(row.member_id)
    const outcome = textOf(row.outcome)
    const at = row.pressed_at instanceof Date ? row.pressed_at : new Date(String(row.pressed_at))
    if (door === undefined || subject === null || memberId === null || outcome === null || Number.isNaN(at.getTime())) return null
    const memberName = isRecord(row.detail) ? (textOf(row.detail.memberName) ?? memberId) : memberId
    return { door, subject, memberId, memberName, outcome, at }
}

const pressesOf = (rows: unknown): ReadonlyArray<DoorPress> =>
    (Array.isArray(rows) ? rows : []).flatMap((row) => pressOfRow(row) ?? [])

@Injectable()
/**
 * The one writer and reader of `agent_door_presses`: who pressed an owner's door onto the agents' work (run a timer now, set a
 * customer's care opt-out, hand a conversation back), when, on what, and what it came to. The doors act through the engine's own paths;
 * this only remembers the person and the moment. Every read is served by one of the table's two indexes.
 */
export class DoorPressesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Writes one press. */
    async record(press: DoorPressWrite): Promise<void> {
        const detail = { ...press.detail, memberName: press.memberName.slice(0, 200) }
        await this.entityManager.query(INSERT_SQL, [
            press.workspaceId,
            press.door,
            press.subject.slice(0, PRESS_SUBJECT_MAX),
            press.memberId,
            press.outcome,
            JSON.stringify(detail),
        ])
    }

    /** The last press on one subject of a door, or null. */
    async latest(workspaceId: string, door: DoorName, subject: string): Promise<OptionalDoorPress> {
        const rows: unknown = await this.entityManager.query(LATEST_SQL, [workspaceId, door, subject.slice(0, PRESS_SUBJECT_MAX)])
        return pressesOf(rows).at(0) ?? null
    }

    /** The newest presses of a door of the workspace, newest first, at most `limit` (bounded by `PRESSES_MAX`). */
    async recent(workspaceId: string, door: DoorName, limit: number): Promise<ReadonlyArray<DoorPress>> {
        const rows: unknown = await this.entityManager.query(RECENT_SQL, [
            workspaceId,
            door,
            Math.min(Math.max(limit, 1), PRESSES_MAX),
        ])
        return pressesOf(rows)
    }
}
