import { mock } from "@starci/jest-preset"
import type { ContactsService } from "@modules/domain/contacts/contacts.service"
import type { ContactConversationStore, ContactLinesAsk, RouteActivity } from "./contact-conversation-store.port"
import { CONTACT_LINES_MAX, ContactConversationService } from "./contact-conversation.service"
import type { CustomerLine, CustomerLineRows } from "./customer-line-store.port"
import type { HeldRoute } from "./customer-route-store.port"
import { ROUTES_PAGE_MAX, type CustomerRoute, type CustomerRoutesService } from "./customer-routes.service"

const WS = "11111111-1111-4111-8111-111111111111"

const lineOf = (seq: number, routeId: string, at: string, over: Partial<CustomerLine> = {}): CustomerLine => ({
    id: `l${String(seq)}`,
    seq: String(seq),
    routeId,
    contactId: "c1",
    direction: "from_person",
    key: `k${String(seq)}`,
    saidAt: at,
    text: `line ${String(seq)}`,
    files: [],
    order: null,
    eventId: null,
    agentId: null,
    memberId: null,
    runId: null,
    stepKey: null,
    state: null,
    reason: null,
    channel: routeId === "r-zalo" ? "zalo" : "telegram",
    accountId: null,
    deliveredAt: null,
    ...over,
})

/** A store that keeps lines in memory and pages them the way the SQL does: newest first by (said at, insertion order), strictly older than the cursor. */
class MemoryConversationStore implements ContactConversationStore {
    readonly asks: Array<{ readonly contactIds: ReadonlyArray<string>; readonly ask: ContactLinesAsk }> = []
    activity: ReadonlyArray<RouteActivity> = []
    holds: ReadonlyArray<HeldRoute> = []

    constructor(private readonly lines: ReadonlyArray<CustomerLine>) {}

    activityOf(): Promise<ReadonlyArray<RouteActivity>> {
        return Promise.resolve(this.activity)
    }

    holdsOf(): Promise<ReadonlyArray<HeldRoute>> {
        return Promise.resolve(this.holds)
    }

    linesOf(_workspaceId: string, contactIds: ReadonlyArray<string>, ask: ContactLinesAsk): Promise<CustomerLineRows> {
        this.asks.push({ contactIds, ask })
        const ordered = this.lines
            .filter((line) => contactIds.includes(line.contactId) && (ask.routeId === null || line.routeId === ask.routeId))
            .toSorted((left, right) => Date.parse(right.saidAt) - Date.parse(left.saidAt) || Number(right.seq) - Number(left.seq))
            .filter(
                (line) =>
                    ask.before === null ||
                    Date.parse(line.saidAt) < ask.before.saidAt.getTime() ||
                    (Date.parse(line.saidAt) === ask.before.saidAt.getTime() && Number(line.seq) < Number(ask.before.seq)),
            )
        const rows = ordered.slice(0, ask.limit)
        const last = rows.at(-1)
        return Promise.resolve({
            rows,
            next: ordered.length > ask.limit && last !== undefined ? { saidAt: new Date(last.saidAt), seq: last.seq } : null,
        })
    }
}

const routeOf = (id: string, channel: string, createdAt: string, accountId: string | null = null): CustomerRoute => ({
    id,
    contactId: "c1",
    channel,
    accountId,
    createdAt,
})

const build = (lines: ReadonlyArray<CustomerLine> = [], active: string | null = "c1") => {
    const store = new MemoryConversationStore(lines)
    const routes = mock<CustomerRoutesService>()
    const contacts = mock<ContactsService>()
    contacts.activeId.mockResolvedValue(active)
    contacts.aliasesOf.mockResolvedValue(active === null ? [] : [active, "c-merged"])
    return { store, routes, contacts, service: new ContactConversationService(store, routes, contacts) }
}

describe("ContactConversationService.linesOf", () => {
    // Two routes of one person; the lines interleave in time, and three lines share the same instant (the tie-break is the insertion order).
    const LINES = [
        lineOf(1, "r-zalo", "2026-11-14T08:00:00.000Z"),
        lineOf(2, "r-tg", "2026-11-14T08:01:00.000Z", { direction: "to_person", agentId: "agent-1", state: "delivered" }),
        lineOf(3, "r-zalo", "2026-11-14T08:02:00.000Z"),
        lineOf(4, "r-tg", "2026-11-14T08:02:00.000Z"),
        lineOf(5, "r-zalo", "2026-11-14T08:02:00.000Z", { direction: "to_person", memberId: "member-1" }),
        lineOf(6, "r-tg", "2026-11-14T08:03:00.000Z"),
    ]

    it("pages the lines of two routes as ONE thread, newest first, with no line repeated or dropped across pages (a shared instant breaks by insertion order)", async () => {
        const { service, store } = build(LINES)

        const first = await service.linesOf(WS, "c1", { limit: 2 })
        const second = await service.linesOf(WS, "c1", { limit: 2, before: first.next })
        const third = await service.linesOf(WS, "c1", { limit: 2, before: second.next })

        expect(first.rows.map((line) => line.id)).toEqual(["l6", "l5"])
        expect(second.rows.map((line) => line.id)).toEqual(["l4", "l3"])
        expect(third.rows.map((line) => line.id)).toEqual(["l2", "l1"])
        expect(first.next).not.toBeNull()
        expect(second.next).not.toBeNull()
        expect(third.next).toBeNull()
        expect(new Set([...first.rows, ...second.rows, ...third.rows].map((line) => line.routeId))).toEqual(new Set(["r-zalo", "r-tg"]))
        expect(store.asks.every((call) => call.contactIds.join() === "c1,c-merged")).toBe(true)
    })

    it("reads one route when the page names it, and the cursor continues that route only", async () => {
        const { service, store } = build(LINES)

        const first = await service.linesOf(WS, "c1", { routeId: "r-tg", limit: 2 })
        const second = await service.linesOf(WS, "c1", { routeId: "r-tg", limit: 2, before: first.next })

        expect(first.rows.map((line) => line.id)).toEqual(["l6", "l4"])
        expect(second.rows.map((line) => line.id)).toEqual(["l2"])
        expect(second.next).toBeNull()
        expect(store.asks.map((call) => call.ask.routeId)).toEqual(["r-tg", "r-tg"])
    })

    it("answers an empty page for a route of another person: the lines are found by the contact first", async () => {
        const { service } = build(LINES)

        await expect(service.linesOf(WS, "c1", { routeId: "r-of-someone-else" })).resolves.toEqual({ rows: [], next: null })
    })

    it("answers nothing, and reads nothing, for a deleted or unknown contact (soft delete, R31)", async () => {
        const { service, store, contacts } = build(LINES, null)

        await expect(service.linesOf(WS, "c1")).resolves.toEqual({ rows: [], next: null })
        expect(contacts.aliasesOf).not.toHaveBeenCalled()
        expect(store.asks).toEqual([])
    })

    it("follows a merged contact to its survivor and the ids merged into it", async () => {
        const { service, contacts, store } = build(LINES)

        await service.linesOf(WS, "merged-away")

        expect(contacts.activeId).toHaveBeenCalledWith(WS, "merged-away")
        expect(contacts.aliasesOf).toHaveBeenCalledWith(WS, "c1")
        expect(store.asks[0]?.contactIds).toEqual(["c1", "c-merged"])
    })

    it("bounds the page (1 to the maximum, 30 by default) and starts at the newest for a malformed cursor", async () => {
        const { service, store } = build(LINES)

        await service.linesOf(WS, "c1", { limit: 5000, before: "garbage" })
        await service.linesOf(WS, "c1", { limit: 0 })
        await service.linesOf(WS, "c1")

        expect(store.asks.map((call) => call.ask.limit)).toEqual([CONTACT_LINES_MAX, 1, 30])
        expect(store.asks[0]?.ask.before).toBeNull()
    })
})

describe("ContactConversationService.routesOf", () => {
    it("lists the routes of a person, the most recently spoken on first, with the last activity, the last agent and the staff hold", async () => {
        const { service, store, routes } = build()
        routes.listByContact.mockResolvedValue([
            routeOf("r-zalo", "zalo", "2026-11-01T00:00:00.000Z", "conn-zalo"),
            routeOf("r-tg", "telegram", "2026-11-02T00:00:00.000Z", "conn-tg"),
            routeOf("r-web", "website", "2026-11-03T00:00:00.000Z", "site-1"),
        ])
        store.activity = [
            { routeId: "r-zalo", lastLineAt: "2026-11-14T09:00:00.000Z", lastAgentId: "agent-1" },
            { routeId: "r-tg", lastLineAt: "2026-11-14T10:00:00.000Z", lastAgentId: null },
        ]
        store.holds = [{ routeId: "r-zalo", memberId: "member-1", at: "2026-11-14T08:30:00.000Z" }]

        const summaries = await service.routesOf(WS, "c1")

        expect(routes.listByContact).toHaveBeenCalledWith(WS, "c1", ROUTES_PAGE_MAX)
        expect(summaries).toEqual([
            {
                routeId: "r-tg",
                channel: "telegram",
                accountId: "conn-tg",
                createdAt: "2026-11-02T00:00:00.000Z",
                lastLineAt: "2026-11-14T10:00:00.000Z",
                lastAgentId: null,
                hold: null,
            },
            {
                routeId: "r-zalo",
                channel: "zalo",
                accountId: "conn-zalo",
                createdAt: "2026-11-01T00:00:00.000Z",
                lastLineAt: "2026-11-14T09:00:00.000Z",
                lastAgentId: "agent-1",
                hold: { memberId: "member-1", at: "2026-11-14T08:30:00.000Z" },
            },
            {
                routeId: "r-web",
                channel: "website",
                accountId: "site-1",
                createdAt: "2026-11-03T00:00:00.000Z",
                lastLineAt: null,
                lastAgentId: null,
                hold: null,
            },
        ])
    })

    it("answers none for a person with no live route: a deleted contact and a removed connection leave no route to read", async () => {
        const { service, routes } = build()
        routes.listByContact.mockResolvedValue([])

        await expect(service.routesOf(WS, "c1")).resolves.toEqual([])
    })
})
