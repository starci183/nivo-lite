import {
    MAX_COMMAND_DEPTH,
    defaultDedupeKey,
    instanceLabel,
    isSubjectType,
    isUuid,
    missingPayload,
    shownSubject,
    splitPayload,
    tooDeep,
} from "./command-rules.policy"

describe("command rules policy", () => {
    describe("missingPayload", () => {
        it("lists the required keys that are absent, null or blank", () => {
            expect(missingPayload(["a", "b", "c", "d"], { a: "x", b: "  ", c: null })).toEqual(["b", "c", "d"])
        })

        it("answers nothing when everything is there", () => {
            expect(missingPayload(["a"], { a: 0 })).toEqual([])
        })
    })

    describe("splitPayload", () => {
        it("separates the address from the proposal fields", () => {
            const split = splitPayload(
                { subject_type: "order", subject_id: "o-1", lead_id: "l-1", amount: 5, note: "hi", gone: null },
                "lead",
            )
            expect(split).toEqual({
                subjectType: "order",
                subjectId: "o-1",
                leadId: "l-1",
                fields: { amount: 5, note: "hi", gone: null },
            })
        })

        it("falls back to the receiver's subject type and ignores blank ids", () => {
            expect(splitPayload({ subject_id: " ", lead_id: 3 }, "lead")).toEqual({
                subjectType: "lead",
                subjectId: null,
                leadId: null,
                fields: {},
            })
        })

        it("keeps other values as proposal fields: text and numbers as they are, the rest as JSON", () => {
            const split = splitPayload({ flag: true, tags: ["a"], missing: undefined, text: "t" }, "lead")
            expect(split.fields).toEqual({ flag: "true", tags: '["a"]', text: "t" })
        })
    })

    describe("isSubjectType", () => {
        it("accepts the kinds of record and refuses others", () => {
            expect(isSubjectType("purchase_order")).toBe(true)
            expect(isSubjectType("planet")).toBe(false)
        })
    })

    describe("tooDeep", () => {
        it("allows the limit and refuses one more hop", () => {
            expect(tooDeep(MAX_COMMAND_DEPTH)).toBe(false)
            expect(tooDeep(MAX_COMMAND_DEPTH + 1)).toBe(true)
        })
    })

    describe("defaultDedupeKey", () => {
        it("names the command, the kind and the subject", () => {
            expect(defaultDedupeKey("issue", "order", "o-1")).toBe("cmd:issue:order:o-1")
            expect(defaultDedupeKey("issue", "order", null)).toBe("cmd:issue:order:none")
        })
    })

    describe("instanceLabel", () => {
        it("shows the instance name after the type name", () => {
            expect(instanceLabel("Chatbot", "Branch 1")).toBe("Chatbot – Branch 1")
        })

        it("shows the type alone when the instance has no name of its own", () => {
            expect(instanceLabel("Chatbot", null)).toBe("Chatbot")
            expect(instanceLabel("Chatbot", " chatbot ")).toBe("Chatbot")
        })
    })

    describe("shownSubject", () => {
        it("prefixes an order number once", () => {
            expect(shownSubject("order", "DH-1")).toBe("#DH-1")
            expect(shownSubject("order", "#DH-1")).toBe("#DH-1")
        })

        it("shows any other label as it is", () => {
            expect(shownSubject("lead", "Lan")).toBe("Lan")
        })
    })

    describe("isUuid", () => {
        it("recognises a UUID", () => {
            expect(isUuid("2f5f2c0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f")).toBe(true)
            expect(isUuid("owner")).toBe(false)
        })
    })
})
