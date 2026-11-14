import type { ListFilter, ListPage, ListQuery, ListShape, ListSource } from "@nivo-lite/agent-sdk/block"
import type { EntityApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { unprovided, type PortDefinition, type PortProvider, type RunContext } from "@nivo-lite/agent-sdk/port"
import { NEVER_BOUGHT } from "../../../../entities/sales/loyalty-member.entity"
import { tierByKey } from "../../../../rules/sales/loyalty/config"
import { fold } from "../../../../rules/sales/loyalty/fold"
import { activityOf } from "../../../../rules/sales/loyalty/stats"
import { entityApi, memoryWorld, putRecord, rowsOf, type MemoryWorld } from "../../ledger/fixtures/accounting.memory"
import { compareBy } from "../../ledger/fixtures/accounting.memory-rows"
import { loyaltyMembersList } from "../ports"
import { campaignOf, decisionOf, ledgerRowOf, memberOf, programOfRecord, rewardOf } from "../loyalty-records"
import type {
    CampaignRow,
    DecisionItem,
    LedgerRow,
    MemberListRow,
    MemberRow,
    ProgramRow,
    RewardRow,
} from "../loyalty.types"
import {
    type StoredEntry,
    SAMPLE_CAMPAIGNS,
    SAMPLE_DECISIONS,
    SAMPLE_ENTRIES,
    SAMPLE_MEMBERS,
    SAMPLE_NOW,
    SAMPLE_PROGRAM,
    SAMPLE_REWARDS,
} from "./loyalty.data"
import type { LeadSeed } from "./loyalty.memory.types"
import { SALES_LEAD_ENTITY } from "../../../../entities/sales/sales-entity-names"

/** The entities the fake engine serves the Loyalty module: its own and the Sales and Chatbot ones it reads. */
const ENTITIES: ReadonlyArray<string> = [
    "blocks-core.sales.loyalty-member",
    "blocks-core.sales.loyalty-ledger-entry",
    "blocks-core.sales.loyalty-reward",
    "blocks-core.sales.loyalty-program",
    "blocks-core.sales.loyalty-campaign",
    "blocks-core.sales.loyalty-decision",
    SALES_LEAD_ENTITY,
]

/** The owner of the fake workspace, who holds every permission of the module. */
export const OWNER_ID = "00000000-0000-4000-8000-0000000000bb"

/** A request scope of the owner at the instant the sample data is drawn at. */
export const OWNER_CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: OWNER_ID,
    now: new Date(SAMPLE_NOW),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

/** The text of a field of a row; empty when the field is not text. */
const textOf = (row: Readonly<Record<string, unknown>>, field: string): string => {
    const value = row[field]
    return typeof value === "string" ? value : ""
}

/** The row the members list draws for a stored customer. */
const rowOf = (row: RecordRow): MemberListRow => ({
    id: row.id,
    name: textOf(row.data, "name"),
    contact: textOf(row.data, "contact"),
    tier: textOf(row.data, "tier"),
    tierKey: typeof row.data["tierKey"] === "string" ? row.data["tierKey"] : null,
    points: Number(row.data["points"]),
    lifetimeSpendVnd: Number(row.data["lifetimeSpendVnd"]),
    lastVisitAt: typeof row.data["lastVisitAt"] === "string" ? row.data["lastVisitAt"] : null,
    activity: row.data["activity"] === "active" || row.data["activity"] === "at_risk" ? row.data["activity"] : "new",
})

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

/** The rows a query keeps: the search over the shape's fields and every filter but the one `skip` names. */
const keptBy = (
    rows: ReadonlyArray<MemberListRow>,
    shape: ListShape,
    query: ListQuery,
    skip: string | null,
): ReadonlyArray<MemberListRow> =>
    rows.filter((row) => {
        const wanted = fold(query.q ?? "")
        const fields = shape.search?.fields ?? []
        if (wanted !== "" && !fields.some((field) => fold(String(Reflect.get(row, field))).includes(wanted)))
            return false
        return Object.entries(query.filters).every(([name, chosen]) => {
            const filter = enumeratedOf(shape.filters?.[name])
            return name === skip || Reflect.get(row, filter.field) === chosen
        })
    })

/** The members list over a world: search, the filters, the sorts, paging and the counts of a filter, over the stored fields. */
export const membersList = (world: MemoryWorld): ListSource<MemberListRow> => ({
    page: (shape, query): Promise<ListPage<MemberListRow>> => {
        const keys = shape.sort[query.sort] ?? []
        const ordered = rowsOf(world, "blocks-core.sales.loyalty-member").toSorted(compareBy(keys))
        const sorted = keptBy(ordered.map((item) => rowOf(item)), shape, query, null)
        const start = query.cursor === null ? 0 : Number(query.cursor)
        const end = start + query.size
        return Promise.resolve({ rows: sorted.slice(start, end), cursor: end < sorted.length ? String(end) : null })
    },
    counts: (shape, by, query) => {
        const filter = enumeratedOf(shape.filters?.[by])
        const found = keptBy(rowsOf(world, "blocks-core.sales.loyalty-member").map((item) => rowOf(item)), shape, query, by)
        const names = filter.open
            ? [
                  ...new Set(
                      found.map((row) => String(Reflect.get(row, filter.field) ?? "")).filter((name) => name !== ""),
                  ),
              ]
            : filter.of
        return Promise.resolve(
            Object.fromEntries(
                names.map((name) => [name, found.filter((row) => Reflect.get(row, filter.field) === name).length]),
            ),
        )
    },
})

/** The ports of the Loyalty module over a world, by id. */
const portsOf = (world: MemoryWorld): ReadonlyArray<readonly [string, unknown]> => [
    ...ENTITIES.map((entity): readonly [string, unknown] => [`engine.entity.${entity}`, entityApi(world, entity)]),
    [loyaltyMembersList.id, membersList(world)],
]

/** The implementation of each port of the module over a world; a port outside the module is unprovided. */
export const loyaltyProvider = (world: MemoryWorld): PortProvider => {
    const implementations = new Map(portsOf(world))
    return {
        implementationOf: (port: PortDefinition<unknown>): unknown =>
            implementations.has(port.id) ? implementations.get(port.id) : unprovided(port),
    }
}

/** The provider of a world whose port for one entity answers `patch` where it names a call: a spec makes a write fail with it. */
export const withEntity = (world: MemoryWorld, entity: string, patch: Partial<EntityApi>): PortProvider => {
    const base = loyaltyProvider(world)
    const id = `engine.entity.${entity}`
    return {
        implementationOf: (port: PortDefinition<unknown>): unknown =>
            port.id === id ? { ...entityApi(world, entity), ...patch } : base.implementationOf(port),
    }
}

/** Stores a customer with the tier name and the activity the actions keep with every ledger entry. */
export const putMember = (world: MemoryWorld, member: MemberRow, nowMs: number = Date.parse(SAMPLE_NOW)): void => {
    const { id, version, ...data } = member
    putRecord(
        world,
        "blocks-core.sales.loyalty-member",
        id,
        {
            ...data,
            contact: member.phone ?? member.email ?? "",
            tier: tierByKey(SAMPLE_PROGRAM.config, member.tierKey)?.name ?? "",
            activity: activityOf(member, nowMs),
            lastActivityAt: member.lastVisitAt ?? NEVER_BOUGHT,
        },
        { version, createdAt: member.joinedAt },
    )
}

/** Stores a ledger entry, linked to its customer. */
export const putEntry = (world: MemoryWorld, entry: StoredEntry): void => {
    const { id, customerId, ...data } = entry
    putRecord(
        world,
        "blocks-core.sales.loyalty-ledger-entry",
        id,
        { ...data, memberId: customerId },
        {
            createdAt: entry.occurredAt,
            links: { member: customerId },
        },
    )
}

/** Stores a reward. */
export const putReward = (world: MemoryWorld, reward: RewardRow): void => {
    const { id, version, ...data } = reward
    putRecord(world, "blocks-core.sales.loyalty-reward", id, data, { version })
}

/** Stores the programme. */
export const putProgram = (world: MemoryWorld, program: ProgramRow): void => {
    const { version, config, ...data } = program
    putRecord(world, "blocks-core.sales.loyalty-program", "p-1", { ...data, scope: "workspace", config }, { version: version ?? "1" })
}

/** Stores a promotion. */
export const putCampaign = (world: MemoryWorld, campaign: CampaignRow): void => {
    const { id, createdAt, ...data } = campaign
    putRecord(world, "blocks-core.sales.loyalty-campaign", id, data, { createdAt })
}

/** Stores a decision that waits for a person. */
export const putDecision = (world: MemoryWorld, decision: DecisionItem): void => {
    const { id, createdAt, ...data } = decision
    putRecord(world, "blocks-core.sales.loyalty-decision", id, { ...data, status: "waiting" }, { createdAt })
}

/** The person (the core contact) a stored lead is about. */
export const contactOfLead = (leadId: string): string => `contact-${leadId}`

/** Stores a lead of the Sales module with the contact a sync reads, about its person (`contactOfLead`). */
export const putLead = (world: MemoryWorld, id: string, contact: LeadSeed): void => {
    putRecord(world, SALES_LEAD_ENTITY, id, { contactId: contactOfLead(id), ...contact })
}

/** Links a stored customer to a person, the way a sync does. */
export const linkContact = (world: MemoryWorld, memberId: string, contactId: string): void => {
    const rows = rowsOf(world, "blocks-core.sales.loyalty-member")
    const index = rows.findIndex((row) => row.id === memberId)
    const row = rows[index]
    if (row !== undefined) rows[index] = { ...row, data: { ...row.data, contactId } }
}

/** A world over the sample data of the shop: the customers, the ledger, the catalogue, the programme (none when `program` is null), the promotions and the decisions. */
export const sampleWorld = (program: ProgramRow | null = SAMPLE_PROGRAM): MemoryWorld => {
    const world = memoryWorld()
    for (const member of SAMPLE_MEMBERS) putMember(world, member)
    for (const entry of SAMPLE_ENTRIES) putEntry(world, entry)
    for (const reward of SAMPLE_REWARDS) putReward(world, reward)
    if (program !== null) putProgram(world, program)
    for (const campaign of SAMPLE_CAMPAIGNS) putCampaign(world, campaign)
    for (const decision of SAMPLE_DECISIONS) putDecision(world, decision)
    for (const [index, member] of SAMPLE_MEMBERS.slice(0, 3).entries()) {
        const leadId = `l-${index + 1}`
        putLead(world, leadId, { contactName: member.name, phone: member.phone })
        linkContact(world, member.id, contactOfLead(leadId))
    }
    return world
}

/** The customer a world holds; null when it has none with the id. */
export const memberIn = (world: MemoryWorld, id: string): MemberRow | null => {
    const found = rowsOf(world, "blocks-core.sales.loyalty-member").find((row) => row.id === id)
    return found === undefined ? null : memberOf(found)
}

/** The ledger entries a world holds, oldest first. */
export const entriesIn = (world: MemoryWorld): ReadonlyArray<LedgerRow & { readonly customerId: string }> =>
    rowsOf(world, "blocks-core.sales.loyalty-ledger-entry").flatMap((row) => {
        const entry = ledgerRowOf(row)
        return entry === null ? [] : [{ ...entry, customerId: textOf(row.data, "memberId") }]
    })

/** The rewards a world holds. */
export const rewardsIn = (world: MemoryWorld): ReadonlyArray<RewardRow> =>
    rowsOf(world, "blocks-core.sales.loyalty-reward").flatMap((row) => rewardOf(row) ?? [])

/** The programme a world holds; null before the first save. */
export const programIn = (world: MemoryWorld): ProgramRow | null => {
    const found = rowsOf(world, "blocks-core.sales.loyalty-program")[0]
    return found === undefined ? null : programOfRecord(found)
}

/** The promotions a world holds, oldest first. */
export const campaignsIn = (world: MemoryWorld): ReadonlyArray<CampaignRow> =>
    rowsOf(world, "blocks-core.sales.loyalty-campaign").flatMap((row) => campaignOf(row) ?? [])

/** The decisions a world holds that still wait. */
export const decisionsIn = (world: MemoryWorld): ReadonlyArray<DecisionItem> =>
    rowsOf(world, "blocks-core.sales.loyalty-decision")
        .filter((row) => row.data["status"] === "waiting")
        .flatMap((row) => decisionOf(row) ?? [])
