import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OfficeCardsService } from "@modules/domain/messages"
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
    const moduleRef = await Test.createTestingModule({
        providers: [HubNotesService, { provide: OfficeCardsService, useValue: cards }],
    }).compile()
    return { service: moduleRef.get(HubNotesService), cards }
}

describe("HubNotesService", () => {
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
