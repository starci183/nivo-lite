import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ContactsService } from "@modules/domain/contacts/contacts.service"
import { MemoryChannelDeliveryStore } from "@tests/fixtures/builders/customer-routes-stores.builder"
import { CHANNEL_DELIVERY_STORE, type DeliveryClaim } from "./channel-delivery-store.port"
import { ChannelDeliveriesService } from "./channel-deliveries.service"

const WS = "ws-1"
const AT = new Date("2026-11-13T12:30:00.000Z")

const claimOf = (sendKey: string, over: Partial<DeliveryClaim> = {}): DeliveryClaim => ({
    sendKey,
    routeId: "route-1",
    contactId: "contact-1",
    agentId: "agent-sales",
    runId: "run-1",
    stepKey: "tell",
    text: "Đơn của bạn đã xong",
    attachmentCount: 1,
    attachmentKinds: ["image"],
    channel: "zalo",
    accountId: "conn-1",
    ...over,
})

const build = async () => {
    const store = new MemoryChannelDeliveryStore()
    const contacts = mock<ContactsService>()
    contacts.activeId.mockImplementation((_ws, id) => Promise.resolve(id === "contact-old" ? "contact-1" : id === "contact-gone" ? null : id))
    contacts.aliasesOf.mockImplementation((_ws, id) => Promise.resolve(id === "contact-1" ? ["contact-1", "contact-old"] : [id]))
    const moduleRef = await Test.createTestingModule({
        providers: [ChannelDeliveriesService, { provide: CHANNEL_DELIVERY_STORE, useValue: store }, { provide: ContactsService, useValue: contacts }],
    }).compile()
    return { service: moduleRef.get(ChannelDeliveriesService), store }
}

describe("ChannelDeliveriesService.claim", () => {
    it("lets the first try send and keeps the claimed row with the whole send", async () => {
        const { service, store } = await build()

        const answer = await service.claim(WS, claimOf("k1"))

        expect(answer.verdict).toBe("send")
        expect(answer.row).toMatchObject({
            sendKey: "k1",
            state: "claimed",
            routeId: "route-1",
            contactId: "contact-1",
            agentId: "agent-sales",
            runId: "run-1",
            stepKey: "tell",
            attachmentCount: 1,
            attachmentKinds: ["image"],
            channel: "zalo",
            accountId: "conn-1",
        })
        expect(store.rows).toHaveLength(1)
    })

    it("never lets a second try send while the first is in flight or crashed before it settled: the outcome is unknown", async () => {
        const { service, store } = await build()
        await service.claim(WS, claimOf("k1"))

        const second = await service.claim(WS, claimOf("k1"))

        expect(second.verdict).toBe("unknown")
        expect(second.row.state).toBe("claimed")
        expect(store.rows).toHaveLength(1)
    })

    it("answers delivered for a key whose message went out, and never changes that row", async () => {
        const { service } = await build()
        await service.claim(WS, claimOf("k1"))
        await service.mark(WS, "k1", { state: "delivered", providerMessageId: "m-9", at: AT })

        const replay = await service.claim(WS, claimOf("k1"))
        const late = await service.mark(WS, "k1", { state: "refused", reason: "delivery_rejected" })

        expect(replay.verdict).toBe("delivered")
        expect(replay.row).toMatchObject({ state: "delivered", providerMessageId: "m-9", deliveredAt: AT.toISOString(), reason: null })
        expect(late).toMatchObject({ state: "delivered", providerMessageId: "m-9" })
    })

    it("lets a definitely refused key be claimed again once: a second claimer meanwhile answers unknown", async () => {
        const { service, store } = await build()
        await service.claim(WS, claimOf("k1"))
        await service.mark(WS, "k1", { state: "refused", reason: "recipient_not_linked" })

        const [left, right] = [await service.claim(WS, claimOf("k1")), await service.claim(WS, claimOf("k1"))]

        expect(left).toMatchObject({ verdict: "send", row: { state: "claimed", reason: null } })
        expect(right.verdict).toBe("unknown")
        expect(store.rows).toHaveLength(1)
    })

    it("answers unknown, never send, for a key whose refusal left the outcome uncertain", async () => {
        const { service } = await build()
        await service.claim(WS, claimOf("k1"))
        await service.mark(WS, "k1", { state: "refused", reason: "delivery_failed" })
        await service.claim(WS, claimOf("k2"))
        await service.mark(WS, "k2", { state: "unknown", reason: null })

        await expect(service.claim(WS, claimOf("k1"))).resolves.toMatchObject({ verdict: "unknown", row: { state: "unknown", reason: "delivery_failed" } })
        await expect(service.claim(WS, claimOf("k2"))).resolves.toMatchObject({ verdict: "unknown", row: { state: "unknown" } })
    })

    it("lets exactly one of two racing claimers send", async () => {
        const { service, store } = await build()

        const answers = await Promise.all([service.claim(WS, claimOf("k1")), service.claim(WS, claimOf("k1"))])

        expect(answers.map((answer) => answer.verdict).toSorted()).toEqual(["send", "unknown"])
        expect(store.rows).toHaveLength(1)
    })

    it("keeps the same send key of another workspace apart", async () => {
        const { service, store } = await build()
        await service.claim(WS, claimOf("k1"))

        await expect(service.claim("ws-2", claimOf("k1"))).resolves.toMatchObject({ verdict: "send" })
        expect(store.rows).toHaveLength(2)
    })
})

describe("ChannelDeliveriesService.mark", () => {
    it("settles a claimed row with the refusal reason, or the unknown outcome", async () => {
        const { service } = await build()
        await service.claim(WS, claimOf("k1"))
        await service.claim(WS, claimOf("k2"))

        await expect(service.mark(WS, "k1", { state: "refused", reason: "outside_window" })).resolves.toMatchObject({ state: "refused", reason: "outside_window" })
        await expect(service.mark(WS, "k2", { state: "unknown", reason: "delivery_outcome_unknown" })).resolves.toMatchObject({
            state: "unknown",
            reason: "delivery_outcome_unknown",
        })
    })

    it("answers null for a key nobody claimed", async () => {
        const { service } = await build()

        await expect(service.mark(WS, "ghost", { state: "delivered", providerMessageId: null, at: AT })).resolves.toBeNull()
    })
})

describe("ChannelDeliveriesService lists", () => {
    const seed = async () => {
        const built = await build()
        await built.service.claim(WS, claimOf("k1"))
        await built.service.claim(WS, claimOf("k2", { agentId: "agent-booking" }))
        await built.service.claim(WS, claimOf("k3", { routeId: "route-2" }))
        await built.service.claim(WS, claimOf("k4", { contactId: "contact-old" }))
        await built.service.claim(WS, claimOf("k5", { contactId: "contact-2", routeId: "route-3" }))
        await built.service.claim("ws-2", claimOf("k6"))
        return built
    }

    it("lists one route newest first, whoever told it, and nothing of another workspace", async () => {
        const { service } = await seed()

        const page = await service.listByRoute(WS, "route-1")

        expect(page.rows.map((row) => row.sendKey)).toEqual(["k4", "k2", "k1"])
        expect(page.next).toBeNull()
        expect(new Set(page.rows.map((row) => row.agentId))).toEqual(new Set(["agent-sales", "agent-booking"]))
    })

    it("lists what one step of one run claimed, in every state and every route, and nothing of another step, run or workspace", async () => {
        const built = await build()
        await built.service.claim(WS, claimOf("s1", { runId: "run-1", stepKey: "answer" }))
        await built.service.claim(WS, claimOf("s2", { runId: "run-1", stepKey: "answer", routeId: "route-2" }))
        await built.service.claim(WS, claimOf("s3", { runId: "run-1", stepKey: "other" }))
        await built.service.claim(WS, claimOf("s4", { runId: "run-2", stepKey: "answer" }))
        await built.service.claim("ws-2", claimOf("s5", { runId: "run-1", stepKey: "answer" }))

        const rows = await built.service.listByStep(WS, "run-1", "answer")

        expect(rows.map((row) => row.sendKey)).toEqual(["s2", "s1"])
        expect(rows.map((row) => row.state)).toEqual(["claimed", "claimed"])
        expect(await built.service.listByStep(WS, "run-1", "answer", 1)).toHaveLength(1)
    })

    it("counts what was delivered in a window, and the distinct routes it went to, nothing refused or outside the window", async () => {
        const built = await build()
        const at = (day: number) => new Date(`2026-11-0${String(day)}T10:00:00.000Z`)
        const sent = async (key: string, routeId: string, state: "delivered" | "refused", day: number) => {
            await built.service.claim(WS, claimOf(key, { routeId }))
            await built.service.mark(WS, key, state === "delivered" ? { state, providerMessageId: null, at: at(day) } : { state, reason: "outside_window" })
        }
        await sent("c1", "route-1", "delivered", 2)
        await sent("c2", "route-1", "delivered", 3)
        await sent("c3", "route-2", "delivered", 3)
        await sent("c4", "route-3", "refused", 3)
        await sent("c5", "route-4", "delivered", 6)

        const from = new Date("2026-11-01T00:00:00.000Z")
        const to = new Date("2026-11-05T00:00:00.000Z")

        await expect(built.service.countDelivered(WS, from, to)).resolves.toBe(3)
        await expect(built.service.routesTold(WS, from, to)).resolves.toBe(2)
        await expect(built.service.countDelivered("ws-2", from, to)).resolves.toBe(0)
    })

    it("pages with a bound and a cursor that reads on from the last row", async () => {
        const { service } = await seed()

        const first = await service.listByRoute(WS, "route-1", { limit: 2 })
        const second = await service.listByRoute(WS, "route-1", { limit: 2, after: first.next })

        expect(first.rows.map((row) => row.sendKey)).toEqual(["k4", "k2"])
        expect(first.next).not.toBeNull()
        expect(second.rows.map((row) => row.sendKey)).toEqual(["k1"])
        expect(second.next).toBeNull()
    })

    it("starts from the newest when the cursor is malformed and bounds the limit", async () => {
        const { service } = await seed()

        const page = await service.listByRoute(WS, "route-1", { limit: 100000, after: "'; drop" })

        expect(page.rows).toHaveLength(3)
        await expect(service.listByRoute(WS, "route-1", { limit: 0 })).resolves.toMatchObject({ rows: [{ sendKey: "k4" }] })
    })

    it("lists a person under every id merged into them, over all their routes", async () => {
        const { service } = await seed()

        const byMerged = await service.listByContact(WS, "contact-old")
        const bySurvivor = await service.listByContact(WS, "contact-1")

        expect(byMerged.rows.map((row) => row.sendKey)).toEqual(["k4", "k3", "k2", "k1"])
        expect(bySurvivor.rows.map((row) => row.sendKey)).toEqual(["k4", "k3", "k2", "k1"])
        await expect(service.listByContact(WS, "contact-2")).resolves.toMatchObject({ rows: [{ sendKey: "k5" }] })
    })

    it("lists nothing for a deleted person, and leaves their rows in the ledger", async () => {
        const { service, store } = await seed()
        const before = store.rows.length

        await expect(service.listByContact(WS, "contact-gone")).resolves.toEqual({ rows: [], next: null })

        expect(store.rows).toHaveLength(before)
    })
})
