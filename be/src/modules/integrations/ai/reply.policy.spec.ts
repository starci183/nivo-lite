import { Test } from "@nestjs/testing"
import { NOTES_HEADING, notesBlock, withNotes } from "./reply.policy"

const SUBJECT = Symbol("reply.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { notesBlock, withNotes } }],
    }).compile()
    return moduleRef.get<{ notesBlock: typeof notesBlock; withNotes: typeof withNotes }>(SUBJECT)
}

describe("notesBlock", () => {
    it("is empty on an empty brain, so the prompt gains nothing", async () => {
        const subject = await buildSubject()

        expect(subject.notesBlock([])).toBe("")
    })

    it("lists the passages under a heading that says notes never give a price or an amount", async () => {
        const subject = await buildSubject()

        const block = subject.notesBlock([
            { title: "Hours", content: "Open   8\nto 21" },
            { title: null, content: "Free parking" },
        ])

        expect(block).toBe(`${NOTES_HEADING}\n- Hours: Open 8 to 21\n- Free parking`)
        expect(NOTES_HEADING).toContain("never give a price or an amount")
    })

    it("clips a long passage", async () => {
        const subject = await buildSubject()

        const block = subject.notesBlock([{ title: null, content: "y".repeat(2000) }])

        expect(block.endsWith("y".repeat(600))).toBe(true)
        expect(block).not.toContain("y".repeat(601))
    })
})

describe("withNotes", () => {
    const messages = [
        { role: "system" as const, content: "You are Mai." },
        { role: "user" as const, content: "hi" },
    ]

    it("leaves the prompt exactly as it was when there are no notes", async () => {
        const subject = await buildSubject()

        expect(subject.withNotes(messages, "")).toEqual(messages)
    })

    it("appends the block to the system message and leaves every other message alone", async () => {
        const subject = await buildSubject()

        expect(subject.withNotes(messages, "NOTES")).toEqual([
            { role: "system", content: "You are Mai.\n\nNOTES" },
            { role: "user", content: "hi" },
        ])
    })

    it("opens the prompt with the block as a system message when it has none", async () => {
        const subject = await buildSubject()

        expect(subject.withNotes([{ role: "user", content: "hi" }], "NOTES")).toEqual([
            { role: "system", content: "NOTES" },
            { role: "user", content: "hi" },
        ])
    })
})
