import type { ListFilter, ListPage, ListQuery, ListShape, ListSource } from "@nivo-lite/agent-sdk/block"
import { unprovided } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition, PortProvider } from "@nivo-lite/agent-sdk/port"
import { DEFAULT_CONFIG } from "../../rules/loyalty/config"
import type { LedgerKind, LedgerTotal } from "../../rules/loyalty/ledger.types"
import type { RewardEdit } from "../../rules/loyalty/reward.types"
import { fold } from "../../rules/loyalty/fold"
import { memberListRowOf } from "./mappers"
import type {
    CampaignRow,
    DecisionItem,
    LedgerPost,
    LedgerRow,
    MemberListRow,
    MemberPatch,
    MemberRow,
    ProgramRow,
    RewardRow,
    StoreResult,
    Synced,
} from "./loyalty.types"
import {
    loyaltyCampaigns,
    loyaltyDecisions,
    loyaltyLedger,
    loyaltyMembers,
    loyaltyMembersList,
    loyaltyProgram,
    loyaltyRewards,
} from "./ports"
import type { CampaignStore, DecisionStore, LedgerStore, MemberStore, ProgramStore, RewardStore } from "./ports"

/** A ledger entry as the memory keeps it: what the timeline shows, with the customer, the key and the reward behind it. */
export interface StoredEntry extends LedgerRow {
    /** The customer whose points moved. */
    readonly customerId: string
    /** The idempotency key of the entry. */
    readonly ref: string
    /** The reward behind a redeem, or null. */
    readonly rewardId: string | null
}

/** What the in-memory provider holds: the rows of every store, and the clock. */
export interface MemoryState {
    /** The customers; writes replace the entries. */
    members: Array<MemberRow>
    /** The ledger entries, oldest first. */
    entries: Array<StoredEntry>
    /** The rewards; writes replace the entries. */
    rewards: Array<RewardRow>
    /** The programme, or null before the first save. */
    program: ProgramRow | null
    /** The campaigns, oldest first. */
    campaigns: Array<CampaignRow>
    /** The decisions that wait, oldest first. */
    decisions: Array<DecisionItem>
    /** The ids of the customers a promotion can reach. */
    reachable: ReadonlyArray<string>
    /** What the sync from the leads answers. */
    synced: Synced
    /** The instant the memory stamps on what it writes, ISO text. */
    now: string
}

const valueOf = (row: object, field: string): unknown => Reflect.get(row, field)

const textOf = (row: object, field: string): string => {
    const value = valueOf(row, field)
    return typeof value === "string" ? value : ""
}

/** Orders two values: numbers by size, the rest as text, and a missing value before any other. */
const compare = (left: unknown, right: unknown): number => {
    if (left === null || right === null) return Number(left !== null) - Number(right !== null)
    return typeof left === "number" && typeof right === "number"
        ? left - right
        : JSON.stringify(left).localeCompare(JSON.stringify(right))
}

/** A filter that names one field and the values it takes. */
interface EnumeratedFilter {
    /** The row field. */
    readonly field: string
    /** The values the filter takes. */
    readonly of: ReadonlyArray<string>
    /** Whether the filter takes any value, so its counts name the values the rows hold. */
    readonly open: boolean
}

/** The field and the values of a filter that names them; an empty one for any other filter. */
const enumeratedOf = (filter: ListFilter | undefined): EnumeratedFilter => {
    if (filter === undefined || !("field" in filter)) return { field: "", of: [], open: false }
    return { field: filter.field, of: filter.of, open: filter.open === true }
}

const rowsFor = <T extends object>(
    rows: ReadonlyArray<T>,
    shape: ListShape,
    query: ListQuery,
    skip: string | null,
): ReadonlyArray<T> =>
    rows.filter((row) => {
        const wanted = fold(query.q ?? "")
        const fields = shape.search?.fields ?? []
        if (wanted !== "" && !fields.some((field) => fold(textOf(row, field)).includes(wanted))) return false
        return Object.entries(query.filters).every(([name, chosen]) => {
            const filter = enumeratedOf(shape.filters?.[name])
            return name === skip || valueOf(row, filter.field) === chosen
        })
    })

const memoryList = <T extends object>(rows: () => ReadonlyArray<T>): ListSource<T> => ({
    page: (shape, query): Promise<ListPage<T>> => {
        const keys = shape.sort[query.sort] ?? []
        const sorted = [...rowsFor(rows(), shape, query, null)].sort((a, b) => {
            for (const [field, direction] of keys) {
                const order = compare(valueOf(a, field), valueOf(b, field))
                if (order !== 0) return direction === "asc" ? order : -order
            }
            return 0
        })
        const start = query.cursor === null ? 0 : Number(query.cursor)
        const end = start + query.size
        return Promise.resolve({ rows: sorted.slice(start, end), cursor: end < sorted.length ? String(end) : null })
    },
    counts: (shape, by, query) => {
        const filter = enumeratedOf(shape.filters?.[by])
        const found = rowsFor(rows(), shape, query, by)
        const names = filter.open
            ? [...new Set(found.map((row) => textOf(row, filter.field)).filter((name) => name !== ""))]
            : filter.of
        return Promise.resolve(
            Object.fromEntries(
                names.map((name) => [name, found.filter((row) => valueOf(row, filter.field) === name).length]),
            ),
        )
    },
})

const nextVersion = (version: string): string => String(Number(version) + 1)

const replaceIn = <T extends { readonly id: string }>(rows: Array<T>, written: T): void => {
    rows.splice(
        rows.findIndex((row) => row.id === written.id),
        1,
        written,
    )
}

const memberStore = (state: MemoryState): MemberStore => ({
    get: (id) => Promise.resolve(state.members.find((member) => member.id === id) ?? null),
    update: (id, expected, patch: MemberPatch): Promise<StoreResult<MemberRow>> => {
        const current = state.members.find((member) => member.id === id)
        if (current === undefined) return Promise.resolve({ ok: false, reason: "missing" })
        if (current.version !== expected) return Promise.resolve({ ok: false, reason: "conflict" })
        const written: MemberRow = {
            ...current,
            ...patch,
            birthday: patch.birthday === undefined ? current.birthday : patch.birthday,
            version: nextVersion(current.version),
        }
        replaceIn(state.members, written)
        return Promise.resolve({ ok: true, row: written })
    },
    all: () => Promise.resolve(state.members),
    ensureByPhone: (phone, name) => {
        const found = state.members.find((member) => member.phone === phone)
        if (found !== undefined) return Promise.resolve(found)
        const created: MemberRow = {
            id: `m-${state.members.length + 1}`,
            version: "1",
            name,
            phone,
            email: null,
            birthday: null,
            tierKey: null,
            points: 0,
            lifetimeSpendVnd: 0,
            visits: 0,
            lastVisitAt: null,
            joinedAt: state.now,
            note: "",
        }
        state.members.push(created)
        return Promise.resolve(created)
    },
    sync: () => Promise.resolve(state.synced),
    reachable: (ids) => Promise.resolve(ids.filter((id) => state.reachable.includes(id)).length),
})

const totalsOf = (entries: ReadonlyArray<StoredEntry>, since: string): ReadonlyArray<LedgerTotal> => {
    const kinds: ReadonlyArray<LedgerKind> = ["earn", "redeem", "expire", "adjust"]
    const recent = entries.filter((entry) => entry.occurredAt >= since)
    return kinds.map((kind) => {
        const own = recent.filter((entry) => entry.kind === kind)
        return {
            kind,
            entries: own.length,
            points: own.reduce((sum, entry) => sum + entry.points, 0),
            amountVnd: own.reduce((sum, entry) => sum + (entry.amountVnd ?? 0), 0),
        }
    })
}

const ledgerStore = (state: MemoryState): LedgerStore => ({
    timeline: (customerId, limit) =>
        Promise.resolve(
            state.entries
                .filter((entry) => entry.customerId === customerId)
                .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                .slice(0, limit),
        ),
    expiryEntries: (customerId) =>
        Promise.resolve(
            state.entries
                .filter((entry) => entry.customerId === customerId)
                .map((entry) => ({ kind: entry.kind, points: entry.points, expiresAt: entry.expiresAt })),
        ),
    redeemedCounts: (customerId) => {
        const counts: Record<string, number> = {}
        for (const entry of state.entries) {
            if (entry.customerId !== customerId || entry.kind !== "redeem" || entry.rewardId === null) continue
            counts[entry.rewardId] = (counts[entry.rewardId] ?? 0) + 1
        }
        return Promise.resolve(counts)
    },
    totalsSince: (sinceIso) => Promise.resolve(totalsOf(state.entries, sinceIso)),
    hasRef: (ref) => Promise.resolve(state.entries.some((entry) => entry.ref === ref)),
    post: (entry: LedgerPost) => {
        if (state.entries.some((stored) => stored.ref === entry.ref)) return Promise.resolve(null)
        const id = `e-${state.entries.length + 1}`
        state.entries.push({ ...entry, id })
        const member = state.members.find((candidate) => candidate.id === entry.customerId)
        if (member !== undefined) {
            const earned = entry.kind === "earn"
            replaceIn(state.members, {
                ...member,
                points: member.points + entry.points,
                lifetimeSpendVnd: member.lifetimeSpendVnd + (earned ? (entry.amountVnd ?? 0) : 0),
                visits: member.visits + (earned ? 1 : 0),
                lastVisitAt: earned ? entry.occurredAt : member.lastVisitAt,
            })
        }
        return Promise.resolve(id)
    },
})

const rewardOf = (edit: RewardEdit, id: string, version: string): RewardRow => ({
    id,
    version,
    key: edit.key ?? id,
    name: edit.name,
    kind: edit.kind,
    valueVnd: edit.valueVnd,
    percent: edit.percent,
    pointsCost: edit.pointsCost,
    stock: edit.stock,
    perCustomerLimit: edit.perCustomerLimit,
    minTierKey: edit.minTierKey,
    note: edit.note,
    active: edit.active,
})

const rewardStore = (state: MemoryState): RewardStore => ({
    list: (activeOnly) =>
        Promise.resolve(
            state.rewards.filter((reward) => !activeOnly || reward.active).sort((a, b) => b.id.localeCompare(a.id)),
        ),
    get: (id) => Promise.resolve(state.rewards.find((reward) => reward.id === id) ?? null),
    save: (edit) => {
        if (edit.id === undefined) {
            const created = rewardOf(edit, `r-${state.rewards.length + 1}`, "1")
            state.rewards.push(created)
            return Promise.resolve({ ok: true, row: created })
        }
        const current = state.rewards.find((reward) => reward.id === edit.id)
        if (current === undefined) return Promise.resolve({ ok: false, reason: "missing" })
        const written = { ...rewardOf(edit, current.id, nextVersion(current.version)), key: current.key }
        replaceIn(state.rewards, written)
        return Promise.resolve({ ok: true, row: written })
    },
    remove: (id) => {
        const current = state.rewards.find((reward) => reward.id === id)
        if (current === undefined) return Promise.resolve("missing")
        if (state.entries.some((entry) => entry.rewardId === id)) {
            replaceIn(state.rewards, { ...current, active: false })
            return Promise.resolve("retired")
        }
        state.rewards.splice(state.rewards.indexOf(current), 1)
        return Promise.resolve("deleted")
    },
    takeOne: (id) => {
        const current = state.rewards.find((reward) => reward.id === id)
        if (current !== undefined && current.stock !== null)
            replaceIn(state.rewards, { ...current, stock: current.stock - 1 })
        return Promise.resolve()
    },
    addMissing: (edits) => {
        const lacking = edits.filter((edit) => !state.rewards.some((reward) => reward.key === edit.key))
        for (const edit of lacking) state.rewards.push(rewardOf(edit, `r-${state.rewards.length + 1}`, "1"))
        return Promise.resolve(lacking.length)
    },
})

const programStore = (state: MemoryState): ProgramStore => ({
    get: () => Promise.resolve(state.program),
    save: (save) => {
        const written: ProgramRow = {
            ...save,
            version: nextVersion(state.program?.version ?? "0"),
        }
        state.program = written
        return Promise.resolve(written)
    },
})

const campaignStore = (state: MemoryState): CampaignStore => ({
    list: (limit) => Promise.resolve([...state.campaigns].reverse().slice(0, limit)),
    sentSince: (sinceIso) =>
        Promise.resolve(
            state.campaigns.filter((campaign) => campaign.createdAt >= sinceIso).reduce((sum, c) => sum + c.sent, 0),
        ),
    create: (request) => {
        const created: CampaignRow = {
            id: `c-${state.campaigns.length + 1}`,
            name: request.name === "" ? "Promotion" : request.name,
            segment: request.segment,
            draft: request.brief,
            status: "waiting",
            workItemId: null,
            recipients: 0,
            sent: 0,
            failed: 0,
            createdBy: request.createdBy ?? "NIVO",
            createdAt: state.now,
        }
        state.campaigns.push(created)
        return Promise.resolve({ campaignId: created.id, status: created.status, recipients: created.recipients })
    },
})

const decisionStore = (state: MemoryState): DecisionStore => ({
    waiting: (limit) => Promise.resolve(state.decisions.slice(0, limit)),
    decide: (id) => {
        const found = state.decisions.find((decision) => decision.id === id)
        if (found === undefined) return Promise.resolve({ ok: false, reason: "missing" })
        state.decisions.splice(state.decisions.indexOf(found), 1)
        return Promise.resolve({ ok: true, row: found })
    },
})

const membersList = (state: MemoryState): ListSource<MemberListRow> =>
    memoryList(() => {
        const config = state.program?.config ?? DEFAULT_CONFIG
        const nowMs = Date.parse(state.now)
        return state.members.map((member) => memberListRowOf(member, config, nowMs))
    })

/**
 * A port provider over rows in memory: the members list (search, the activity filter, sort, paging, counts), the stores with
 * version checks, the idempotent ledger and the decisions. It stands in for the entity engine in specs and in the prototype
 * data port.
 */
export const memoryProvider = (state: MemoryState): PortProvider => ({
    implementationOf: (port: PortDefinition<unknown>): unknown => {
        if (port.id === loyaltyMembersList.id) return membersList(state)
        if (port.id === loyaltyMembers.id) return memberStore(state)
        if (port.id === loyaltyLedger.id) return ledgerStore(state)
        if (port.id === loyaltyRewards.id) return rewardStore(state)
        if (port.id === loyaltyProgram.id) return programStore(state)
        if (port.id === loyaltyCampaigns.id) return campaignStore(state)
        if (port.id === loyaltyDecisions.id) return decisionStore(state)
        return unprovided(port)
    },
})
