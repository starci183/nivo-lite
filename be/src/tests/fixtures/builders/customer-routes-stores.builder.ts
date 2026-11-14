import type {
    ChannelDeliveryStore,
    DeliveryClaim,
    DeliveryRows,
    DeliverySettle,
    StoredDelivery,
} from "@modules/domain/customer-routes/channel-delivery-store.port"
import type {
    CustomerLine,
    CustomerLineRows,
    CustomerLineStore,
    HeardLineRow,
    LineWindowAsk,
} from "@modules/domain/customer-routes/customer-line-store.port"
import type { CustomerRouteStore, HeldRoutesPage, NewCustomerRoute, RouteHold, StoredCustomerRoute } from "@modules/domain/customer-routes/customer-route-store.port"

// THE CUSTOMER ROUTES AND THE DELIVERY LEDGER IN MEMORY: the doubles of the stores of public.customer_routes and
// public.channel_deliveries, for the unit specs and the thread worlds. Each keeps the rows its table keeps and the unique keys the table
// declares (the route's workspace + contact + channel + account, with a null account standing for itself; the ledger's workspace + send
// key), and answers an insert-or-nothing exactly as the table does. A double changes only HOW it stores, never what it answers.

const NO_ACCOUNT = "-"

const entranceKeyOf = (workspaceId: string, route: Pick<NewCustomerRoute, "contactId" | "channel" | "accountId">): string =>
    [workspaceId, route.contactId, route.channel, route.accountId ?? NO_ACCOUNT].join("|")

/** The routes (public.customer_routes) in memory. */
export class MemoryCustomerRouteStore implements CustomerRouteStore {
    /** The routes with their workspace, in the order first written. */
    readonly rows: Array<StoredCustomerRoute & { readonly workspaceId: string }> = []

    /** How many inserts were asked, won or lost. */
    inserts = 0

    private next = 0

    /** The staff holds by route id (ruling R43). */
    readonly holds = new Map<string, RouteHold>()

    holdOf(workspaceId: string, routeId: string): Promise<RouteHold | null> {
        const live = this.rows.some((row) => row.workspaceId === workspaceId && row.id === routeId)
        return Promise.resolve(live ? (this.holds.get(routeId) ?? null) : null)
    }

    held(workspaceId: string, limit: number): Promise<HeldRoutesPage> {
        const routes = [...this.holds.entries()]
            .filter(([routeId]) => this.rows.some((row) => row.workspaceId === workspaceId && row.id === routeId))
            .map(([routeId, hold]) => ({ routeId, ...hold }))
            .sort((a, b) => b.at.localeCompare(a.at))
        return Promise.resolve({ count: routes.length, routes: routes.slice(0, limit) })
    }

    hold(workspaceId: string, routeId: string, memberId: string): Promise<boolean> {
        if (!this.rows.some((row) => row.workspaceId === workspaceId && row.id === routeId)) return Promise.resolve(false)
        if (this.holds.get(routeId)?.memberId !== memberId)
            this.holds.set(routeId, { memberId, at: new Date(Date.UTC(2026, 10, 13, 12, 30, 0)).toISOString() })
        return Promise.resolve(true)
    }

    release(_workspaceId: string, routeId: string): Promise<RouteHold | null> {
        const held = this.holds.get(routeId) ?? null
        this.holds.delete(routeId)
        return Promise.resolve(held)
    }

    byId(workspaceId: string, routeId: string): Promise<StoredCustomerRoute | null> {
        const found = this.rows.find((row) => row.workspaceId === workspaceId && row.id === routeId)
        return Promise.resolve(found === undefined ? null : { ...found })
    }

    ofEntrance(
        workspaceId: string,
        contactIds: ReadonlyArray<string>,
        channel: string,
        accountId: string | null,
    ): Promise<StoredCustomerRoute | null> {
        const found = this.rows.find(
            (row) =>
                row.workspaceId === workspaceId &&
                contactIds.includes(row.contactId) &&
                row.channel === channel &&
                row.accountId === accountId,
        )
        return Promise.resolve(found === undefined ? null : { ...found })
    }

    ofContacts(workspaceId: string, contactIds: ReadonlyArray<string>, limit: number): Promise<ReadonlyArray<StoredCustomerRoute>> {
        return Promise.resolve(
            this.rows
                .filter((row) => row.workspaceId === workspaceId && contactIds.includes(row.contactId))
                .slice(0, limit)
                .map((row) => ({ ...row })),
        )
    }

    insert(workspaceId: string, route: NewCustomerRoute): Promise<string | null> {
        this.inserts += 1
        const key = entranceKeyOf(workspaceId, route)
        if (this.rows.some((row) => entranceKeyOf(row.workspaceId, row) === key)) return Promise.resolve(null)
        if (route.id !== undefined && this.rows.some((row) => row.id === route.id)) return Promise.resolve(null)
        this.next += 1
        const id = route.id ?? `route-${this.next}`
        this.rows.push({
            workspaceId,
            id,
            contactId: route.contactId,
            channel: route.channel,
            accountId: route.accountId,
            createdAt: new Date(Date.UTC(2026, 10, 13, 12, 0, this.next)).toISOString(),
        })
        return Promise.resolve(id)
    }
}

/** The delivery ledger (public.channel_deliveries) in memory: unique per workspace and send key, ordered by insertion. */
export class MemoryChannelDeliveryStore implements ChannelDeliveryStore {
    /** The rows with their workspace, in the order first written. */
    readonly rows: Array<StoredDelivery & { readonly workspaceId: string }> = []

    private next = 0

    byKey(workspaceId: string, sendKey: string): Promise<StoredDelivery | null> {
        const found = this.rows.find((row) => row.workspaceId === workspaceId && row.sendKey === sendKey)
        return Promise.resolve(found === undefined ? null : { ...found })
    }

    insertClaimed(workspaceId: string, claim: DeliveryClaim): Promise<boolean> {
        if (this.rows.some((row) => row.workspaceId === workspaceId && row.sendKey === claim.sendKey)) return Promise.resolve(false)
        this.next += 1
        this.rows.push({
            workspaceId,
            id: `delivery-${this.next}`,
            seq: String(this.next),
            sendKey: claim.sendKey,
            routeId: claim.routeId,
            contactId: claim.contactId,
            agentId: claim.agentId,
            runId: claim.runId,
            stepKey: claim.stepKey,
            text: claim.text,
            attachmentCount: claim.attachmentCount,
            attachmentKinds: [...claim.attachmentKinds],
            state: "claimed",
            reason: null,
            providerMessageId: null,
            channel: claim.channel,
            accountId: claim.accountId,
            createdAt: new Date(Date.UTC(2026, 10, 13, 12, 0, this.next)).toISOString(),
            deliveredAt: null,
        })
        return Promise.resolve(true)
    }

    reclaim(workspaceId: string, sendKey: string, from: ReadonlyArray<"refused" | "unknown">): Promise<boolean> {
        const at = this.rows.findIndex(
            (row) => row.workspaceId === workspaceId && row.sendKey === sendKey && (from as ReadonlyArray<string>).includes(row.state),
        )
        const held = this.rows[at]
        if (held === undefined) return Promise.resolve(false)
        this.rows[at] = { ...held, state: "claimed", reason: null }
        return Promise.resolve(true)
    }

    settle(workspaceId: string, sendKey: string, values: DeliverySettle): Promise<boolean> {
        const at = this.rows.findIndex((row) => row.workspaceId === workspaceId && row.sendKey === sendKey && row.state !== "delivered")
        const held = this.rows[at]
        if (held === undefined) return Promise.resolve(false)
        this.rows[at] = {
            ...held,
            state: values.state,
            reason: values.reason,
            providerMessageId: values.providerMessageId,
            deliveredAt: values.deliveredAt === null ? null : values.deliveredAt.toISOString(),
        }
        return Promise.resolve(true)
    }

    ofRoute(workspaceId: string, routeId: string, limit: number, after: string | null): Promise<DeliveryRows> {
        return Promise.resolve(this.page((row) => row.workspaceId === workspaceId && row.routeId === routeId, limit, after))
    }

    ofStep(workspaceId: string, runId: string, stepKey: string, limit: number): Promise<ReadonlyArray<StoredDelivery>> {
        return Promise.resolve(
            this.rows
                .filter((row) => row.workspaceId === workspaceId && row.runId === runId && row.stepKey === stepKey)
                .toSorted((left, right) => Number(right.seq) - Number(left.seq))
                .slice(0, limit)
                .map((row) => ({ ...row })),
        )
    }

    countDelivered(workspaceId: string, from: Date, to: Date): Promise<number> {
        return Promise.resolve(this.deliveredIn(workspaceId, from, to).length)
    }

    countRoutesTold(workspaceId: string, from: Date, to: Date): Promise<number> {
        return Promise.resolve(new Set(this.deliveredIn(workspaceId, from, to).map((row) => row.routeId)).size)
    }

    private deliveredIn(workspaceId: string, from: Date, to: Date): ReadonlyArray<StoredDelivery> {
        return this.rows.filter(
            (row) =>
                row.workspaceId === workspaceId &&
                row.state === "delivered" &&
                row.deliveredAt !== null &&
                row.deliveredAt >= from.toISOString() &&
                row.deliveredAt < to.toISOString(),
        )
    }

    ofContacts(workspaceId: string, contactIds: ReadonlyArray<string>, limit: number, after: string | null): Promise<DeliveryRows> {
        return Promise.resolve(
            this.page((row) => row.workspaceId === workspaceId && contactIds.includes(row.contactId), limit, after),
        )
    }

    private page(matches: (row: StoredDelivery & { readonly workspaceId: string }) => boolean, limit: number, after: string | null): DeliveryRows {
        const found = this.rows
            .filter((row) => matches(row) && (after === null || Number(row.seq) < Number(after)))
            .toSorted((left, right) => Number(right.seq) - Number(left.seq))
        const kept = found.slice(0, limit).map((row) => ({ ...row }))
        const last = kept.at(-1)
        return { rows: kept, next: found.length > limit && last !== undefined ? last.seq : null }
    }
}

/**
 * The engine's store of the conversation with a customer (`public.customer_messages`), as the table behaves, for a world: the lines the person said
 * (once per route and key) and, as the SAME thread, the lines said to them, which are the rows of the world's delivery ledger. Newest first by
 * said-at (a sent line's said-at is its claim), then insertion order.
 */
export class MemoryCustomerLineStore implements CustomerLineStore {
    /** The lines the person said. */
    readonly heard: Array<CustomerLine> = []

    private seq = 1000

    constructor(
        private readonly sent: MemoryChannelDeliveryStore,
        private readonly contactIds: (contactId: string) => ReadonlyArray<string> = (contactId) => [contactId],
    ) {}

    insertHeard(_manager: unknown, _workspaceId: string, line: HeardLineRow): Promise<{ id: string; written: boolean }> {
        const kept = this.heard.find((row) => row.routeId === line.routeId && row.key === line.key)
        if (kept !== undefined) return Promise.resolve({ id: kept.id, written: false })
        this.seq += 1
        const row: CustomerLine = {
            id: `heard-${String(this.seq)}`,
            seq: String(this.seq),
            routeId: line.routeId,
            contactId: line.contactId,
            direction: "from_person",
            key: line.key,
            saidAt: line.saidAt.toISOString(),
            text: line.text,
            files: line.files,
            order: null,
            eventId: line.eventId,
            agentId: null,
            memberId: null,
            runId: null,
            stepKey: null,
            state: null,
            reason: null,
            channel: line.channel,
            accountId: line.accountId,
            deliveredAt: null,
        }
        this.heard.push(row)
        return Promise.resolve({ id: row.id, written: true })
    }

    /** Every line, both directions: the heard ones and the ledger's rows as `to_person` lines. */
    private all(): ReadonlyArray<CustomerLine> {
        const told: ReadonlyArray<CustomerLine> = this.sent.rows.map((row) => ({
            id: row.id,
            seq: String(2000 + Number(row.seq)),
            routeId: row.routeId,
            contactId: row.contactId,
            direction: "to_person",
            key: row.sendKey,
            saidAt: row.createdAt,
            text: row.text,
            files: [],
            order: null,
            eventId: null,
            agentId: row.agentId,
            memberId: null,
            runId: row.runId,
            stepKey: row.stepKey,
            state: row.state,
            reason: row.reason,
            channel: row.channel,
            accountId: row.accountId,
            deliveredAt: row.deliveredAt,
        }))
        return [...this.heard, ...told]
    }

    private windowed(rows: ReadonlyArray<CustomerLine>, ask: LineWindowAsk): CustomerLineRows {
        const since = ask.since?.toISOString() ?? null
        const kept = rows
            .filter((row) => (since === null ? true : row.saidAt >= since))
            .filter((row) => row.direction === "from_person" || ask.toldStates === null || (row.state !== null && ask.toldStates.includes(row.state)))
            .toSorted((a, b) => b.saidAt.localeCompare(a.saidAt) || Number(b.seq) - Number(a.seq))
        return { rows: kept.slice(0, ask.limit), next: null }
    }

    windowOf(_workspaceId: string, routeIds: ReadonlyArray<string>, ask: LineWindowAsk): Promise<CustomerLineRows> {
        return Promise.resolve(this.windowed(this.all().filter((row) => routeIds.includes(row.routeId)), ask))
    }

    ofContacts(_workspaceId: string, contactIds: ReadonlyArray<string>, ask: LineWindowAsk): Promise<CustomerLineRows> {
        const ids = contactIds.flatMap((id) => this.contactIds(id))
        return Promise.resolve(this.windowed(this.all().filter((row) => ids.includes(row.contactId)), ask))
    }

    lastHeardAt(_workspaceId: string, routeId: string): Promise<Date | null> {
        const last = this.heard.filter((row) => row.routeId === routeId).map((row) => row.saidAt).toSorted().at(-1)
        return Promise.resolve(last === undefined ? null : new Date(last))
    }
}
