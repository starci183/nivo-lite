import type { Condition, DecidePoint, FactRegistry, GraphBranch } from "../agent-graphs.contracts"

/** A stretch of one number line, each end open or closed. */
export interface Interval {
    /** The lo. */
    readonly lo: number
    /** The lo open. */
    readonly loOpen: boolean
    /** The hi. */
    readonly hi: number
    /** The hi open. */
    readonly hiOpen: boolean
}

/** Two neighbours on the line that leave a hole between them or share a stretch. */
export interface BoundaryFinding {
    /** The kind. */
    readonly kind: "gap" | "overlap"
    /** The before. */
    readonly before: GraphBranch
    /** The after. */
    readonly after: GraphBranch
}

const WHOLE: Interval = { lo: Number.NEGATIVE_INFINITY, loOpen: true, hi: Number.POSITIVE_INFINITY, hiOpen: true }

const oneTerm = (condition: Condition, fact: string): Interval | null => {
    if (
        !("fact" in condition) ||
        condition.fact !== fact ||
        !("value" in condition) ||
        typeof condition.value !== "number"
    )
        return null
    if (condition.op === "lt") return { ...WHOLE, hi: condition.value, hiOpen: true }
    if (condition.op === "lte") return { ...WHOLE, hi: condition.value, hiOpen: false }
    if (condition.op === "gt") return { ...WHOLE, lo: condition.value, loOpen: true }
    if (condition.op === "gte") return { ...WHOLE, lo: condition.value, loOpen: false }
    return condition.op === "eq" ? { lo: condition.value, loOpen: false, hi: condition.value, hiOpen: false } : null
}

/** The tighter of two lower ends; when they tie, the end is open if either is. */
const lowerOf = (left: Interval, right: Interval): Pick<Interval, "lo" | "loOpen"> => {
    if (left.lo === right.lo) return { lo: left.lo, loOpen: left.loOpen || right.loOpen }
    return left.lo > right.lo ? { lo: left.lo, loOpen: left.loOpen } : { lo: right.lo, loOpen: right.loOpen }
}

/** The tighter of two upper ends; when they tie, the end is open if either is. */
const upperOf = (left: Interval, right: Interval): Pick<Interval, "hi" | "hiOpen"> => {
    if (left.hi === right.hi) return { hi: left.hi, hiOpen: left.hiOpen || right.hiOpen }
    return left.hi < right.hi ? { hi: left.hi, hiOpen: left.hiOpen } : { hi: right.hi, hiOpen: right.hiOpen }
}

const meet = (left: Interval, right: Interval): Interval => ({ ...lowerOf(left, right), ...upperOf(left, right) })

/**
 * The stretch of `fact` a condition covers, when it says so with bounds alone: one comparison, or an `all` of them. Anything
 * else (an `any`, a set, another fact in the mix) cannot be placed on the line and answers null, so no gap is claimed about it.
 */
export const intervalOf = (when: Condition | "else", fact: string): Interval | null => {
    if (when === "else") return null
    if ("all" in when) {
        const parts = when.all.map((member) => intervalOf(member, fact))
        const placed = parts.filter((part): part is Interval => part !== null)
        const [first, ...others] = placed
        if (first === undefined || placed.length !== parts.length) return null
        return others.reduce(meet, first)
    }
    return "any" in when ? null : oneTerm(when, fact)
}

/** The largest number the interval reaches, or null when it has no top. */
export const topOf = (interval: Interval): number | null => (Number.isFinite(interval.hi) ? interval.hi : null)

/** True when the interval holds nothing. */
export const isEmpty = (interval: Interval): boolean =>
    interval.lo > interval.hi || (interval.lo === interval.hi && (interval.loOpen || interval.hiOpen))

/** True when `later` starts below where `earlier` ends: the same numbers fall in both. */
const sharesStretch = (earlier: Interval, later: Interval): boolean =>
    later.lo < earlier.hi || (later.lo === earlier.hi && !later.loOpen && !earlier.hiOpen)

/** True when numbers between the end of `earlier` and the start of `later` fall in neither. */
const leavesHole = (earlier: Interval, later: Interval): boolean =>
    earlier.hi < later.lo || (earlier.hi === later.lo && earlier.hiOpen && later.loOpen)

/** The numeric facts of the decide point whose branches can be placed on a line, in the order the decide point lists them. */
export const numericFactsOf = (decide: DecidePoint, registry: FactRegistry): ReadonlyArray<string> =>
    decide.facts.filter((fact) => registry[fact]?.type === "number")

/** The gaps and overlaps between the branches of a decide point over one numeric fact, side by side from the lowest. */
export const boundaryFindings = (decide: DecidePoint, fact: string): ReadonlyArray<BoundaryFinding> => {
    const placed = decide.branches
        .flatMap((branch) => {
            const interval = intervalOf(branch.when, fact)
            return interval === null || isEmpty(interval) ? [] : [{ branch, interval }]
        })
        .sort(
            (left, right) =>
                left.interval.lo - right.interval.lo || Number(left.interval.loOpen) - Number(right.interval.loOpen),
        )
    return placed.slice(1).flatMap((entry, index): ReadonlyArray<BoundaryFinding> => {
        const previous = placed[index]
        if (previous === undefined) return []
        if (sharesStretch(previous.interval, entry.interval))
            return [{ kind: "overlap", before: previous.branch, after: entry.branch }]
        return leavesHole(previous.interval, entry.interval)
            ? [{ kind: "gap", before: previous.branch, after: entry.branch }]
            : []
    })
}
