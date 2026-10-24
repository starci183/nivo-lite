import { Test } from "@nestjs/testing"
import { fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { OfficeCardsService } from "@modules/domain/messages"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import type { HubNote } from "./gateway-turns.contracts"
import { HubNotesService, noteBodyOf, noteCardOf, toolSourcesOf } from "./hub-notes.service"

const NOTE: HubNote = {
    workspaceId: "ws",
    room: "sales",
    type: "handoff_note",
    title: "Held",
    fields: [
        { label: "Guest", value: "Lan" },
        { label: "Time", value: "" },
    ],
    authorName: "AI Sales",
    sources: toolSourcesOf(["crm.slots.find", "crm.slot.hold", "crm.slot.hold"]),
}

const build = async () => {
    const cards = mock<OfficeCardsService>({ post: jest.fn().mockResolvedValue({ id: "m1", room: "sales" }) })
    const tx = fakeTransaction(mockEntityManager())
    const inbox = fakeInbox()
    const claim = jest.spyOn(inbox, "claim")
    const moduleRef = await Test.createTestingModule({
        providers: [
            HubNotesService,
            { provide: OfficeCardsService, useValue: cards },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: INBOX, useValue: inbox },
        ],
    }).compile()
    return { service: moduleRef.get(HubNotesService), cards, tx, claim }
}

describe("HubNotesService.postOnce", () => {
    it("posts a retried connector result only once with its claim and card in the same transaction", async () => {
        const { service, cards, tx, claim } = await build()
        const refs = { leadId: "l1", workItemId: null }

        await service.postOnce(NOTE, "agent-1", refs, "message-1:hakuen.booking.hold:args")
        await service.postOnce(NOTE, "agent-1", refs, "message-1:hakuen.booking.hold:args")

        expect(cards.post).toHaveBeenCalledTimes(1)
        const manager = cards.post.mock.calls[0]?.[2]
        expect(isTransactionManager(manager)).toBe(true)
        expect(claim).toHaveBeenNthCalledWith(
            1,
            "hub.note",
            JSON.stringify(["ws", "message-1:hakuen.booking.hold:args"]),
            manager,
        )
        expect(tx.commits).toBe(2)
    })

    it("keeps separate operation and workspace notes separate", async () => {
        const { service, cards } = await build()
        const refs = { leadId: null, workItemId: null }

        await service.postOnce(NOTE, "agent-1", refs, "operation-1")
        await service.postOnce(NOTE, "agent-1", refs, "operation-2")
        await service.postOnce({ ...NOTE, workspaceId: "other" }, "agent-1", refs, "operation-1")

        expect(cards.post).toHaveBeenCalledTimes(3)
    })

    it("rolls the claim back when the card cannot be posted and permits the delivery to retry", async () => {
        const { service, cards, tx, claim } = await build()
        const failure = new Error("card insert failed")
        cards.post.mockRejectedValueOnce(failure)

        await expect(service.postOnce(NOTE, "agent-1", { leadId: null, workItemId: null }, "operation-1")).rejects.toBe(
            failure,
        )
        expect(tx.rollbacks).toBe(1)
        claim.mockResolvedValueOnce(true)

        await service.postOnce(NOTE, "agent-1", { leadId: null, workItemId: null }, "operation-1")

        expect(cards.post).toHaveBeenCalledTimes(2)
        expect(tx.commits).toBe(1)
    })
})

describe("HubNotesService.post", () => {
    it("posts the note as a v1 card spoken by the agent in its room, each tool source once", async () => {
        const { service, cards } = await build()

        await expect(service.post(NOTE, "agent-1", { leadId: "l1", workItemId: null })).resolves.toBeUndefined()

        expect(cards.post).toHaveBeenCalledWith(
            { workspaceId: "ws" },
            {
                room: "sales",
                agentId: "agent-1",
                authorName: "AI Sales",
                body: "Held · Guest: Lan · Time: ",
                leadId: "l1",
                workItemId: null,
                card: {
                    v: 1,
                    type: "handoff_note",
                    title: "Held",
                    fields: [{ label: "Guest", value: "Lan" }],
                    sources: [
                        {
                            layer: 1,
                            kind: "mcp_tool",
                            ref: "crm.slots.find",
                            label: "crm.slots.find",
                        },
                        { layer: 1, kind: "mcp_tool", ref: "crm.slot.hold", label: "crm.slot.hold" },
                    ],
                },
            },
        )
    })

    it("lets the database route a note whose room is no Hub room, and leaves out what is empty", async () => {
        const { service, cards } = await build()
        const bare: HubNote = { ...NOTE, room: "booking", fields: [], sources: [] }

        await service.post(bare, "agent-1", { leadId: null, workItemId: "w1" })

        expect(cards.post.mock.calls[0]?.[1]).toMatchObject({ room: null, workItemId: "w1", leadId: null })
        expect(noteCardOf(bare)).toEqual({ v: 1, type: "handoff_note", title: "Held" })
        expect(noteCardOf({ ...bare, sources: undefined, body: "   " })).toEqual({
            v: 1,
            type: "handoff_note",
            title: "Held",
        })
        expect(noteBodyOf(bare)).toBe("Held")
        expect(noteCardOf({ ...bare, body: "  details  " })).toMatchObject({ body: "details" })
    })
})

describe("HubNotesService card limits", () => {
    it("clips every text to the card contract's limits and keeps a source link", () => {
        const long = "x".repeat(5000)
        const card = noteCardOf({
            ...NOTE,
            title: long,
            body: long,
            fields: Array.from({ length: 14 }, (_, index) => ({ label: `${long}${String(index)}`, value: long })),
            sources: [
                ...Array.from({ length: 11 }, () => ({ layer: 2 as const, kind: long, ref: long, label: long })),
            ].map((source, index) => (index === 0 ? { ...source, href: "https://brain/src-1" } : source)),
        })

        expect(String(card.title)).toHaveLength(160)
        expect(String(card.title).endsWith("…")).toBe(true)
        expect(String(card.body)).toHaveLength(4000)
        expect(card.fields).toHaveLength(12)
        expect(card.fields).toContainEqual({ label: `${"x".repeat(79)}…`, value: `${"x".repeat(399)}…` })
        expect(card.sources).toHaveLength(10)
        expect(card.sources).toContainEqual({
            layer: 2,
            kind: `${"x".repeat(39)}…`,
            ref: `${"x".repeat(199)}…`,
            label: `${"x".repeat(159)}…`,
            href: "https://brain/src-1",
        })
    })
})
