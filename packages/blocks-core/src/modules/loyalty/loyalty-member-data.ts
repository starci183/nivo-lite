import type { EntityApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { toLoyaltyPhone } from "../../rules/loyalty/contact"
import type { ExpiryEntry, LedgerKind, LedgerTotal } from "../../rules/loyalty/ledger.types"
import { activityOf } from "../../rules/loyalty/stats"
import type { LedgerPost, LedgerRow, MemberPatch, MemberRow, StoreResult, Synced } from "./loyalty.types"
import { LEDGER_FIELDS, MEMBER_FIELDS, expiryEntryOf, ledgerRowOf, memberOf } from "./loyalty-records"
import { PAGE_SIZE, REWARDS_MAX, RETRIES, firstOf, numberOf, resultOf, rowsOf } from "./loyalty-paging"
import type { PagelessQuery } from "./loyalty-paging"

/** The most customers a read that looks through all of them reads. */
export const MEMBERS_MAX = 5_000

/** The most leads a sync reads. */
export const LEADS_MAX = 5_000

/** The most ledger entries of one customer a read of what is unspent looks through. */
export const EXPIRY_ENTRIES_MAX = 2_000

/** The most pages of conversations a check of who can be reached reads, for each state. */
export const CONVERSATION_PAGES_MAX = 20

/** The kinds of ledger entry, in the order the totals list them. */
const LEDGER_KINDS: ReadonlyArray<LedgerKind> = ["earn", "redeem", "expire", "adjust"]

/** The customer; null when there is none or the record is not one. */
export const memberById = async (members: EntityApi, id: string): Promise<MemberRow | null> => {
    const found = await members.get(id)
    return found === null ? null : memberOf(found)
}

/** Every customer, by name, at most `MEMBERS_MAX`. */
export const membersAll = async (members: EntityApi): Promise<ReadonlyArray<MemberRow>> => {
    const rows = await rowsOf(
        members,
        {
            select: MEMBER_FIELDS,
            order: [
                ["name", "asc"],
                ["id", "asc"],
            ],
        },
        MEMBERS_MAX,
    )
    return rows.flatMap((listed) => memberOf(listed.row) ?? [])
}

/** The values a patch of a customer writes. */
const patchValues = (patch: MemberPatch): Readonly<Record<string, string | null>> => ({
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.birthday === undefined ? {} : { birthday: patch.birthday }),
    ...(patch.note === undefined ? {} : { note: patch.note }),
    ...(patch.tierKey === undefined ? {} : { tierKey: patch.tierKey }),
    ...(patch.tier === undefined ? {} : { tier: patch.tier }),
})

/** Writes the patch when the customer is still at the version `expected`; a stale version is a conflict. */
export const updateMember = async (
    members: EntityApi,
    id: string,
    expected: string,
    patch: MemberPatch,
): Promise<StoreResult<MemberRow>> => resultOf(await members.update(id, expected, patchValues(patch)), memberOf)

/** The customer of a normalised phone, created with the name when the phone is new; null when the engine refused the write. */
export const ensureMemberByPhone = async (
    members: EntityApi,
    phone: string,
    name: string,
): Promise<MemberRow | null> => {
    const found = await members.ensure("phone", { name, phone, contact: phone })
    return found.ok ? memberOf(found.row) : null
}

/** What a lead is worth as a customer: the name and the normalised phone, else the email; null when it has neither. */
interface LeadContact {
    readonly id: string
    readonly name: string
    readonly phone: string | null
    readonly email: string | null
    readonly contact: string
}

const leadData = z.object({
    contactName: z.string().max(500),
    phone: z.string().max(40).nullable().optional(),
    email: z.string().max(500).nullable().optional(),
})

/** The contact of a lead; null when it has neither a usable phone nor an email. */
const contactOf = (record: RecordRow): LeadContact | null => {
    const parsed = leadData.safeParse(record.data)
    if (!parsed.success) return null
    const phone = toLoyaltyPhone(parsed.data.phone ?? null)
    const email = parsed.data.email ?? null
    const contact = phone ?? email
    return contact === null ? null : { id: record.id, name: parsed.data.contactName, phone, email, contact }
}

/** Makes a customer of the lead, or links the customer it already is; whether a customer was created and whether a link was made. */
const syncLead = async (members: EntityApi, lead: LeadContact): Promise<Synced> => {
    const values = {
        name: lead.name,
        contact: lead.contact,
        leadId: lead.id,
        ...(lead.phone === null ? {} : { phone: lead.phone }),
        ...(lead.email === null ? {} : { email: lead.email }),
    }
    const found = await members.ensure(lead.phone === null ? "email" : "phone", values)
    if (!found.ok) return { created: 0, linked: 0 }
    if (found.created === true) return { created: 1, linked: 1 }
    if (found.row.data["leadId"] === lead.id) return { created: 0, linked: 0 }
    const linked = await members.update(found.row.id, found.row.version, { leadId: lead.id })
    return { created: 0, linked: linked.ok ? 1 : 0 }
}

/** Makes a customer of every lead that has a phone or an email and links the leads to them. */
export const syncMembers = async (members: EntityApi, leads: EntityApi): Promise<Synced> => {
    const rows = await rowsOf(
        leads,
        {
            select: ["contactName", "phone", "email"],
            order: [
                ["updatedAt", "desc"],
                ["id", "desc"],
            ],
        },
        LEADS_MAX,
    )
    const synced = await Promise.all(
        rows.flatMap((listed) => contactOf(listed.row) ?? []).map((lead) => syncLead(members, lead)),
    )
    return {
        created: synced.reduce((sum, one) => sum + one.created, 0),
        linked: synced.reduce((sum, one) => sum + one.linked, 0),
    }
}

/** The ids of the leads that have a conversation in the state, newest first, from the page `after` names on. */
const leadsInState = async (
    conversations: EntityApi,
    status: string,
    after: string | undefined,
    pages: number,
    found: ReadonlyArray<string>,
): Promise<ReadonlyArray<string>> => {
    const page = await conversations.list({
        select: ["status"],
        join: { lead: ["contactName"] },
        where: q.eq("status", status),
        order: [
            ["lastAt", "desc"],
            ["id", "desc"],
        ],
        page: after === undefined ? { size: PAGE_SIZE } : { size: PAGE_SIZE, after },
    })
    const ids = [...found, ...page.rows.flatMap((listed) => listed.joined["lead"]?.id ?? [])]
    return page.next === null || pages <= 1 ? ids : leadsInState(conversations, status, page.next, pages - 1, ids)
}

/** How many of the given customers have a chat staff do not handle, so a promotion can reach them. */
export const membersReachable = async (
    members: EntityApi,
    conversations: EntityApi,
    ids: ReadonlyArray<string>,
    pages: number = CONVERSATION_PAGES_MAX,
): Promise<number> => {
    if (ids.length === 0) return 0
    const [asked, waiting] = await Promise.all([
        leadsInState(conversations, "ai", undefined, pages, []),
        leadsInState(conversations, "needs", undefined, pages, []),
    ])
    const reachable = new Set([...asked, ...waiting])
    const wanted = new Set(ids)
    const linked = await rowsOf(
        members,
        {
            select: ["leadId"],
            where: q.notNull("leadId"),
            order: [
                ["leadId", "asc"],
                ["id", "asc"],
            ],
        },
        MEMBERS_MAX,
    )
    return linked.filter((listed) => {
        const leadId = listed.row.data["leadId"]
        return wanted.has(listed.row.id) && typeof leadId === "string" && reachable.has(leadId)
    }).length
}

/** The balance a member holds after an entry: the points, the spend and the visits an earning adds, and how lively the member is. */
const applyEntry = (member: MemberRow, entry: LedgerPost): Readonly<Record<string, string | number | null>> => {
    const earned = entry.kind === "earn"
    const lastVisitAt = earned ? entry.occurredAt : member.lastVisitAt
    return {
        points: member.points + entry.points,
        lifetimeSpendVnd: member.lifetimeSpendVnd + (earned ? (entry.amountVnd ?? 0) : 0),
        visits: member.visits + (earned ? 1 : 0),
        lastVisitAt,
        activity: activityOf({ ...member, lastVisitAt }, Date.parse(entry.occurredAt)),
    }
}

/** Moves the balance of the customer by the entry, reading the customer again when another write got in first. */
const moveBalance = async (members: EntityApi, entry: LedgerPost, attempts: number): Promise<void> => {
    const member = await memberById(members, entry.customerId)
    if (member === null || attempts <= 0) return
    const written = await members.update(member.id, member.version, applyEntry(member, entry))
    if (!written.ok && written.reason === "stale") await moveBalance(members, entry, attempts - 1)
}

/** Writes the entry and moves the balance of its customer; the id of the entry, or null when its `ref` was posted before or the customer is gone. */
export const postLedger = async (members: EntityApi, ledger: EntityApi, entry: LedgerPost): Promise<string | null> => {
    const member = await memberById(members, entry.customerId)
    if (member === null) return null
    const written = await ledger.insert(
        {
            memberId: entry.customerId,
            kind: entry.kind,
            points: entry.points,
            amountVnd: entry.amountVnd,
            evidence: entry.evidence,
            by: entry.by,
            expiresAt: entry.expiresAt,
            occurredAt: entry.occurredAt,
            ref: entry.ref,
            rewardId: entry.rewardId,
        },
        { member: entry.customerId },
    )
    if (!written.ok) return null
    await moveBalance(members, entry, RETRIES)
    return written.row.id
}

/** Whether an entry with the `ref` was posted before. */
export const hasRef = async (ledger: EntityApi, ref: string): Promise<boolean> =>
    (await firstOf(ledger, {
        select: ["kind"],
        where: q.eq("ref", ref),
        order: [
            ["ref", "asc"],
            ["id", "asc"],
        ],
    })) !== null

/** The query of the entries of one customer, newest first. */
const entriesOf = (customerId: string, select: ReadonlyArray<string>): PagelessQuery => ({
    select,
    where: q.eq("memberId", customerId),
    order: [
        ["occurredAt", "desc"],
        ["id", "desc"],
    ],
})

/** The newest entries of a customer, newest first, at most `limit`. */
export const ledgerTimeline = async (
    ledger: EntityApi,
    customerId: string,
    limit: number,
): Promise<ReadonlyArray<LedgerRow>> => {
    const rows = await rowsOf(ledger, entriesOf(customerId, LEDGER_FIELDS), limit)
    return rows.flatMap((listed) => ledgerRowOf(listed.row) ?? [])
}

/** The part of every entry of a customer that decides what is still unspent. */
export const ledgerExpiryEntries = async (
    ledger: EntityApi,
    customerId: string,
): Promise<ReadonlyArray<ExpiryEntry>> => {
    const rows = await rowsOf(ledger, entriesOf(customerId, LEDGER_FIELDS), EXPIRY_ENTRIES_MAX)
    return rows.flatMap((listed) => expiryEntryOf(listed.row) ?? [])
}

/** How many times a customer redeemed each reward, by reward id. */
export const redeemedCounts = async (
    ledger: EntityApi,
    customerId: string,
): Promise<Readonly<Record<string, number>>> => {
    const rows = await ledger.aggregate({
        where: q.and(q.eq("memberId", customerId), q.eq("kind", "redeem")),
        groupBy: ["rewardId"],
        measures: { redeemed: { kind: "count" } },
        limit: REWARDS_MAX,
    })
    return Object.fromEntries(
        rows.flatMap((row) => {
            const id = row.groups["rewardId"]
            return id === null || id === undefined ? [] : [[id, numberOf(row.measures["redeemed"])] as const]
        }),
    )
}

/** What each kind of entry came to since an instant, ISO 8601; every kind is listed. */
export const ledgerTotalsSince = async (ledger: EntityApi, sinceIso: string): Promise<ReadonlyArray<LedgerTotal>> => {
    const rows = await ledger.aggregate({
        where: q.gte("occurredAt", sinceIso),
        groupBy: ["kind"],
        measures: {
            entries: { kind: "count" },
            points: { kind: "sum", field: "points" },
            amountVnd: { kind: "sum", field: "amountVnd" },
        },
        limit: 10,
    })
    return LEDGER_KINDS.map((kind) => {
        const row = rows.find((candidate) => candidate.groups["kind"] === kind)
        return {
            kind,
            entries: numberOf(row?.measures["entries"]),
            points: numberOf(row?.measures["points"]),
            amountVnd: numberOf(row?.measures["amountVnd"]),
        }
    })
}
