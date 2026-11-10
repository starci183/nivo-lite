import { Injectable } from "@nestjs/common"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { EntitiesApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import type { OrderBy } from "@nivo-lite/agent-sdk/query"
import { InboxLeadsError, InboxLeadsErrorCode } from "./errors/inbox-leads.error"
import type { OptionalAgentId } from "./inbox-leads.contracts"
import { isUuid, numberOf, textOf } from "./record-fields.policy"
import type { ConversationFacts, OrderFacts } from "./inbox-lead-row.policy"

/** The most records of one entity a read takes. */
const READ_SIZE = 100

/** One lead record as the inbox reads it. */
export interface LeadRecord {
    /** The lead id. */
    readonly id: string
    /** The version token a write names. */
    readonly version: string
    /** When it was made, ISO 8601. */
    readonly createdAt: string
    /** When it last changed, ISO 8601. */
    readonly updatedAt: string
    /** The name of the customer. */
    readonly name: string
    /** The channel key of the customer. */
    readonly channel: string
    /** The stage the sales module wrote. */
    readonly stage: string
    /** What the customer asked for, or null. */
    readonly need: string | null
    /** The summary the agent wrote, or null. */
    readonly contextSummary: string | null
    /** The phone, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
    /** The agent the owner handed the lead to, when the text is an id. */
    readonly ownerAgentId: string | null
    /** The next step the sales module wrote, or null. */
    readonly nextStep: string | null
    /** The value quoted in VND, or null. */
    readonly quoteVnd: number | null
    /** A note on the lead, or null. */
    readonly note: string | null
}

/** The records of the customers the inbox shows, read in one scoped transaction. */
export interface LeadRecords {
    /** The newest leads, newest first. */
    readonly leads: ReadonlyArray<LeadRecord>
    /** The orders of those customers, newest first, by lead id. */
    readonly orders: ReadonlyMap<string, ReadonlyArray<OrderFacts>>
    /** The newest conversation of each customer, by lead id. */
    readonly conversations: ReadonlyMap<string, ConversationFacts>
    /** The customers that talk to the shop on Zalo too. */
    readonly zaloLeadIds: ReadonlySet<string>
}

const LEAD_FIELDS = [
    "contactName",
    "channel",
    "stage",
    "need",
    "contextSummary",
    "phone",
    "email",
    "owner",
    "nextStep",
    "quoteVnd",
    "note",
] as const

/** One lead record of the engine as the inbox reads it. */
const leadOf = (row: RecordRow): LeadRecord => {
    const owner = textOf(row.data, "owner")
    return {
        id: row.id,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        name: textOf(row.data, "contactName") ?? "",
        channel: textOf(row.data, "channel") ?? "website",
        stage: textOf(row.data, "stage") ?? "new",
        need: textOf(row.data, "need"),
        contextSummary: textOf(row.data, "contextSummary"),
        phone: textOf(row.data, "phone"),
        email: textOf(row.data, "email"),
        ownerAgentId: owner !== null && isUuid(owner) ? owner : null,
        nextStep: textOf(row.data, "nextStep"),
        quoteVnd: numberOf(row.data, "quoteVnd"),
        note: textOf(row.data, "note"),
    }
}

const pushed = <T>(map: Map<string, Array<T>>, key: string, value: T): void => {
    const list = map.get(key)
    if (list === undefined) map.set(key, [value])
    else list.push(value)
}

@Injectable()
/**
 * The inbox's door to the entity engine: the `sales.lead`, `sales.order` and `chat.conversation` records of a workspace, read in one scoped
 * transaction, and the one write the inbox makes (who a customer is handed to). The engine alone judges what a write may hold.
 */
export class InboxLeadsRecordsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
    ) {}

    /** The newest customers of the workspace (matching `search` in their words when given) with their orders and conversations. */
    read(workspaceId: string, search: string | null, ids?: ReadonlyArray<string>): Promise<LeadRecords> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const leads = await this.leads(api, search, ids)
            const leadIds = leads.map((lead) => lead.id)
            if (leadIds.length === 0)
                return { leads, orders: new Map(), conversations: new Map(), zaloLeadIds: new Set() }
            const orders = await this.orders(api, leadIds)
            const { newest, zaloLeadIds } = await this.conversations(api, leadIds)
            return { leads, orders, conversations: newest, zaloLeadIds }
        })
    }

    /** Hands a customer to an agent (or to nobody); the engine refuses the write when the customer moved since it was read. */
    async assign(workspaceId: string, leadId: string, agentId: OptionalAgentId): Promise<void> {
        await this.engine.scoped(workspaceId, async (tx) => {
            const api = this.ports.entitiesApi((use) => use(tx), "action")
            const found = await api.get("sales.lead", leadId)
            if (found === null) throw new InboxLeadsError({ code: InboxLeadsErrorCode.LeadNotFound })
            const written = await api.update("sales.lead", leadId, found.version, { owner: agentId })
            if (!written.ok) throw new InboxLeadsError({ code: InboxLeadsErrorCode.WriteRefused })
        })
    }

    private async leads(
        api: EntitiesApi,
        search: string | null,
        ids: ReadonlyArray<string> | undefined,
    ): Promise<ReadonlyArray<LeadRecord>> {
        const filters = [
            ...(ids === undefined ? [] : [q.in("id", ids)]),
            ...(search === null ? [] : [q.search(["contactName", "need", "phone", "email"], search)]),
        ]
        const base = {
            from: "sales.lead",
            select: LEAD_FIELDS,
            order: [
                ["updatedAt", "desc"],
                ["id", "desc"],
            ] satisfies OrderBy,
            page: { size: READ_SIZE },
        }
        const where = q.allOf(...filters)
        const page = await api.list(where === undefined ? base : { ...base, where })
        return page.rows.map((entry) => leadOf(entry.row))
    }

    private async orders(
        api: EntitiesApi,
        leadIds: ReadonlyArray<string>,
    ): Promise<ReadonlyMap<string, ReadonlyArray<OrderFacts>>> {
        const page = await api.list({
            from: "sales.order",
            select: ["leadId", "orderNo", "status", "amountVnd", "shippedAt", "itemsText", "note"],
            where: q.in("leadId", leadIds),
            order: [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: READ_SIZE },
        })
        const byLead = new Map<string, Array<OrderFacts>>()
        for (const { row } of page.rows) {
            const leadId = textOf(row.data, "leadId")
            if (leadId === null) continue
            pushed(byLead, leadId, {
                id: row.id,
                orderNo: textOf(row.data, "orderNo") ?? "",
                status: textOf(row.data, "status") ?? "draft",
                amountVnd: numberOf(row.data, "amountVnd"),
                isShipped: textOf(row.data, "shippedAt") !== null,
                itemsText: textOf(row.data, "itemsText"),
                note: textOf(row.data, "note"),
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            })
        }
        return byLead
    }

    private async conversations(
        api: EntitiesApi,
        leadIds: ReadonlyArray<string>,
    ): Promise<{ readonly newest: ReadonlyMap<string, ConversationFacts>; readonly zaloLeadIds: ReadonlySet<string> }> {
        const page = await api.list({
            from: "chat.conversation",
            select: ["leadId", "agentId", "status", "lastText", "channel"],
            where: q.in("leadId", leadIds),
            order: [
                ["lastAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: READ_SIZE },
        })
        const newest = new Map<string, ConversationFacts>()
        const zaloLeadIds = new Set<string>()
        for (const { row } of page.rows) {
            const leadId = textOf(row.data, "leadId")
            if (leadId === null) continue
            if (textOf(row.data, "channel") === "zalo") zaloLeadIds.add(leadId)
            if (newest.has(leadId)) continue
            newest.set(leadId, {
                agentId: textOf(row.data, "agentId"),
                status: textOf(row.data, "status") ?? "ai",
                lastText: textOf(row.data, "lastText") ?? "",
                channel: textOf(row.data, "channel") ?? "website",
            })
        }
        return { newest, zaloLeadIds }
    }
}
