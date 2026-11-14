import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { ContactsService, ConversationContactsService } from "@modules/domain/contacts"
import type { ContactWithIdentities } from "@modules/domain/contacts"
import { MemoryContactFreezeStore } from "@tests/fixtures/builders/engine-core-stores.builder"
import { CONTACT_FREEZE_STORE } from "./contact-freeze-store.port"
import { LeadFreezesError, LeadFreezesErrorCode } from "./errors/lead-freezes.error"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import type { LeadFreeze } from "./lead-freezes.contracts"

const FREEZE: LeadFreeze = {
    id: "freeze-1",
    version: "2",
    key: "contact:lead-1",
    contactId: "lead-1",
    conversationId: "c-1",
    status: "frozen",
    frozenRunId: "run-1",
    agentId: null,
    frozenAt: "2026-11-04T10:00:00.000Z",
    frozenReason: null,
    stepKey: null,
    stepTitle: null,
    customerName: null,
    workItemId: null,
    episode: 1,
    failures: 1,
    heldBy: null,
    releasedAt: null,
    releasedBy: null,
    releaseReason: null,
    pending: [],
}

/** A contact as the contacts store answers it. */
const contactOf = (id: string, displayName: string): ContactWithIdentities => ({
    id,
    workspaceId: "ws-1",
    displayName,
    tags: [],
    state: "active",
    createdAt: "2026-11-04T10:00:00.000Z",
    updatedAt: "2026-11-04T10:00:00.000Z",
    identities: [],
})

const build = async (conversations?: ConversationContactsService, contacts?: ContactsService, rows: ReadonlyArray<LeadFreeze> = [FREEZE]) => {
    const store = new MemoryContactFreezeStore(rows)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezeRecordsService,
            { provide: CONTACT_FREEZE_STORE, useValue: store },
            ...(conversations === undefined ? [] : [{ provide: ConversationContactsService, useValue: conversations }]),
            ...(contacts === undefined ? [] : [{ provide: ContactsService, useValue: contacts }]),
        ],
    }).compile()
    return { service: moduleRef.get(LeadFreezeRecordsService), store }
}

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof LeadFreezesError ? cause.code : cause
    }
}

describe("LeadFreezeRecordsService reads", () => {
    it("finds a freeze by its key, its run and its lead, and by its id", async () => {
        const { service } = await build()

        await expect(service.byKey("ws-1", "contact:lead-1")).resolves.toMatchObject({ id: "freeze-1", status: "frozen" })
        await expect(service.byRun("ws-1", "run-1")).resolves.toMatchObject({ frozenRunId: "run-1" })
        await expect(service.byContact("ws-1", "lead-1")).resolves.toMatchObject({ contactId: "lead-1" })
        await expect(service.byId("ws-1", "freeze-1")).resolves.toMatchObject({ key: "contact:lead-1" })
    })

    it("answers null for a freeze that is not there, and joins the caller's transaction when given one", async () => {
        const { service, store } = await build()
        const find = jest.spyOn(store, "find")
        const manager = mockEntityManager()

        await expect(service.byKey("ws-1", "contact:x", manager)).resolves.toBeNull()
        await expect(service.byId("ws-1", "x")).resolves.toBeNull()
        expect(find).toHaveBeenCalledWith("ws-1", { key: "contact:x" }, manager)
    })

    it("lists the customers frozen or retried, oldest first, by status", async () => {
        const retrying = { ...FREEZE, id: "freeze-2", key: "contact:lead-2", status: "retrying" as const, frozenAt: "2026-11-03T10:00:00.000Z" }
        const released = { ...FREEZE, id: "freeze-3", key: "contact:lead-3", status: "released" as const }
        const { service } = await build(undefined, undefined, [FREEZE, retrying, released])

        await expect(service.holding("ws-1")).resolves.toMatchObject([{ id: "freeze-1" }, { id: "freeze-2" }])
    })
})

describe("LeadFreezeRecordsService reads of the other capabilities", () => {
    it("reads the contact of a conversation, its aliases and its name from the contacts; nothing without them", async () => {
        const conversations = mock<ConversationContactsService>()
        conversations.contactOf.mockImplementation((_ws, id) => Promise.resolve(id === "c-1" ? "contact-1" : null))
        const contacts = mock<ContactsService>()
        contacts.aliasesOf.mockResolvedValue(["contact-1", "contact-old"])
        contacts.get.mockResolvedValue(contactOf("contact-1", "A"))
        const { service } = await build(conversations, contacts)
        await expect(service.contactOfConversation("ws-1", "c-1")).resolves.toBe("contact-1")
        await expect(service.contactOfConversation("ws-1", "c-2")).resolves.toBeNull()
        await expect(service.aliasesOf("ws-1", "contact-1")).resolves.toEqual(["contact-1", "contact-old"])
        await expect(service.nameOfContact("ws-1", "contact-1")).resolves.toBe("A")
        const bare = await build()
        await expect(bare.service.contactOfConversation("ws-1", "c-1")).resolves.toBeNull()
        await expect(bare.service.aliasesOf("ws-1", "contact-1")).resolves.toEqual(["contact-1"])
    })

})

describe("LeadFreezeRecordsService writes", () => {
    it("ensures one freeze per customer key, and finds the one a racer wrote first", async () => {
        const { service, store } = await build(undefined, undefined, [])
        const subject = { key: "contact:lead-1", contactId: "lead-1", conversationId: "c-1" }

        const made = await service.ensure("ws-1", subject, { status: "released", pending: [] })
        expect(made).toMatchObject({ key: "contact:lead-1", contactId: "lead-1", conversationId: "c-1", status: "released" })
        expect(store.writes).toEqual([{ op: "insert", id: made.id, values: { status: "released", pending: [] } }])

        await expect(service.ensure("ws-1", subject, {})).resolves.toMatchObject({ id: made.id })
        expect(store.writes).toHaveLength(1)

        jest.spyOn(store, "insert").mockResolvedValueOnce(null)
        jest.spyOn(store, "find").mockResolvedValueOnce(null)
        await expect(codeOf(service.ensure("ws-1", subject, {}))).resolves.toBe(LeadFreezesErrorCode.RecordUnreadable)
    })
})

describe("LeadFreezeRecordsService writes under the version read", () => {
    it("patches under the version read, builds again after another writer moved the freeze, and writes nothing on a null build", async () => {
        const { service, store } = await build()
        const update = jest.spyOn(store, "update")
        // Another writer moves the freeze between the first read and its write.
        update.mockImplementationOnce(async (ws, id, _expected, values) => {
            await MemoryContactFreezeStore.prototype.update.call(store, ws, id, "2", {})
            return MemoryContactFreezeStore.prototype.update.call(store, ws, id, "2", values)
        })
        const versions: Array<string> = []

        const patched = await service.patch("ws-1", "freeze-1", (freeze) => {
            versions.push(freeze.version)
            return { status: "retrying" }
        })

        expect(patched).toMatchObject({ status: "retrying", version: "4" })
        expect(versions).toEqual(["2", "3"])
        expect(update.mock.calls[1]?.slice(0, 4)).toEqual(["ws-1", "freeze-1", "3", { status: "retrying" }])

        await expect(service.patch("ws-1", "freeze-1", () => null)).resolves.toBeNull()
    })

    it("refuses a freeze that is gone, one removed before its write, and one that keeps losing the race", async () => {
        const gone = await build(undefined, undefined, [])
        await expect(codeOf(gone.service.patch("ws-1", "freeze-1", () => ({ status: "frozen" })))).resolves.toBe(
            LeadFreezesErrorCode.RecordUnreadable,
        )
        const removed = await build()
        jest.spyOn(removed.store, "update").mockImplementationOnce(() => {
            removed.store.rows.splice(0, 1)
            return Promise.resolve(null)
        })
        await expect(codeOf(removed.service.patch("ws-1", "freeze-1", () => ({ status: "frozen" })))).resolves.toBe(
            LeadFreezesErrorCode.RecordUnreadable,
        )
        const raced = await build()
        jest.spyOn(raced.store, "update").mockResolvedValue(null)
        await expect(codeOf(raced.service.patch("ws-1", "freeze-1", () => ({ status: "frozen" })))).resolves.toBe(
            LeadFreezesErrorCode.Contended,
        )
    })
})
