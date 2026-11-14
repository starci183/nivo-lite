import {
    CONTACTS_WORKSPACE as WS,
    MemoryContactMemory,
    MemoryContactsStore,
    OTHER_WORKSPACE,
} from "@tests/fixtures/builders/contacts.builder"
import type { ContactActor } from "./contacts.contracts"
import { ContactsService } from "./contacts.service"
import { ContactsErrorCode } from "./errors/contacts.error"

const NOW = new Date("2026-11-13T08:00:00.000Z")
const MEMBER: ContactActor = { kind: "member", memberId: "member-1" }
const STEP: ContactActor = { kind: "step", agentId: "agent-1", stepKey: "s1", approvedBy: null }

const build = () => {
    const store = new MemoryContactsStore()
    const memory = new MemoryContactMemory()
    const contacts = new ContactsService(store, { now: () => NOW }, memory)
    return { store, memory, contacts }
}

const zaloOf = (userId: string) => ({ channel: "zalo", account: "zalo-1", userId, name: "Lan" })
const telegramOf = (userId: string) => ({ channel: "telegram", account: "tg-1", userId, name: "Lan" })

describe("ContactsService.meetChannel: the engine meets a person on a channel before any module sees them", () => {
    it("creates a contact with the channel's own id, verified by the channel, and finds the same contact the next time", async () => {
        const { contacts, store } = build()
        const first = await contacts.meetChannel(WS, zaloOf("z-1"))
        const again = await contacts.meetChannel(WS, zaloOf("z-1"))
        expect(again).toEqual(first)
        expect(store.contacts).toHaveLength(1)
        expect(store.identities).toEqual([
            expect.objectContaining({
                contactId: first,
                kind: "channel",
                provider: "zalo",
                account: "zalo-1",
                value: "z-1",
                verified: true,
                verifiedBy: "channel",
            }),
        ])
    })

    it("retries once when a racing delivery wrote the identity first (a unique violation), and meets the same contact", async () => {
        const { contacts, store } = build()
        const raced = jest
            .spyOn(store, "transaction")
            .mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: "23505" }))

        const met = await contacts.meetChannel(WS, zaloOf("z-1"))

        expect(raced).toHaveBeenCalledTimes(2)
        expect(store.contacts.map((one) => one.id)).toEqual([met])
    })

    it.each([
        ["a deadlock (40P01)", "40P01"],
        ["a serialization failure (40001)", "40001"],
    ])("retries once on %s and meets the contact", async (_name, code) => {
        const { contacts, store } = build()
        const raced = jest
            .spyOn(store, "transaction")
            .mockRejectedValueOnce(Object.assign(new Error("conflict"), { code }))

        const met = await contacts.meetChannel(WS, zaloOf("z-1"))

        expect(raced).toHaveBeenCalledTimes(2)
        expect(store.contacts.map((one) => one.id)).toEqual([met])
    })

    it("retries once on a conflict wrapped by the query layer (the driver error holds the code)", async () => {
        const { contacts, store } = build()
        const wrapped = Object.assign(new Error("query failed"), { driverError: { code: "40P01" } })
        const raced = jest.spyOn(store, "transaction").mockRejectedValueOnce(wrapped)

        await contacts.meetChannel(WS, zaloOf("z-1"))

        expect(raced).toHaveBeenCalledTimes(2)
    })

    it("surfaces the second failure: the retry is one, never more", async () => {
        const { contacts, store } = build()
        const second = Object.assign(new Error("deadlock again"), { code: "40P01" })
        const tried = jest
            .spyOn(store, "transaction")
            .mockRejectedValueOnce(Object.assign(new Error("deadlock"), { code: "40P01" }))
            .mockRejectedValueOnce(second)

        await expect(contacts.meetChannel(WS, zaloOf("z-1"))).rejects.toBe(second)
        expect(tried).toHaveBeenCalledTimes(2)
    })

    it.each([
        ["a lock timeout (55P03)", Object.assign(new Error("lock timeout"), { code: "55P03" })],
        ["a dropped connection", Object.assign(new Error("connection lost"), { code: "ECONNRESET" })],
        ["a pool timeout", new Error("timeout acquiring a connection from the pool")],
        ["an unknown failure", "boom"],
    ])("does not retry %s: it surfaces", async (_name, down) => {
        const { contacts, store } = build()
        const tried = jest.spyOn(store, "transaction").mockRejectedValue(down)

        await expect(contacts.meetChannel(WS, zaloOf("z-1"))).rejects.toBe(down)
        expect(tried).toHaveBeenCalledTimes(1)
    })

    it("meets the same channel id of another workspace as another person", async () => {
        const { contacts } = build()
        const mine = await contacts.meetChannel(WS, zaloOf("z-1"))
        const theirs = await contacts.meetChannel(OTHER_WORKSPACE, zaloOf("z-1"))
        expect(theirs).not.toBe(mine)
    })

    it("never merges two channels by a same name: a second person with the name is a suggestion", async () => {
        const { contacts } = build()
        const zalo = await contacts.meetChannel(WS, zaloOf("z-1"))
        const telegram = await contacts.meetChannel(WS, telegramOf("t-1"))
        expect(telegram).not.toBe(zalo)
        await expect(contacts.suggestionsOf(WS, telegram)).resolves.toEqual([
            { contactId: zalo, why: "same_name", identity: null },
        ])
    })
})

describe("ContactsService.linkIdentity: identities by proof only", () => {
    it("keeps a self-declared phone as a PROPOSAL (unverified) and merges nothing, even when another contact holds it verified", async () => {
        const { contacts, store } = build()
        const lan = store.seed(WS, "Lan", [
            { kind: "phone", provider: "", account: "", value: "84912345678", proof: "token" },
        ])
        const other = await contacts.meetChannel(WS, telegramOf("t-1"))
        const linked = await contacts.linkIdentity(WS, other, { kind: "phone", value: "0912 345 678" }, STEP)
        expect(linked).toEqual({
            kind: "proposed",
            identity: expect.objectContaining({ kind: "phone", value: "84912345678", verified: false }),
        })
        expect(store.merges).toEqual([])
        await expect(contacts.suggestionsOf(WS, other)).resolves.toContainEqual({
            contactId: lan,
            why: "claimed_identity",
            identity: { kind: "phone", provider: "", account: "", value: "84912345678" },
        })
    })

    it("refuses a channel or outside id another contact holds (moving it is a person's merge) and an identifier it cannot normalise", async () => {
        const { contacts } = build()
        const lan = await contacts.meetChannel(WS, zaloOf("z-1"))
        await contacts.linkIdentity(
            WS,
            lan,
            { kind: "external", account: "crm-1", value: "ACME-01", proof: "member" },
            MEMBER,
        )
        const other = await contacts.meetChannel(WS, telegramOf("t-1"))
        await expect(
            contacts.linkIdentity(
                WS,
                other,
                { kind: "external", account: "crm-1", value: "ACME-01", proof: "member" },
                MEMBER,
            ),
        ).resolves.toEqual({ kind: "refused", reason: "identity_taken" })
        await expect(contacts.linkIdentity(WS, other, { kind: "phone", value: "abc" }, MEMBER)).resolves.toEqual({
            kind: "refused",
            reason: "identity_invalid",
        })
    })

    it("links an outside system's customer id on an account as an external identity a person decided", async () => {
        const { contacts, store } = build()
        const lan = await contacts.meetChannel(WS, zaloOf("z-1"))
        const linked = await contacts.linkIdentity(
            WS,
            lan,
            { kind: "external", account: "crm-1", value: "ACME-01", proof: "member" },
            MEMBER,
        )
        expect(linked).toEqual({
            kind: "linked",
            identity: expect.objectContaining({ kind: "external", account: "crm-1", value: "ACME-01", verified: true }),
        })
        await expect(contacts.externalOf(WS, lan, "crm-1")).resolves.toBe("ACME-01")
        expect(store.events).toContainEqual(expect.objectContaining({ contactId: lan, action: "identity_linked" }))
    })
})

describe("ContactsService.merge: one person, one contact", () => {
    it("merges on an exact VERIFIED phone: identities and memory move to the older contact, the loser's id redirects to it", async () => {
        const { contacts, store, memory } = build()
        const zalo = await contacts.meetChannel(WS, zaloOf("z-1"))
        const telegram = await contacts.meetChannel(WS, telegramOf("t-1"))
        await contacts.linkIdentity(WS, zalo, { kind: "phone", value: "0912345678", proof: "token" }, STEP)
        await memory.remember(WS, telegram, { address: "12 L\u00ea L\u1ee3i" })

        // The Telegram person proves the same phone (the channel's shared contact): the exact verified match merges them.
        const merged = await contacts.linkIdentity(
            WS,
            telegram,
            { kind: "phone", value: "+84 912 345 678", proof: "channel" },
            { kind: "channel" },
        )

        expect(merged).toEqual({ kind: "merged", contactId: zalo, reason: "phone_verified" })
        await expect(contacts.current(WS, telegram)).resolves.toBe(zalo)
        await expect(contacts.aliasesOf(WS, zalo)).resolves.toEqual([zalo, telegram])
        const survivor = await contacts.get(WS, telegram)
        expect(survivor?.id).toBe(zalo)
        expect(survivor?.identities.map((one) => `${one.kind}:${one.value}:${one.joinedBy ?? "-"}`)).toEqual([
            "channel:z-1:-",
            "channel:t-1:phone_verified",
            "phone:84912345678:-",
        ])
        await expect(memory.read(WS, zalo)).resolves.toEqual({ facts: { address: "12 L\u00ea L\u1ee3i" }, notes: [] })
        expect(store.contacts.find((one) => one.id === telegram)?.state).toBe("merged")
        expect(store.merges).toEqual([
            { workspaceId: WS, from: telegram, into: zalo, reason: "phone_verified", decidedBy: null },
        ])
    })

    it("merges on an exact VERIFIED mail the same way", async () => {
        const { contacts } = build()
        const zalo = await contacts.meetChannel(WS, zaloOf("z-1"))
        const telegram = await contacts.meetChannel(WS, telegramOf("t-1"))
        await contacts.linkIdentity(WS, zalo, { kind: "email", value: "lan@gmail.com", proof: "member" }, MEMBER)
        await expect(
            contacts.linkIdentity(WS, telegram, { kind: "email", value: " LAN@gmail.com", proof: "token" }, STEP),
        ).resolves.toEqual({
            kind: "merged",
            contactId: zalo,
            reason: "email_verified",
        })
    })

    it("refuses a merge nobody approved (a proof merges by itself: a verified identity, a token), with itself, and across workspaces", async () => {
        const { contacts } = build()
        const zalo = await contacts.meetChannel(WS, zaloOf("z-1"))
        const telegram = await contacts.meetChannel(WS, telegramOf("t-1"))
        const elsewhere = await contacts.meetChannel(OTHER_WORKSPACE, telegramOf("t-9"))
        await expect(contacts.merge(WS, { into: zalo, from: telegram, by: STEP })).resolves.toEqual({
            kind: "refused",
            reason: "no_proof",
        })
        await expect(contacts.merge(WS, { into: zalo, from: zalo, by: MEMBER })).resolves.toEqual({
            kind: "refused",
            reason: "same_contact",
        })
        await expect(contacts.merge(WS, { into: zalo, from: elsewhere, by: MEMBER })).resolves.toEqual({
            kind: "refused",
            reason: "contact_missing",
        })
    })

    it("merges on a person's approval (member_approved) when no identifier proves it", async () => {
        const { contacts } = build()
        const zalo = await contacts.meetChannel(WS, zaloOf("z-1"))
        const telegram = await contacts.meetChannel(WS, telegramOf("t-1"))
        await expect(
            contacts.merge(WS, { into: zalo, from: telegram, by: { ...STEP, approvedBy: "member-1" } }),
        ).resolves.toEqual({
            kind: "merged",
            contactId: zalo,
            reason: "member_approved",
        })
    })

    it("merges the contact presenting a one-time link token into the contact it was issued for, once", async () => {
        const { contacts } = build()
        const zalo = await contacts.meetChannel(WS, zaloOf("z-1"))
        const telegram = await contacts.meetChannel(WS, telegramOf("t-1"))
        const token = await contacts.issueLinkToken(WS, zalo)
        await expect(contacts.redeemLinkToken(WS, telegram, token, STEP)).resolves.toEqual({
            kind: "merged",
            contactId: zalo,
            reason: "link_token",
        })
        const late = await contacts.meetChannel(WS, { ...telegramOf("t-2"), name: "Other" })
        await expect(contacts.redeemLinkToken(WS, late, token, STEP)).resolves.toEqual({
            kind: "refused",
            reason: "token_invalid",
        })
    })

    it("keeps every redirect one hop: a survivor merged later carries its aliases to the new survivor", async () => {
        const { contacts } = build()
        const a = await contacts.meetChannel(WS, zaloOf("z-1"))
        const b = await contacts.meetChannel(WS, telegramOf("t-1"))
        const c = await contacts.meetChannel(WS, { channel: "facebook", account: "fb-1", userId: "f-1", name: "Lan" })
        const approved = { ...STEP, approvedBy: "member-1" }
        await contacts.merge(WS, { into: b, from: c, by: approved })
        await contacts.merge(WS, { into: a, from: b, by: approved })
        await expect(contacts.current(WS, c)).resolves.toBe(a)
        await expect(contacts.aliasesOf(WS, a)).resolves.toEqual([a, c, b])
    })
})

describe("ContactsService.search and update", () => {
    it("finds a person by an exact identifier in any written form, or by a name prefix, never across workspaces", async () => {
        const { contacts, store } = build()
        const lan = store.seed(WS, "Lan Nguy\u1ec5n", [
            { kind: "phone", provider: "", account: "", value: "84912345678", proof: "token" },
        ])
        store.seed(OTHER_WORKSPACE, "Lan Other", [
            { kind: "phone", provider: "", account: "", value: "84912345678", proof: "token" },
        ])
        await expect(contacts.search(WS, "+84 912 345 678", 10)).resolves.toEqual([
            expect.objectContaining({ id: lan }),
        ])
        await expect(contacts.search(WS, "lan", 10)).resolves.toEqual([expect.objectContaining({ id: lan })])
    })

    it("updates the display name and the tags (trimmed, unique, bounded) and audits it", async () => {
        const { contacts, store } = build()
        const lan = await contacts.meetChannel(WS, zaloOf("z-1"))
        await expect(
            contacts.update(WS, lan, { displayName: " Lan N. ", tags: ["vip", " vip ", "s\u1ec9"] }, MEMBER),
        ).resolves.toEqual({
            kind: "updated",
            contactId: lan,
        })
        expect(store.contacts.find((one) => one.id === lan)).toMatchObject({
            displayName: "Lan N.",
            tags: ["vip", "s\u1ec9"],
        })
        expect(store.events).toContainEqual(expect.objectContaining({ contactId: lan, action: "updated" }))
    })
})

describe("ContactsService: the refusals carry the contacts codes", () => {
    it("refuses a channel person with no id (CONTACTS_IDENTITY_INVALID) and writes nothing", async () => {
        const { contacts, store } = build()
        const refused = await contacts
            .meetChannel(WS, { channel: "zalo", account: "zalo-1", userId: "", name: "Lan" })
            .catch((cause: unknown) => cause)
        expect(refused).toMatchObject({ code: ContactsErrorCode.IdentityInvalid })
        expect(store.contacts).toHaveLength(0)
    })

    it("refuses a link token for a contact the workspace does not hold (CONTACTS_CONTACT_MISSING)", async () => {
        const { contacts } = build()
        const refused = await contacts.issueLinkToken(WS, "no-such-contact").catch((cause: unknown) => cause)
        expect(refused).toMatchObject({ code: ContactsErrorCode.ContactMissing })
    })
})
