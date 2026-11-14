import { CRITIC_CAPS, type CriticKind, type CriticPoint, type CriticQuote, type CritiqueInput } from "./document-critic.contracts"

/** What the rules found, and what the per-kind bound rolled up. */
export interface RuleCritique {
    /** The points, each once: at most `rulePointsPerKind` of a kind one by one, then its roll-up points. */
    readonly points: ReadonlyArray<CriticPoint>
    /** Per kind, how many points were rolled up into "N more of this kind"; empty when none. */
    readonly capped: ReadonlyArray<{ readonly kind: CriticKind; readonly left: number }>
}

/** What the subject of a roll-up point starts with ("N more of this kind"). */
export const MORE_SUBJECT = "more:"

const RANK: Readonly<Record<CriticPoint["severity"], number>> = { high: 0, medium: 1, low: 2 }

const chunksOf = <T>(items: ReadonlyArray<T>, size: number): Array<ReadonlyArray<T>> =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))

/**
 * The roll-up points of the points of one kind beyond the bound: "N more of this kind", each quoting one line of up to
 * `rollUpPassages` of their passages and carrying the highest severity among the points it stands for. Every passage of a rolled-up
 * point is quoted by one roll-up, so a holding severity still holds it. No choice: the founder corrects the document, or skips.
 */
const rollUps = (
    say: CritiqueInput["say"],
    kind: CriticKind,
    rest: ReadonlyArray<CriticPoint>,
): ReadonlyArray<CriticPoint> => {
    const shown = CRITIC_CAPS.rulePointsPerKind
    const byPassage = new Map<string, { readonly quote: CriticQuote; readonly points: Array<CriticPoint> }>()
    for (const point of rest) {
        const quote = point.quotes.find((one) => one.role === "this")
        if (quote === undefined) continue
        const key = quote.chunkHash ?? quote.text
        const held = byPassage.get(key) ?? { quote: { ...quote, factId: null }, points: [] }
        held.points.push(point)
        byPassage.set(key, held)
    }
    return chunksOf([...byPassage.values()], CRITIC_CAPS.rollUpPassages).map((group, index): CriticPoint => {
        const points = group.flatMap((one) => one.points)
        const count = String(points.length)
        return {
            kind,
            origin: "rule",
            severity: [...points].sort((a, b) => RANK[a.severity] - RANK[b.severity])[0]?.severity ?? "low",
            subject: `${MORE_SUBJECT}${String(index)}`,
            line: say("more.line", { count }),
            why: say("more.why", { count, shown: String(shown) }),
            question: say("more.question"),
            quotes: group.map((one) => one.quote),
            against: null,
            choices: [],
        }
    })
}

/**
 * Bounds the rule points of each kind (D-N-4): the first `rulePointsPerKind`, the holding ones first and then in document order,
 * stand one by one; the rest become roll-up points.
 */
export const boundedPoints = (say: CritiqueInput["say"], points: ReadonlyArray<CriticPoint>): RuleCritique => {
    const byKind = new Map<CriticKind, Array<CriticPoint>>()
    for (const point of points) byKind.set(point.kind, [...(byKind.get(point.kind) ?? []), point])
    const kept: Array<CriticPoint> = []
    const capped: Array<{ readonly kind: CriticKind; readonly left: number }> = []
    for (const [kind, all] of byKind) {
        if (all.length <= CRITIC_CAPS.rulePointsPerKind) {
            kept.push(...all)
            continue
        }
        const ranked = all.map((point, order) => ({ point, order })).sort((a, b) => RANK[a.point.severity] - RANK[b.point.severity] || a.order - b.order)
        const shown = ranked.slice(0, CRITIC_CAPS.rulePointsPerKind).map((one) => one.point)
        const rest = ranked.slice(CRITIC_CAPS.rulePointsPerKind).map((one) => one.point)
        kept.push(...shown, ...rollUps(say, kind, rest))
        capped.push({ kind, left: rest.length })
    }
    return { points: kept, capped }
}
