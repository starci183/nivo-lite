import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentWorkAccessService } from "@modules/domain/agent-work/agent-work-access.service"
import type { ContactWithIdentities } from "./contacts.contracts"
import { ContactsService } from "./contacts.service"
import { ContactsPageService } from "./contacts-page.service"
import { ContactsError, ContactsErrorCode } from "./errors/contacts.error"

const WS = "ws-1"
const PRINCIPAL = "user-1"
const MEMBER = "member-1"

const contactOf = (id: string, createdAt = "2026-11-01T00:00:00.000Z"): ContactWithIdentities => ({
    id,
    workspaceId: WS,
    displayName: `Name ${id}`,
    tags: ["vip"],
    state: "active",
    createdAt,
    updatedAt: createdAt,
    identities: [],
})

const build = async () => {
    const access = mock<AgentWorkAccessService>()
    access.manager.mockResolvedValue(MEMBER)
    access.owner.mockResolvedValue(MEMBER)
    const contacts = mock<ContactsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContactsPageService,
            { provide: AgentWorkAccessService, useValue: access },
            { provide: ContactsService, useValue: contacts },
        ],
    }).compile()
    return { page: moduleRef.get(ContactsPageService), access, contacts }
}

const cursorOf = (createdAt: string, id: string): string => Buffer.from(`${createdAt}|${id}`).toString("base64url")

describe("ContactsPageService.list", () => {
    it("proves the seat, then lists a page of the default size from the start and answers the next cursor of a full page", async () => {
        const { page, access, contacts } = await build()
        const rows = Array.from({ length: 30 }, (_, at) => contactOf(`c-${at}`, `2026-11-01T00:00:${String(at).padStart(2, "0")}.000Z`))
        contacts.list.mockResolvedValue(rows)

        const answer = await page.list(PRINCIPAL, { workspaceId: WS })

        expect(access.manager).toHaveBeenCalledWith(PRINCIPAL, WS)
        expect(contacts.list).toHaveBeenCalledWith(WS, null, 30)
        expect(answer.contacts).toHaveLength(30)
        expect(answer.next).toBe(cursorOf("2026-11-01T00:00:29.000Z", "c-29"))
    })

    it("answers no next cursor for a short page, and reads the position a cursor names", async () => {
        const { page, contacts } = await build()
        contacts.list.mockResolvedValue([contactOf("c-1")])

        const answer = await page.list(PRINCIPAL, { workspaceId: WS, cursor: cursorOf("2026-10-01T00:00:00.000Z", "c-0"), size: 10 })

        expect(contacts.list).toHaveBeenCalledWith(WS, { createdAt: "2026-10-01T00:00:00.000Z", id: "c-0" }, 10)
        expect(answer.next).toBeNull()
    })

    it("reads an empty or malformed cursor as the start, and clamps the size to 1 .. the page maximum", async () => {
        const { page, contacts } = await build()
        contacts.list.mockResolvedValue([])

        await page.list(PRINCIPAL, { workspaceId: WS, cursor: "", size: 0 })
        await page.list(PRINCIPAL, { workspaceId: WS, cursor: Buffer.from("no-separator").toString("base64url"), size: 100000 })

        expect(contacts.list).toHaveBeenNthCalledWith(1, WS, null, 1)
        expect(contacts.list).toHaveBeenNthCalledWith(2, WS, null, expect.any(Number))
        const clamped = contacts.list.mock.calls[1]?.[2]
        expect(clamped).toBeGreaterThan(1)
        expect(clamped).toBeLessThan(100000)
    })

    it("answers a search without a cursor, trimmed, and never lists", async () => {
        const { page, contacts } = await build()
        contacts.search.mockResolvedValue([contactOf("c-9")])

        const answer = await page.list(PRINCIPAL, { workspaceId: WS, search: "  lan  ", size: 5 })

        expect(contacts.search).toHaveBeenCalledWith(WS, "lan", 5)
        expect(contacts.list).not.toHaveBeenCalled()
        expect(answer).toEqual({ contacts: [expect.objectContaining({ id: "c-9", tags: ["vip"] })], next: null })
    })
})

describe("ContactsPageService.detail", () => {
    it("answers null when the workspace holds no such contact", async () => {
        const { page, contacts } = await build()
        contacts.get.mockResolvedValue(null)

        await expect(page.detail(PRINCIPAL, { workspaceId: WS, id: "nope" })).resolves.toBeNull()
    })

    it("answers the contact with its memory as JSON text and the suggestions with the names of the others", async () => {
        const { page, contacts } = await build()
        contacts.get.mockImplementation((_workspaceId, id) => Promise.resolve(id === "c-2" ? contactOf("c-2") : contactOf("c-1")))
        contacts.memoryOf.mockResolvedValue({ facts: { size: 42 }, notes: [{ workflow: "sales.reply", step: "ask", status: "done", at: "2026-11-02T00:00:00.000Z", output: { ok: true } }] })
        contacts.suggestionsOf.mockResolvedValue([{ contactId: "c-2", why: "same_name", identity: null }])

        const answer = await page.detail(PRINCIPAL, { workspaceId: WS, id: "c-1" })

        expect(contacts.memoryOf).toHaveBeenCalledWith(WS, "c-1", "display")
        expect(answer?.contact.id).toBe("c-1")
        expect(answer?.memory.facts).toEqual([{ name: "size", value: "42" }])
        expect(answer?.memory.notes).toEqual([
            { workflow: "sales.reply", step: "ask", status: "done", at: "2026-11-02T00:00:00.000Z", output: '{"ok":true}' },
        ])
        expect(answer?.suggestions).toEqual([
            { contactId: "c-2", displayName: "Name c-2", why: "same_name", identityKind: null, identityValue: null },
        ])
    })
})

describe("ContactsPageService decisions", () => {
    it("update: refuses a contact the workspace does not hold with ContactMissing, and answers the stored view otherwise", async () => {
        const { page, contacts } = await build()
        contacts.update.mockResolvedValueOnce({ kind: "refused", reason: "contact_missing" })
        await expect(page.update(PRINCIPAL, { workspaceId: WS, id: "c-1", displayName: "Lan" })).rejects.toThrow(
            new ContactsError({ code: ContactsErrorCode.ContactMissing }),
        )

        contacts.update.mockResolvedValueOnce({ kind: "updated", contactId: "c-1" })
        contacts.get.mockResolvedValue(contactOf("c-1"))
        await expect(page.update(PRINCIPAL, { workspaceId: WS, id: "c-1", tags: ["a"] })).resolves.toEqual(
            expect.objectContaining({ id: "c-1" }),
        )
        expect(contacts.update).toHaveBeenLastCalledWith(WS, "c-1", { tags: ["a"] }, { kind: "member", memberId: MEMBER })
    })

    it("link: answers linked, or the merged contact; maps each refusal to its own error code; an unknown kind links as phone", async () => {
        const { page, contacts } = await build()
        contacts.linkIdentity.mockResolvedValueOnce({ kind: "merged", contactId: "c-older", reason: "phone_verified" })
        await expect(page.link(PRINCIPAL, { workspaceId: WS, contactId: "c-1", kind: "sms", value: "0900" })).resolves.toEqual({
            outcome: "merged",
            contactId: "c-older",
        })
        expect(contacts.linkIdentity).toHaveBeenCalledWith(WS, "c-1", { kind: "phone", value: "0900", proof: "member" }, { kind: "member", memberId: MEMBER })

        contacts.linkIdentity.mockResolvedValueOnce({ kind: "refused", reason: "identity_taken" })
        await expect(page.link(PRINCIPAL, { workspaceId: WS, contactId: "c-1", kind: "email", value: "a@b.c" })).rejects.toThrow(
            new ContactsError({ code: ContactsErrorCode.IdentityTaken }),
        )
        contacts.linkIdentity.mockResolvedValueOnce({ kind: "refused", reason: "identity_invalid" })
        await expect(page.link(PRINCIPAL, { workspaceId: WS, contactId: "c-1", kind: "email", value: "x" })).rejects.toThrow(
            new ContactsError({ code: ContactsErrorCode.IdentityInvalid }),
        )
        contacts.linkIdentity.mockResolvedValueOnce({ kind: "refused", reason: "contact_missing" })
        await expect(page.link(PRINCIPAL, { workspaceId: WS, contactId: "c-1", kind: "email", value: "x" })).rejects.toThrow(
            new ContactsError({ code: ContactsErrorCode.ContactMissing }),
        )
    })

    it("unlink and merge: map their refusals, and answer the stored view of the contact", async () => {
        const { page, contacts } = await build()
        contacts.get.mockResolvedValue(contactOf("c-1"))
        contacts.unlinkIdentity.mockResolvedValueOnce({ kind: "refused", reason: "identity_missing" })
        await expect(page.unlink(PRINCIPAL, { workspaceId: WS, contactId: "c-1", identityId: "i-1" })).rejects.toThrow(
            new ContactsError({ code: ContactsErrorCode.IdentityMissing }),
        )
        contacts.merge.mockResolvedValueOnce({ kind: "refused", reason: "same_contact" })
        await expect(page.merge(PRINCIPAL, { workspaceId: WS, intoContactId: "c-1", fromContactId: "c-1" })).rejects.toThrow(
            new ContactsError({ code: ContactsErrorCode.SameContact }),
        )
        contacts.merge.mockResolvedValueOnce({ kind: "refused", reason: "no_proof" })
        await expect(page.merge(PRINCIPAL, { workspaceId: WS, intoContactId: "c-1", fromContactId: "c-2" })).rejects.toThrow(
            new ContactsError({ code: ContactsErrorCode.ContactMissing }),
        )
        contacts.merge.mockResolvedValueOnce({ kind: "merged", contactId: "c-1", reason: "member_approved" })
        await expect(page.merge(PRINCIPAL, { workspaceId: WS, intoContactId: "c-1", fromContactId: "c-2" })).resolves.toEqual(
            expect.objectContaining({ id: "c-1" }),
        )
    })

    it("forget answers the names that were held, and a missing contact refuses", async () => {
        const { page, contacts } = await build()
        contacts.forget.mockResolvedValueOnce({ kind: "forgotten", facts: ["size"] })
        await expect(page.forget(PRINCIPAL, { workspaceId: WS, contactId: "c-1", facts: ["size", "color"] })).resolves.toEqual(["size"])
        contacts.forget.mockResolvedValueOnce({ kind: "refused", reason: "contact_missing" })
        await expect(page.forget(PRINCIPAL, { workspaceId: WS, contactId: "c-1", facts: [] })).rejects.toThrow(
            new ContactsError({ code: ContactsErrorCode.ContactMissing }),
        )
    })

    it("delete: needs the owner's seat, refuses blocked records with RecordsBlocked and answers true when erased", async () => {
        const { page, access, contacts } = await build()
        contacts.delete.mockResolvedValueOnce({ kind: "refused", reason: "records_blocked" })
        await expect(page.delete(PRINCIPAL, { workspaceId: WS, id: "c-1" })).rejects.toThrow(
            new ContactsError({ code: ContactsErrorCode.RecordsBlocked }),
        )
        contacts.delete.mockResolvedValueOnce({ kind: "erased", identities: 1, records: 0, cleared: 0 })
        await expect(page.delete(PRINCIPAL, { workspaceId: WS, id: "c-1" })).resolves.toBe(true)
        expect(access.owner).toHaveBeenCalledWith(PRINCIPAL, WS)
        expect(access.manager).not.toHaveBeenCalled()
    })
})
