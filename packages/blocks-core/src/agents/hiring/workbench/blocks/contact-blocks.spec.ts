import { contactBlockProblems } from "@nivo-lite/agent-sdk/module"
import { coreBlocks } from "../../../../shared/blocks/core-blocks"
import { hiringCandidateEntity } from "../../entities/candidate.entity"
import { HIRING_MESSAGES } from "../../hiring-messages"
import { hiringModule } from "../../declaration"

/** Every `{ "key": ... }` text a value holds, at any depth. */
const keysIn = (value: unknown): ReadonlyArray<string> => {
    if (Array.isArray(value)) return value.flatMap(keysIn)
    if (typeof value !== "object" || value === null) return []
    return Object.entries(value).flatMap(([name, member]) =>
        name === "key" && typeof member === "string" ? [member] : keysIn(member),
    )
}

describe("the Hiring block on the contact detail", () => {
    it("mounts the candidate records of the person over the Hiring's own read that takes a contactId", () => {
        expect(hiringModule.contactBlocks?.map((block) => block.id)).toEqual(["candidates"])
        expect(hiringModule.contactBlocks?.map((block) => block.read)).toEqual(["blocks-core.hiring.api.candidate.of-contact"])
        expect(hiringModule.reads.map((read) => read.id)).toContain("blocks-core.hiring.api.candidate.of-contact")
    })

    it("is sound: the read reaches a type with a contact field and the record list fits the read", () => {
        expect(contactBlockProblems(hiringModule, coreBlocks, [hiringCandidateEntity])).toEqual([])
    })

    it("words its block with module messages of both languages", () => {
        const keys = keysIn(hiringModule.contactBlocks)
        expect(keys.length).toBeGreaterThan(5)
        for (const locale of ["vi", "en"] as const) {
            const known = new Set(Object.keys(HIRING_MESSAGES[locale]))
            expect(keys.filter((key) => !known.has(key))).toEqual([])
        }
    })
})

describe("the candidate's contact field", () => {
    it("is erased with the contact: the person's CV and screening go with them", () => {
        const field = hiringCandidateEntity.fields.contactId
        expect(field.kind).toBe("contact")
        expect(field.nullable).toBe(true)
        expect(field.onContactDelete).toBeUndefined()
    })

    it("has the index the contact read is served by: the contact, the newest first", () => {
        expect(hiringCandidateEntity.indexes?.find((index) => index.name === "contact_recent")?.on).toEqual([
            "contactId",
            { desc: "createdAt" },
            { desc: "id" },
        ])
    })
})
