import type { DatedEvent, ContentSlot } from "./calendar"
import { vnDateKey } from "./time"
import type { ContentChannel, Pillar } from "./types"

/** Narrows an unknown value to a plain object. */
export const isJsonObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Parses text as a JSON object, or returns null. */
const tryParse = (source: string): Record<string, unknown> | null => {
    try {
        const value: unknown = JSON.parse(source)
        return isJsonObject(value) ? value : null
    } catch {
        return null
    }
}

/** Pulls the first JSON object out of a model answer (it may arrive in a code fence or with a sentence around it). */
export const parseJsonObject = (text: string): Record<string, unknown> | null => {
    const body = text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "")
    const direct = tryParse(body)
    if (direct !== null) return direct
    const from = body.indexOf("{")
    const to = body.lastIndexOf("}")
    if (from < 0 || to <= from) return null
    const slice = body.slice(from, to + 1)
    const plain = tryParse(slice)
    if (plain !== null) return plain
    // Models sometimes forget to close a nested object: when braces are unbalanced, close them at the end.
    const open = (slice.match(/\{/g) ?? []).length - (slice.match(/\}/g) ?? []).length
    return open > 0 && open <= 3 ? tryParse(slice + "}".repeat(open)) : null
}

/** One pillar and how many posts it should get. */
export interface PillarShare {
    readonly pillar: Pillar
    readonly count: number
}

/** How many posts each pillar should get out of `total`, by weight (largest remainder). */
export const pillarQuota = (pillars: ReadonlyArray<Pillar>, total: number): Array<PillarShare> => {
    const active = pillars.filter((p) => p.active && p.weight > 0)
    const sum = active.reduce((s, p) => s + p.weight, 0)
    if (active.length === 0 || total <= 0) return []
    const rows = active.map((pillar) => {
        const exact = (pillar.weight / sum) * total
        return { pillar, count: Math.floor(exact), rem: exact - Math.floor(exact) }
    })
    const left = total - rows.reduce((s, r) => s + r.count, 0)
    const bumped = new Set(
        [...rows]
            .sort((a, b) => b.rem - a.rem)
            .slice(0, Math.max(0, left))
            .map((r) => r.pillar.id),
    )
    return rows.map(({ pillar, count }) => ({ pillar, count: bumped.has(pillar.id) ? count + 1 : count }))
}

/** One theme per slot: every theme gets its quota, and the same theme never comes twice in a row while another still has posts left. */
export const themeSequence = (quota: ReadonlyArray<PillarShare>, total: number): Array<Pillar> => {
    const left = quota.map((q) => ({ pillar: q.pillar, n: q.count }))
    return Array.from({ length: total }).reduce<Array<Pillar>>((out) => {
        const prev = out[out.length - 1]
        const cand = left.filter((x) => x.n > 0).sort((a, b) => b.n - a.n)
        const pick = cand.find((x) => x.pillar.id !== prev?.id) ?? cand[0]
        if (pick === undefined) return out
        pick.n -= 1
        return [...out, pick.pillar]
    }, [])
}

/** The posting slots of one moment, with the channels that post then. */
export interface PlanSlot {
    readonly n: number
    readonly at: string
    readonly channels: ReadonlyArray<ContentChannel>
}

/** Groups slots that share a moment, numbered in time order from 1. */
export const groupSlots = (slots: ReadonlyArray<ContentSlot>): Array<PlanSlot> => {
    const by = new Map<string, Array<ContentChannel>>()
    for (const s of slots) by.set(s.at, [...(by.get(s.at) ?? []), s.channel])
    return [...by.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([at, channels], i) => ({ n: i + 1, at, channels }))
}

const DAY_MS = 86_400_000

const dayNumber = (iso: string): number => Math.floor(Date.parse(`${vnDateKey(new Date(iso))}T00:00:00Z`) / DAY_MS)

/** Pins each holiday of the month to the slot just before it (or, failing that, the first slot right after it): slot number to holiday key. */
export const pinHolidays = (
    slots: ReadonlyArray<PlanSlot>,
    holidays: ReadonlyArray<DatedEvent>,
): Map<number, string> => {
    const pinned = new Map<number, string>()
    for (const h of holidays) {
        const hd = Math.floor(Date.parse(`${h.date}T00:00:00Z`) / DAY_MS)
        const free = slots.filter((s) => !pinned.has(s.n))
        const before = free.filter((s) => dayNumber(s.at) <= hd && dayNumber(s.at) >= hd - Math.min(h.lead_days, 7))
        const after = free.filter((s) => dayNumber(s.at) > hd && dayNumber(s.at) <= hd + 2)
        const pick = before[before.length - 1] ?? after[0]
        if (pick !== undefined) pinned.set(pick.n, h.key)
    }
    return pinned
}
