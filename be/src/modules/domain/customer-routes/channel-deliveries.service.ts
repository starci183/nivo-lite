import { Inject, Injectable } from "@nestjs/common"
import { ContactsService } from "@modules/domain/contacts/contacts.service"
import {
    CHANNEL_DELIVERY_STORE,
    type ChannelDeliveryStore,
    type DeliveryClaim,
    type OptionalStoredDelivery,
    type StoredDelivery,
} from "./channel-delivery-store.port"
import { CustomerRoutesError, CustomerRoutesErrorCode } from "./errors/customer-routes.error"
import { heldVerdictOf, reclaimableOf, settledStateOf, type ClaimVerdict } from "./delivery.policy"

/** The most rows one page of the ledger holds. */
export const DELIVERIES_PAGE_MAX = 100

/** A cursor of the ledger: the insertion number the next page passes under. */
const CURSOR = /^\d{1,18}$/u

/** What `claim` answers: what the caller does, and the row the ledger keeps for the send key. */
export interface ClaimAnswer {
    /** `send`: this call owns the send and asks the provider. `delivered`: it already went out. `unknown`: an earlier attempt may have gone out: never send it again. */
    readonly verdict: ClaimVerdict
    /** The row of the send key as it stands. */
    readonly row: StoredDelivery
}

/** How an attempt ended. */
export type DeliveryOutcome =
    | { readonly state: "delivered"; readonly providerMessageId: string | null; readonly at: Date }
    | { readonly state: "refused"; readonly reason: string }
    | { readonly state: "unknown"; readonly reason: string | null }

/** How many rows a page asks for, and where it starts. */
export interface DeliveryPageAsk {
    /** The most rows; at most `DELIVERIES_PAGE_MAX`, default 50. */
    readonly limit?: number | undefined
    /** The `next` of the page before; a malformed one starts from the newest. */
    readonly after?: string | null | undefined
}

/** A page of rows, newest first. */
export interface DeliveryPage {
    /** The rows. */
    readonly rows: ReadonlyArray<StoredDelivery>
    /** The cursor of the next page, or null at the end. */
    readonly next: string | null
}

const limitOf = (ask: DeliveryPageAsk): number => Math.max(1, Math.min(ask.limit ?? 50, DELIVERIES_PAGE_MAX))

const afterOf = (ask: DeliveryPageAsk): string | null =>
    ask.after !== null && ask.after !== undefined && CURSOR.test(ask.after) ? ask.after : null

@Injectable()
/**
 * The delivery ledger of the customer messages of any agent: the fence of a send (claimed before the provider is asked, settled after)
 * and the log of what was told. The state machine and the unknown-outcome rule are the ones the chatbot's stored lines kept: a send
 * key claims once; a delivered one answers `delivered`; one in flight or ended uncertain answers `unknown` and no machine sends it
 * again (engine-core rule 9); only a definite refusal may be claimed again. Reads follow a merge of contacts at read time.
 */
export class ChannelDeliveriesService {
    constructor(
        @Inject(CHANNEL_DELIVERY_STORE) private readonly store: ChannelDeliveryStore,
        private readonly contacts: ContactsService,
    ) {}

    /**
     * Claims the send key before the provider is asked: an insert-or-nothing on the unique key, so one try owns the send. The key already
     * held answers by its state; a definitely refused one is taken back in one conditional statement (a lost race answers the winner's state).
     */
    async claim(workspaceId: string, claim: DeliveryClaim, again = false): Promise<ClaimAnswer> {
        if (await this.store.insertClaimed(workspaceId, claim)) return { verdict: "send", row: await this.kept(workspaceId, claim.sendKey) }
        const held = await this.kept(workspaceId, claim.sendKey)
        if (heldVerdictOf(held.state, again) !== "send") return { verdict: heldVerdictOf(held.state, again), row: held }
        if (!(await this.store.reclaim(workspaceId, claim.sendKey, reclaimableOf(again)))) {
            const raced = await this.kept(workspaceId, claim.sendKey)
            return { verdict: heldVerdictOf(raced.state) === "send" ? "unknown" : heldVerdictOf(raced.state), row: raced }
        }
        return { verdict: "send", row: await this.kept(workspaceId, claim.sendKey) }
    }

    /**
     * Settles the send key with the provider's answer and answers the row: a delivered row never changes (marking it again answers it as
     * it is), and a refusal whose reason leaves the outcome uncertain is kept as `unknown`. Null for a key nobody claimed.
     */
    async mark(workspaceId: string, sendKey: string, outcome: DeliveryOutcome): Promise<OptionalStoredDelivery> {
        await this.store.settle(workspaceId, sendKey, this.settleOf(outcome))
        return this.store.byKey(workspaceId, sendKey)
    }

    /** The row of a send key, or null. */
    byKey(workspaceId: string, sendKey: string): Promise<OptionalStoredDelivery> {
        return this.store.byKey(workspaceId, sendKey)
    }

    /** What was told on one route, newest first, bounded, with a cursor. */
    listByRoute(workspaceId: string, routeId: string, ask: DeliveryPageAsk = {}): Promise<DeliveryPage> {
        return this.store.ofRoute(workspaceId, routeId, limitOf(ask), afterOf(ask))
    }

    /** How many messages went out (delivered) with the provider's take in `[from, to)`: the figure the dashboard calls answered. */
    countDelivered(workspaceId: string, from: Date, to: Date): Promise<number> {
        return this.store.countDelivered(workspaceId, from, to)
    }

    /**
     * How many distinct routes were told something (a delivered row) in `[from, to)`: the routes the shop answered on. The routes table
     * keeps no last activity, so this is the figure the dashboard calls conversations.
     */
    routesTold(workspaceId: string, from: Date, to: Date): Promise<number> {
        return this.store.countRoutesTold(workspaceId, from, to)
    }

    /**
     * What one step of one run claimed to send (every state, newest first, bounded): the rows a step that runs again reads to know what
     * it already told. The caller decides which states count.
     */
    listByStep(workspaceId: string, runId: string, stepKey: string, limit: number = 50): Promise<ReadonlyArray<StoredDelivery>> {
        return this.store.ofStep(workspaceId, runId, stepKey, Math.max(1, Math.min(limit, DELIVERIES_PAGE_MAX)))
    }

    /** What was told to one person (under every id merged into them), newest first, bounded, with a cursor. */
    async listByContact(workspaceId: string, contactId: string, ask: DeliveryPageAsk = {}): Promise<DeliveryPage> {
        const current = await this.contacts.activeId(workspaceId, contactId)
        if (current === null) return { rows: [], next: null }
        const aliases = await this.contacts.aliasesOf(workspaceId, current)
        return this.store.ofContacts(workspaceId, aliases, limitOf(ask), afterOf(ask))
    }

    private async kept(workspaceId: string, sendKey: string): Promise<StoredDelivery> {
        const row = await this.store.byKey(workspaceId, sendKey)
        if (row === null) throw new CustomerRoutesError({ code: CustomerRoutesErrorCode.DeliveryMissing })
        return row
    }

    private settleOf(outcome: DeliveryOutcome): Parameters<ChannelDeliveryStore["settle"]>[2] {
        if (outcome.state === "delivered")
            return { state: "delivered", reason: null, providerMessageId: outcome.providerMessageId, deliveredAt: outcome.at }
        const reason = outcome.reason
        return { state: settledStateOf(outcome.state, reason), reason, providerMessageId: null, deliveredAt: null }
    }
}
