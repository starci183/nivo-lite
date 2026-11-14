import { zaloMessage } from "@modules/domain/zalo-inbox/zalo.data-types"
import type { StoredDelivery } from "@modules/domain/customer-routes"
import { identity } from "@tests/fixtures/builders/channel-send-executor.builder"
import {
    INBOUND,
    MESSAGE_DIRECTION,
    ZALO_MESSAGE_PERSON,
    ZALO_MESSAGE_TYPE,
    attachmentSummaryOf,
    channelsOf,
    receiptOf,
    receiptOfRow,
    reachPicked,
    windowClosedAt,
} from "./customer-send.policy"

const TELEGRAM = identity({ id: "i-1", at: "2026-11-01T10:00:00.000Z" })
const ZALO_1 = identity({ id: "i-2", provider: "zalo", account: "z1", value: "1", at: "2026-11-02T10:00:00.000Z" })
const ZALO_2 = identity({ id: "i-3", provider: "zalo", account: "z2", value: "2", at: "2026-11-03T10:00:00.000Z" })
const PHONE = identity({ id: "i-4", kind: "phone", provider: "", account: "", value: "+84900000000" })
const NO_ASK = { channel: undefined, accountId: undefined, woken: null }

describe("reachPicked", () => {
    it("takes the single channel identity, and ignores phones and mails", () => {
        expect(reachPicked([PHONE, TELEGRAM], NO_ASK)).toEqual({
            kind: "picked",
            reach: { channel: "telegram", accountId: "k1", userId: "555" },
        })
    })

    it("prefers the route the run was woken on, then the newest identity when nobody said", () => {
        const woken = { channel: "telegram", accountId: "k1" }
        expect(reachPicked([TELEGRAM, ZALO_1, ZALO_2], { ...NO_ASK, woken })).toMatchObject({ reach: { channel: "telegram" } })
        expect(reachPicked([TELEGRAM, ZALO_1, ZALO_2], NO_ASK)).toMatchObject({ reach: { accountId: "z2", userId: "2" } })
    })

    it("narrows by the channel and the account named, the woken route only among what is left", () => {
        expect(reachPicked([TELEGRAM, ZALO_1, ZALO_2], { ...NO_ASK, channel: "zalo", accountId: "z1" })).toMatchObject({
            kind: "picked",
            reach: { accountId: "z1" },
        })
        expect(
            reachPicked([TELEGRAM, ZALO_1, ZALO_2], { channel: "zalo", accountId: undefined, woken: { channel: "zalo", accountId: "z1" } }),
        ).toMatchObject({ kind: "picked", reach: { accountId: "z1" } })
    })

    it("is ambiguous when a channel is named with several accounts and no woken route among them, none when nothing fits", () => {
        expect(reachPicked([ZALO_1, ZALO_2], { ...NO_ASK, channel: "zalo" })).toEqual({
            kind: "ambiguous",
            reason: "channel_ambiguous",
            channels: ["zalo"],
        })
        expect(reachPicked([TELEGRAM], { ...NO_ASK, channel: "zalo" })).toEqual({
            kind: "none",
            reason: "no_channel_identity",
            channels: ["telegram"],
        })
        expect(reachPicked([PHONE], NO_ASK)).toEqual({ kind: "none", reason: "no_channel_identity", channels: [] })
    })

    it("lists the channels once each", () => {
        expect(channelsOf([TELEGRAM, ZALO_1, ZALO_2, PHONE])).toEqual(["telegram", "zalo"])
    })
})

describe("windowClosedAt", () => {
    const NOW = new Date("2026-11-04T10:00:00.000Z")
    it("is closed only past the window, and open for a person who never wrote in", () => {
        expect(windowClosedAt(NOW, new Date(NOW.getTime() - 1001), 1000)).toBe(true)
        expect(windowClosedAt(NOW, new Date(NOW.getTime() - 1000), 1000)).toBe(false)
        expect(windowClosedAt(NOW, null, 1000)).toBe(false)
    })

    it("reads the raw Zalo message by the member its index declares, and only the inbound ones", () => {
        expect(zaloMessage.name).toBe(ZALO_MESSAGE_TYPE)
        expect(zaloMessage.indexes?.some((index) => index.on[0] === ZALO_MESSAGE_PERSON)).toBe(true)
        expect(zaloMessage.fields[MESSAGE_DIRECTION]).toBeDefined()
        expect(INBOUND).toBe("in")
    })
})

describe("receipts", () => {
    const row = (patch: Partial<StoredDelivery>): StoredDelivery => ({
        id: "d1",
        seq: "1",
        sendKey: "run:1",
        routeId: "route-1",
        contactId: "k-1",
        agentId: "a-1",
        runId: "t",
        stepKey: null,
        text: "Hello",
        attachmentCount: 0,
        attachmentKinds: [],
        state: "delivered",
        reason: null,
        providerMessageId: "m-9",
        channel: "zalo",
        accountId: "z1",
        createdAt: "2026-11-04T10:00:00.000Z",
        deliveredAt: "2026-11-04T10:00:01.000Z",
        ...patch,
    })

    it("is the same receipt for a delivered row however often it is read", () => {
        expect(receiptOfRow(row({}))).toEqual({
            delivered: true,
            state: "delivered",
            reason: null,
            contactId: "k-1",
            channel: "zalo",
            accountId: "z1",
            routeId: "route-1",
            providerMessageId: "m-9",
            at: "2026-11-04T10:00:01.000Z",
            sendKey: "run:1",
        })
    })

    it("reads a key in flight or ended uncertain as unknown with the uncertain reason, and a refusal with its own", () => {
        expect(receiptOfRow(row({ state: "claimed", deliveredAt: null }))).toMatchObject({ state: "unknown", reason: "delivery_outcome_unknown", delivered: false })
        expect(receiptOfRow(row({ state: "unknown", reason: "zalo_error", deliveredAt: null }))).toMatchObject({ state: "unknown", reason: "zalo_error" })
        expect(receiptOfRow(row({ state: "refused", reason: "outside_window", deliveredAt: null }))).toMatchObject({ state: "refused", reason: "outside_window" })
    })

    it("builds the receipt of an attempt the engine ended itself", () => {
        const place = { contactId: "k-1", channel: "zalo", accountId: "z1", routeId: "route-1" }
        expect(receiptOf(place, "run:1", { state: "refused", reason: "customer_opted_out" })).toEqual({
            delivered: false,
            state: "refused",
            reason: "customer_opted_out",
            ...place,
            providerMessageId: null,
            at: null,
            sendKey: "run:1",
        })
        expect(receiptOf(place, "run:1", { state: "delivered", reason: null, via: "zns", at: "2026-11-04T10:00:00.000Z" })).toMatchObject({
            delivered: true,
            via: "zns",
            at: "2026-11-04T10:00:00.000Z",
        })
    })

    it("sums the pictures of a send up for the ledger", () => {
        expect(attachmentSummaryOf(undefined)).toEqual({ attachmentCount: 0, attachmentKinds: [] })
        expect(attachmentSummaryOf([{ url: "a" }, { url: "b" }])).toEqual({ attachmentCount: 2, attachmentKinds: ["image"] })
    })
})
