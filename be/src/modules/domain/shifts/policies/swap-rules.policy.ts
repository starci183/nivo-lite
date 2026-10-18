import type { Env, Setup, Shift, ShiftStaff, SwapFinding } from "../shifts.contracts"
import { instantOf, toMin } from "./time.policy"
import { segOf, violationsForSegs } from "./work-rules.policy"

const HOUR_MS = 3_600_000

/** A shift is on the wall only once published (or after a swap). */
const POSTED: ReadonlySet<string> = new Set(["published", "swapped"])

/** What a swap or claim asks for. */
export interface SwapAsk {
    /** swap: a person hands a shift over; claim: a person takes an open shift. */
    readonly kind: "swap" | "claim"
    /** The person who hands the shift over, null for a claim. */
    readonly fromStaffId: string | null
    /** The person who takes the shift. */
    readonly toStaffId: string
}

/** The facts a swap or claim is checked against. */
export interface SwapCheck {
    /** The request. */
    readonly ask: SwapAsk
    /** The shift, or undefined when it does not exist. */
    readonly shift: Shift | undefined
    /** The shop setup. */
    readonly setup: Setup
    /** The rules environment of the shift's week. */
    readonly env: Env
    /** The posted shifts the person who takes the shift already works that week. */
    readonly mine: ReadonlyArray<Shift>
    /** The moment of the check. */
    readonly now: Date
}

const finding = (code: string, params: Readonly<Record<string, string | number>> = {}): SwapFinding => ({
    code,
    params,
})

/** The findings about the shift itself: it exists, is posted and still belongs to the person who offers it. */
const shiftFindings = (ask: SwapAsk, shift: Shift | undefined): Array<SwapFinding> => {
    if (shift === undefined) return [finding("shift-missing")]
    return [
        ...(POSTED.has(shift.status) ? [] : [finding("not-posted")]),
        ...(ask.kind === "swap" && shift.staffId !== ask.fromStaffId ? [finding("not-owner")] : []),
        ...(ask.kind === "claim" && shift.staffId !== null ? [finding("taken")] : []),
    ]
}

/** The findings about timing: the shift has not started and the notice is long enough. */
const noticeFindings = (shift: Shift, setup: Setup, now: Date): Array<SwapFinding> => {
    const startsAt = instantOf(shift.date, toMin(shift.start)).getTime()
    if (startsAt < now.getTime()) return [finding("started")]
    const hours = setup.settings.swapNoticeHours
    return (startsAt - now.getTime()) / HOUR_MS < hours ? [finding("notice", { hours })] : []
}

/** The findings about the rules of the person who takes the shift: position and every work rule but the position one. */
const takerFindings = (check: SwapCheck, shift: Shift, taker: ShiftStaff): Array<SwapFinding> => {
    const position = check.setup.positions.find((item) => item.id === shift.positionId)?.name ?? ""
    const segs = [...check.mine.map(segOf), segOf(shift)]
    const kinds = new Set(
        violationsForSegs(check.env, taker.id, segs)
            .flat()
            .map((violation) => violation.kind),
    )
    return [
        ...(taker.positionIds.includes(shift.positionId) ? [] : [finding("position", { name: taker.name, position })]),
        ...[...kinds]
            .filter((kind) => kind !== "position")
            .map((kind) => finding(`rule-${kind}`, { name: taker.name })),
    ]
}

/** What breaks if the person takes the shift; empty means it stays inside the rules. */
export const swapFindings = (check: SwapCheck): Array<SwapFinding> => {
    const { ask, shift, setup, now } = check
    const base = shiftFindings(ask, shift)
    if (shift === undefined) return base
    const taker = setup.staff.find((person) => person.id === ask.toStaffId)
    if (!taker?.active) return [...base, finding("taker-gone")]
    return [...base, ...noticeFindings(shift, setup, now), ...takerFindings(check, shift, taker)]
}

/** The people who could cover a shift right now: qualified, free and inside every rule. */
export const coverCandidates = (
    setup: Setup,
    env: Env,
    shift: Shift,
    sameWeek: ReadonlyArray<Shift>,
    exclude: ReadonlyArray<string>,
): Array<ShiftStaff> =>
    setup.staff.filter((person) => {
        if (!person.active || exclude.includes(person.id) || !person.positionIds.includes(shift.positionId))
            return false
        const segs = [
            ...sameWeek.filter((other) => other.staffId === person.id && other.id !== shift.id).map(segOf),
            segOf(shift),
        ]
        return !violationsForSegs(env, person.id, segs).some((list) => list.length > 0)
    })
