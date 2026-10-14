import { LeadActionsErrorCode } from "./errors/lead-actions.error"
import { inputOf } from "./lead-action-input.policy"

const ID = "12345678-1234-1234-1234-123456789abc"
const create = {
    contactName: " An ",
    company: " Acme ",
    channel: " web ",
    need: " a quote ",
}
const invalid = (field: string) => ({
    kind: "refused",
    code: LeadActionsErrorCode.InvalidInput,
    params: { field },
})

describe("lead action input policy", () => {
    it.each([undefined, null, "unknown", 42])("refuses an unsupported action %p", (action) => {
        expect(inputOf(action, create)).toEqual(invalid("action"))
    })

    it.each([undefined, null, "input", 42, []])("refuses a non-record input %p", (input) => {
        expect(inputOf("create", input)).toEqual(invalid("input"))
    })

    it("trims create fields, drops unrelated fields, and defaults omitted contacts to null", () => {
        expect(inputOf("create", { ...create, unrelated: "ignored" })).toEqual({
            kind: "ok",
            value: { contactName: "An", company: "Acme", channel: "web", need: "a quote", phone: null, email: null },
        })
    })

    it("keeps bounded contacts and normalizes explicitly empty contacts", () => {
        expect(inputOf("create", { ...create, phone: " 0901234567 ", email: " An@example.test " })).toEqual({
            kind: "ok",
            value: {
                contactName: "An",
                company: "Acme",
                channel: "web",
                need: "a quote",
                phone: "0901234567",
                email: "An@example.test",
            },
        })
        expect(inputOf("create", { ...create, phone: null, email: "   " })).toEqual({
            kind: "ok",
            value: { contactName: "An", company: "Acme", channel: "web", need: "a quote", phone: null, email: null },
        })
    })

    it.each<readonly [string, unknown]>([
        ["contactName", 1],
        ["contactName", "A"],
        ["contactName", "n".repeat(201)],
        ["company", " "],
        ["company", "c".repeat(201)],
        ["channel", ""],
        ["channel", "c".repeat(101)],
        ["need", "four"],
        ["need", "n".repeat(2001)],
        ["phone", 123],
        ["phone", "p".repeat(81)],
        ["email", 123],
        ["email", "e".repeat(321)],
        ["email", "broken@address"],
    ])("refuses invalid %s value %p", (field, value) => {
        expect(inputOf("create", { ...create, [field]: value })).toEqual(invalid(field))
    })

    it("accepts create fields at their size limits", () => {
        const value = {
            contactName: "n".repeat(200),
            company: "c".repeat(200),
            channel: "c".repeat(100),
            need: "n".repeat(2000),
            phone: "p".repeat(80),
            email: `${"e".repeat(308)}@example.com`,
        }
        expect(inputOf("create", value)).toEqual({ kind: "ok", value })
    })

    it.each(["refresh-context", "suggest-owner"])("retains only the lead id for %s", (action) => {
        expect(inputOf(action, { leadId: ID, evidence: "ignored" })).toEqual({ kind: "ok", value: { leadId: ID } })
    })

    it.each([undefined, "short", "z".repeat(36)])("refuses an invalid lead id %p", (leadId) => {
        expect(inputOf("refresh-context", { leadId })).toEqual(invalid("leadId"))
    })

    it("targets a responsibility for drafting and refuses malformed responsibility ids", () => {
        expect(inputOf("draft-execution", { responsibilityId: ID, leadId: "ignored" })).toEqual({
            kind: "ok",
            value: { responsibilityId: ID },
        })
        expect(inputOf("draft-execution", { responsibilityId: "broken" })).toEqual(invalid("responsibilityId"))
    })

    it("preserves settlement evidence or defaults it to an empty text", () => {
        expect(inputOf("settle-won", { leadId: ID, evidence: " signed contract " })).toEqual({
            kind: "ok",
            value: { leadId: ID, evidence: "signed contract" },
        })
        expect(inputOf("settle-won", { leadId: ID, evidence: null })).toEqual({
            kind: "ok",
            value: { leadId: ID, evidence: "" },
        })
        expect(inputOf("settle-won", { leadId: ID, evidence: "e".repeat(2001) })).toEqual(invalid("evidence"))
    })
})
