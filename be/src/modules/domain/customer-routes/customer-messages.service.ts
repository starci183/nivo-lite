import { Inject, Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ContactsService } from "@modules/domain/contacts/contacts.service"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type { CustomerLineFile } from "./channel-delivery-store.port"
import {
    CUSTOMER_LINE_STORE,
    type CustomerLine,
    type CustomerLineRows,
    type CustomerLineStore,
    type LineCursor,
    type LineWindowAsk,
} from "./customer-line-store.port"

/** The most lines one page of a thread holds. */
export const LINES_PAGE_MAX = 100

/** The longest words of a heard line the engine keeps (a channel message is far shorter; the bound guards the row). */
export const HEARD_TEXT_MAX = 20_000

/** The longest once-key of a line (the table's check). */
const KEY_MAX = 200

/** A cursor of a thread: the said-at instant in milliseconds, a dot, the insertion number. */
const CURSOR = /^(\d{1,15})\.(\d{1,18})$/u

/** A line the person said, as the engine's delivery hands it over. */
export interface HearLine {
    readonly workspaceId: string
    /** The route the engine ensured for the person on the account. */
    readonly routeId: string
    /** The person. */
    readonly contactId: string
    /** The channel of the person's identity. */
    readonly channel: string
    /** The account the message came in on, or null. */
    readonly accountId: string | null
    /** The source's own id of the message (the line is written once per route under it). */
    readonly key: string
    /** The canonical words. */
    readonly text: string
    /** When the channel says it was sent (ISO), or null: then when the engine received it. */
    readonly at: string | null
    /** The files the entry kept, by address. */
    readonly files: ReadonlyArray<{ readonly id?: string | undefined; readonly url: string; readonly name: string; readonly contentType: string }>
    /** The canonical event it came in with. */
    readonly eventId: string | null
}

/** How many lines a page asks for, where it starts, and which sent lines count. */
export interface LinePageAsk {
    /** The most lines; at most `LINES_PAGE_MAX`, default 50. */
    readonly limit?: number | undefined
    /** The `next` of the page before; a malformed one starts from the newest. */
    readonly after?: string | null | undefined
    /** Lines said at or after this instant (ISO) only, e.g. a chatbot's visit; a malformed one reads every line. */
    readonly since?: string | null | undefined
    /** `delivered`: of the sent lines only those the provider took (what the customer was told); `all` (default): every state. */
    readonly told?: "all" | "delivered" | undefined
}

/** A page of lines, newest first. */
export interface LinePage {
    readonly rows: ReadonlyArray<CustomerLine>
    /** The cursor of the next (older) page, or null at the end. */
    readonly next: string | null
}

const limitOf = (ask: LinePageAsk): number => Math.max(1, Math.min(ask.limit ?? 50, LINES_PAGE_MAX))

const cursorOf = (value: string | null | undefined): LineCursor | null => {
    const match = value === null || value === undefined ? null : CURSOR.exec(value)
    if (match === null) return null
    const [, ms, seq] = match
    return ms === undefined || seq === undefined ? null : { saidAt: new Date(Number(ms)), seq }
}

const sinceOf = (value: string | null | undefined): Date | null => {
    const ms = value === null || value === undefined ? Number.NaN : Date.parse(value)
    return Number.isNaN(ms) ? null : new Date(ms)
}

const windowAskOf = (ask: LinePageAsk): LineWindowAsk => ({
    limit: limitOf(ask),
    before: cursorOf(ask.after),
    since: sinceOf(ask.since),
    toldStates: ask.told === "delivered" ? ["delivered"] : null,
})

const pageOf = (rows: CustomerLineRows): LinePage => ({
    rows: rows.rows,
    next: rows.next === null ? null : `${String(rows.next.saidAt.getTime())}.${rows.next.seq}`,
})

const fileOf = (file: HearLine["files"][number]): CustomerLineFile => ({ url: file.url, name: file.name, contentType: file.contentType })

@Injectable()
/**
 * THE CONVERSATION WITH A CUSTOMER as engine data (owner ruling R26): the lines of a route in both directions, one time order. A line the
 * person said is written here ONCE by the engine's one delivery function (from the source's pure mapping of its event); a line said to
 * the person is the send's ledger row (`ChannelDeliveriesService`). Every reader (any agent's thread read, the people-facing reads, the
 * reply window) reads it here; no plugin keeps a copy of the words. Reads follow a merge of contacts at read time. The lines of a deleted
 * contact STAY in the table and no read here returns them (soft delete, owner ruling R31: the store joins the live contact).
 */
export class CustomerMessagesService {
    constructor(
        @Inject(CUSTOMER_LINE_STORE) private readonly store: CustomerLineStore,
        private readonly contacts: ContactsService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /**
     * Keeps a line the person said, once on its route, in the caller's transaction (the delivery's: the raw row, the line and the wakes
     * commit together). Its time is the channel's, never later than now (a channel with no time, or a clock ahead: now). A key that is no
     * key (empty, too long) keeps nothing and answers null. Answers the line's id and whether this call wrote it.
     */
    async hear(tx: EntityManager, line: HearLine): Promise<{ readonly id: string; readonly written: boolean } | null> {
        if (line.key === "" || line.key.length > KEY_MAX) return null
        const now = this.clock.now()
        const told = line.at === null ? Number.NaN : Date.parse(line.at)
        const saidAt = Number.isNaN(told) || told > now.getTime() ? now : new Date(told)
        return this.store.insertHeard(tx, line.workspaceId, {
            routeId: line.routeId,
            contactId: line.contactId,
            channel: line.channel,
            accountId: line.accountId,
            key: line.key,
            text: line.text.slice(0, HEARD_TEXT_MAX),
            saidAt,
            files: line.files.map((file) => fileOf(file)),
            eventId: line.eventId,
        })
    }

    /** The lines of one route, both directions, newest first, bounded, with a cursor. */
    async threadOf(workspaceId: string, routeId: string, ask: LinePageAsk = {}): Promise<LinePage> {
        return pageOf(await this.store.windowOf(workspaceId, [routeId], windowAskOf(ask)))
    }

    /** The lines of one person (every route, under every id merged into them), newest first, bounded, with a cursor. */
    async ofContact(workspaceId: string, contactId: string, ask: LinePageAsk = {}): Promise<LinePage> {
        const current = await this.contacts.activeId(workspaceId, contactId)
        if (current === null) return { rows: [], next: null }
        const aliases = await this.contacts.aliasesOf(workspaceId, current)
        return pageOf(await this.store.ofContacts(workspaceId, aliases, windowAskOf(ask)))
    }

    /** When the person last said something on the route (the start of a channel's reply window), or null when never. */
    lastHeardAt(workspaceId: string, routeId: string): Promise<Date | null> {
        return this.store.lastHeardAt(workspaceId, routeId)
    }
}
