import { REMEDY_SCHEMA } from "./remedy.schema"

const draft = {
    title: "Nghi quyet thong qua Dieu le sua doi",
    documentType: "Nghi quyet HDTV",
    body: "# Nghi quyet\n\nNgay [Signing date: dd/mm/yyyy]",
    placeholders: [{ label: "Ngay ky", reason: "Chua co ngay hop" }],
}

describe("REMEDY_SCHEMA", () => {
    it("reads a draft with a placeholder", () => {
        expect(REMEDY_SCHEMA.safeParse(draft).success).toBe(true)
    })

    it.each([
        ["an empty title", { ...draft, title: "" }],
        ["a title of 161 characters", { ...draft, title: "a".repeat(161) }],
        ["a document type of 81 characters", { ...draft, documentType: "a".repeat(81) }],
        ["an empty body", { ...draft, body: "" }],
        ["a body of 40,001 characters", { ...draft, body: "a".repeat(40_001) }],
        ["31 placeholders", { ...draft, placeholders: Array(31).fill(draft.placeholders[0]) }],
        [
            "a placeholder label of 121 characters",
            { ...draft, placeholders: [{ label: "a".repeat(121), reason: "x" }] },
        ],
        [
            "a placeholder reason of 201 characters",
            { ...draft, placeholders: [{ label: "x", reason: "a".repeat(201) }] },
        ],
    ])("refuses %s", (_name, answer) => {
        expect(REMEDY_SCHEMA.safeParse(answer).success).toBe(false)
    })

    it("reads a body of exactly 40,000 characters", () => {
        expect(REMEDY_SCHEMA.safeParse({ ...draft, body: "a".repeat(40_000) }).success).toBe(true)
    })
})
