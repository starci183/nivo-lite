import { Inject, Injectable } from "@nestjs/common"
import { ContactsService } from "@modules/domain/contacts/contacts.service"
import { CONTACT_CONVERSATION_STORE, type ContactConversationStore } from "./contact-conversation-store.port"
import type { CustomerLine } from "./customer-line-store.port"
import { CustomerRoutesService, ROUTES_PAGE_MAX } from "./customer-routes.service"
import { cursorOf, cursorTextOf } from "./line-cursor.policy"

/** The most lines one page of a person's conversation holds. */
export const CONTACT_LINES_MAX = 50

/** A route of a person as the contacts page shows it: the entrance, the activity on it and who holds it. */
export interface ContactRouteSummary {
    /** The route id. */
    readonly routeId: string
    /** The channel. */
    readonly channel: string
    /** The connection, site or API key of the entrance, or null. */
    readonly accountId: string | null
    /** When the route was born (ISO text). */
    readonly createdAt: string
    /** When the newest line of the route was said (ISO text), or null when nothing was said on it yet. */
    readonly lastLineAt: string | null
    /** The agent that spoke last on the route, or null when none has. */
    readonly lastAgentId: string | null
    /** The staff hold (R43): the member who took the thread over and when, or null when the agents speak on it. */
    readonly hold: { readonly memberId: string; readonly at: string } | null
}

/** What a page of a person's conversation asks. */
export interface ContactLinesPageAsk {
    /** One route of the person; absent or null reads every route, merged by time. */
    readonly routeId?: string | null | undefined
    /** The `next` of the page before (strictly older lines follow); a malformed one starts at the newest. */
    readonly before?: string | null | undefined
    /** The most lines, from 1 to `CONTACT_LINES_MAX`; default 30. */
    readonly limit?: number | undefined
}

/** A page of a person's conversation, newest first. */
export interface ContactLinesPage {
    /** The lines. */
    readonly rows: ReadonlyArray<CustomerLine>
    /** The cursor of the next (older) page, or null at the end. */
    readonly next: string | null
}

@Injectable()
/**
 * The routes of a person and their whole conversation as the contacts page reads them (R26: engine data per route): the routes with the
 * activity on each and the staff hold, and ONE merged, newest-first, cursor-paged read of the lines of every route (or one). A merged
 * contact is followed to its survivor; a deleted contact (R31) and a route of a removed connection (R36) answer nothing.
 */
export class ContactConversationService {
    constructor(
        @Inject(CONTACT_CONVERSATION_STORE) private readonly store: ContactConversationStore,
        private readonly routes: CustomerRoutesService,
        private readonly contacts: ContactsService,
    ) {}

    /** The routes of the person, the most recently spoken on first (a route nobody spoke on by its birth), at most `ROUTES_PAGE_MAX`. */
    async routesOf(workspaceId: string, contactId: string): Promise<ReadonlyArray<ContactRouteSummary>> {
        const routes = await this.routes.listByContact(workspaceId, contactId, ROUTES_PAGE_MAX)
        if (routes.length === 0) return []
        const ids = routes.map((route) => route.id)
        const [activity, holds] = await Promise.all([this.store.activityOf(workspaceId, ids), this.store.holdsOf(workspaceId, ids)])
        const activityOf = new Map(activity.map((row) => [row.routeId, row]))
        const holdOf = new Map(holds.map((row) => [row.routeId, row]))
        return routes
            .map((route): ContactRouteSummary => {
                const held = holdOf.get(route.id)
                const seen = activityOf.get(route.id)
                return {
                    routeId: route.id,
                    channel: route.channel,
                    accountId: route.accountId,
                    createdAt: route.createdAt,
                    lastLineAt: seen?.lastLineAt ?? null,
                    lastAgentId: seen?.lastAgentId ?? null,
                    hold: held === undefined ? null : { memberId: held.memberId, at: held.at },
                }
            })
            .toSorted((left, right) => (right.lastLineAt ?? right.createdAt).localeCompare(left.lastLineAt ?? left.createdAt))
    }

    /** One page of the person's lines, every route merged by time or one route, newest first, with the cursor of the older page. */
    async linesOf(workspaceId: string, contactId: string, ask: ContactLinesPageAsk = {}): Promise<ContactLinesPage> {
        const current = await this.contacts.activeId(workspaceId, contactId)
        if (current === null) return { rows: [], next: null }
        const aliases = await this.contacts.aliasesOf(workspaceId, current)
        const page = await this.store.linesOf(workspaceId, aliases, {
            routeId: ask.routeId ?? null,
            before: cursorOf(ask.before),
            limit: Math.max(1, Math.min(ask.limit ?? 30, CONTACT_LINES_MAX)),
        })
        return { rows: page.rows, next: page.next === null ? null : cursorTextOf(page.next) }
    }
}
