import { Test } from "@nestjs/testing"
import type { FlowPayload } from "@modules/domain/flows"
import { FlowEngineError, FlowEngineErrorCode } from "./errors/flow-engine.error"
import {
    authorityPatchOf,
    chatTextOf,
    conversationIdOf,
    editsOf,
    localeOf,
    noteOf,
    ruleChangeOf,
    simulationOf,
    staffIdOf,
    staffWriteOf,
    takeOf,
    verdictOf,
    workItemIdOf,
} from "./flow-command.mapper"

const SUBJECT = Symbol("flow-command.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    localeOf,
                    chatTextOf,
                    authorityPatchOf,
                    ruleChangeOf,
                    staffWriteOf,
                    workItemIdOf,
                    verdictOf,
                    editsOf,
                    noteOf,
                    staffIdOf,
                    simulationOf,
                    conversationIdOf,
                    takeOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./flow-command.mapper")>(SUBJECT)
}

const registerCommandLocaleAndText = () => {
    it("uses English only when explicitly selected", async () => {
        const subject = await buildSubject()

        expect(subject.localeOf({ locale: "en" })).toBe("en")
        expect(subject.localeOf({ locale: "vi" })).toBe("vi")
        expect(subject.localeOf({})).toBe("vi")
    })

    it("accepts text aliases and gives the first present value precedence", async () => {
        const subject = await buildSubject()

        expect(subject.chatTextOf({ body: "legacy" })).toBe("legacy")
        expect(subject.chatTextOf({ text: "", body: "legacy" })).toBe("")
        expect(subject.workItemIdOf({ work_item_id: "item" })).toBe("item")
        expect(subject.workItemIdOf({ workItemId: "new", work_item_id: "old" })).toBe("new")
        expect(subject.conversationIdOf({ conversation_id: "conversation" })).toBe("conversation")
        expect(subject.staffIdOf({ staff_id: "staff" })).toBe("staff")
        expect(subject.staffIdOf({ staffId: null, staff_id: "ignored" })).toBeNull()
        expect(subject.staffIdOf({})).toBeNull()
    })

    it.each([undefined, null, 1, false, {}])("rejects missing or nontext chat text %p", async (value) => {
        const subject = await buildSubject()

        expectInvalid(() => subject.chatTextOf({ text: value }), "text")
    })

    it("reads optional notes without converting absent or null values to text", async () => {
        const subject = await buildSubject()

        expect(subject.noteOf({}, "basis")).toBeUndefined()
        expect(subject.noteOf({ basis: null }, "basis")).toBeUndefined()
        expect(subject.noteOf({ basis: "" }, "basis")).toBe("")
        expect(subject.noteOf({ basis: "approved by owner" }, "basis")).toBe("approved by owner")
    })

    it.each([undefined, null])("keeps the blank invalid field for a malformed note name %p", async (name) => {
        const subject = await buildSubject()

        const readNote = jest.fn().mockImplementation(subject.noteOf)
        expectInvalid(() => readNote({ undefined: 7, null: 7 }, name), "")
    })

    it("patches only present authority fields and rounds numeric goals", async () => {
        const subject = await buildSubject()

        expect(subject.authorityPatchOf({})).toEqual({})
        expect(
            subject.authorityPatchOf({
                policies: "policy",
                reply_style: "friendly",
                brand_voice: "calm",
                limits_note: "ask first",
                goal_note: "grow",
                goal_revenue_vnd: 10.6,
                goal_new_customers: null,
                goal_first_reply_minutes: 0,
            }),
        ).toEqual({
            policies: "policy",
            reply_style: "friendly",
            brand_voice: "calm",
            limits_note: "ask first",
            goal_note: "grow",
            goal_revenue_vnd: 11,
            goal_new_customers: null,
            goal_first_reply_minutes: 0,
        })
        expectInvalid(() => subject.authorityPatchOf({ policies: null }), "policies")
    })

    it.each(["5", -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects an invalid numeric goal %p", async (value) => {
        const subject = await buildSubject()

        expectInvalid(() => subject.authorityPatchOf({ goal_revenue_vnd: value }), "goal_revenue_vnd")
    })
}

const registerRuleCommands = () => {
    it("maps rule aliases and defaults missing optional fields", async () => {
        const subject = await buildSubject()

        expect(subject.ruleChangeOf({ action: "quote", department: "sales", mode: "ask" })).toEqual({
            action: "quote",
            department: "sales",
            mode: "ask",
            limit_vnd: null,
            required_fields: [],
            note: null,
        })
        expect(
            subject.ruleChangeOf({
                action: "reply",
                department: "support",
                mode: "auto",
                limitVnd: 12.5,
                requiredFields: ["email", "name"],
                note: "check customer",
            }),
        ).toEqual({
            action: "reply",
            department: "support",
            mode: "auto",
            limit_vnd: 13,
            required_fields: ["email", "name"],
            note: "check customer",
        })
        expect(
            subject.ruleChangeOf({ action: "reply", department: "support", mode: "never", required_fields: null }),
        ).toEqual({
            action: "reply",
            department: "support",
            mode: "never",
            limit_vnd: null,
            required_fields: [],
            note: null,
        })
    })

    it.each([
        { required_fields: "email" },
        { required_fields: {} },
        { required_fields: [1] },
        { required_fields: ["email", false] },
    ])("rejects malformed required fields %p", async ({ required_fields }) => {
        const subject = await buildSubject()

        expectInvalid(() => subject.ruleChangeOf({ required_fields }), "required_fields")
    })

    it("rejects unsupported rule modes and verdicts", async () => {
        const subject = await buildSubject()

        expectInvalid(() => subject.ruleChangeOf({ action: "reply", department: "support", mode: "sometimes" }), "mode")
        expectInvalid(() => subject.verdictOf({ decision: "later" }), "decision")
        expect(subject.verdictOf({ decision: "approved" })).toBe("approved")
        expect(subject.verdictOf({ decision: "rejected" })).toBe("rejected")
    })
}

const registerStaffCommands = () => {
    it("maps staff rows with explicit values and defaults", async () => {
        const subject = await buildSubject()

        expect(subject.staffWriteOf("ws", { name: "An" })).toEqual({
            workspaceId: "ws",
            id: null,
            name: "An",
            role: "",
            email: null,
            active: null,
        })
        expect(
            subject.staffWriteOf("ws", { id: "s", name: "An", role: "owner", email: "an@example.com", active: true }),
        ).toEqual({
            workspaceId: "ws",
            id: "s",
            name: "An",
            role: "owner",
            email: "an@example.com",
            active: true,
        })
        expect(subject.staffWriteOf("ws", { name: "An", active: null }).active).toBeNull()
        expect(subject.staffWriteOf("ws", { name: "An", active: false }).active).toBe(false)
        expectInvalid(() => subject.staffWriteOf("ws", { name: "An", active: "true" }), "active")
    })

    it("defaults conversation takeover to true while preserving false and aliases", async () => {
        const subject = await buildSubject()

        expect(subject.takeOf({})).toBe(true)
        expect(subject.takeOf({ take: null })).toBe(true)
        expect(subject.takeOf({ take: true })).toBe(true)
        expect(subject.takeOf({ takeOver: false })).toBe(false)
        expectInvalid(() => subject.takeOf({ take: 1 }), "take")
    })

    it.each([{}, { edits: undefined }, { edits: null }, { edits: {} }])("omits absent edits %p", async (payload) => {
        const subject = await buildSubject()

        expect(subject.editsOf(payload)).toEqual({})
    })

    it.each([{ edits: [] }, { edits: "draft" }, { edits: 2 }, { edits: true }])(
        "rejects edits that are not a record %p",
        async ({ edits }) => {
            const subject = await buildSubject()

            expectInvalid(() => subject.editsOf({ edits }), "edits")
        },
    )
}

const registerEditCommands = () => {
    it("maps all edits and both field formats", async () => {
        const subject = await buildSubject()

        expect(
            subject.editsOf({
                edits: { draft: "reply", amount_vnd: 10.5, candidate_id: "candidate", fields: { name: "An", age: 0 } },
            }),
        ).toEqual({
            draft: "reply",
            amount_vnd: 10.5,
            candidateId: "candidate",
            fields: [
                { name: "name", text: "An" },
                { name: "age", number: 0 },
            ],
        })
        expect(
            subject.editsOf({
                edits: {
                    draft: null,
                    amount_vnd: null,
                    candidateId: "new",
                    candidate_id: "old",
                    fields: [
                        { name: "name", text: "", number: 3 },
                        { name: "age", text: null, number: 5 },
                    ],
                },
            }),
        ).toEqual({
            amount_vnd: null,
            candidateId: "new",
            fields: [
                { name: "name", text: "" },
                { name: "age", number: 5 },
            ],
        })
        expect(subject.editsOf({ edits: { fields: null } })).toEqual({})
    })

    it.each([{ fields: false }, { fields: 42 }, { fields: "legacy" }, { fields: [] }])(
        "maps an empty or unsupported field container to an empty list %p",
        async ({ fields }) => {
            const subject = await buildSubject()

            expect(subject.editsOf({ edits: { fields } })).toEqual({ fields: [] })
        },
    )

    it.each([
        { fields: [null] },
        { fields: [1] },
        { fields: [{ text: "missing name" }] },
        { fields: [{ name: 2, text: "wrong name" }] },
    ])("rejects a field entry without a string name %p", async ({ fields }) => {
        const subject = await buildSubject()

        expectInvalid(() => subject.editsOf({ edits: { fields } }), "edits.fields")
    })

    it.each([undefined, null, true, {}, Number.POSITIVE_INFINITY, Number.NaN])(
        "rejects unsupported field values %p",
        async (value) => {
            const subject = await buildSubject()

            expectInvalid(() => subject.editsOf({ edits: { fields: { amount: value } } }), "edits.fields.amount")
        },
    )
}

const registerSimulatorCommands = () => {
    it("maps current simulator names and absent optional fields", async () => {
        const subject = await buildSubject()

        expect(subject.simulationOf({ channel: "manual", kind: "order" })).toEqual({
            channel: "manual",
            kind: "order",
            senderName: "",
            senderContact: null,
            body: null,
            amountVnd: null,
            externalRef: null,
            items: null,
            eventId: null,
            locale: "vi",
        })
        const payload: FlowPayload = {
            channel: "bank",
            kind: "payment",
            senderName: "An",
            senderContact: "phone",
            body: "paid",
            amountVnd: 100,
            externalRef: "ref",
            items: "items",
            eventId: "event",
            locale: "en",
        }
        expect(subject.simulationOf(payload)).toEqual(payload)
        expectInvalid(() => subject.simulationOf({ channel: "other", kind: "message" }), "channel")
        expectInvalid(() => subject.simulationOf({ channel: "email", kind: "other" }), "kind")
    })
}

const expectInvalid = (action: () => unknown, field: string): void => {
    expect(action).toThrow(FlowEngineError)
    expect(action).toThrow(expect.objectContaining({ code: FlowEngineErrorCode.InvalidPayload, params: { field } }))
}

describe("flow command payloads", () => {
    registerCommandLocaleAndText()
    registerRuleCommands()
    registerStaffCommands()
    registerEditCommands()
    registerSimulatorCommands()
})
