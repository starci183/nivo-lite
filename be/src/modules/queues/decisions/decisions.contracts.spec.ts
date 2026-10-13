import {
    DECISIONS_QUEUE,
    DecisionsJob,
    decisionsDedupeKey,
    isConfirmCommandPayload,
    isDecideExecutionPayload,
    isDecideWorkPayload,
    isProposeCommandPayload,
} from "./decisions.contracts"

const scope = { workspaceId: "workspace-1", userId: "user-1", locale: "en" }
const work = { ...scope, workItemId: "work-1", decision: "approved" }
const execution = { ...scope, executionId: "execution-1", decision: "approved" }

interface GuardCase {
    name: string
    guard: (value: unknown) => boolean
    payload: Record<string, unknown>
    id: string
}

const guards: Array<GuardCase> = [
    { name: "isDecideWorkPayload", guard: isDecideWorkPayload, payload: work, id: "workItemId" },
    { name: "isDecideExecutionPayload", guard: isDecideExecutionPayload, payload: execution, id: "executionId" },
    {
        name: "isProposeCommandPayload",
        guard: isProposeCommandPayload,
        payload: { ...scope, messageId: "message-1" },
        id: "messageId",
    },
    {
        name: "isConfirmCommandPayload",
        guard: isConfirmCommandPayload,
        payload: { ...scope, candidateId: "candidate-1" },
        id: "candidateId",
    },
]

describe.each(guards)("$name", ({ guard, payload, id }) => {
    it.each(["en", "vi"])("accepts the required fields with locale %s", (locale) => {
        expect(guard({ ...payload, locale })).toBe(true)
    })

    it.each([
        { name: "undefined", value: undefined },
        { name: "null", value: null },
        { name: "a number", value: 1 },
        { name: "a string", value: "payload" },
        { name: "a boolean", value: false },
        { name: "an array without a scope", value: [] },
        { name: "an empty record", value: {} },
    ])("rejects $name", ({ value }) => {
        expect(guard(value)).toBe(false)
    })

    it.each([
        { name: "a missing workspace", changes: { workspaceId: undefined } },
        { name: "a null workspace", changes: { workspaceId: null } },
        { name: "a numeric workspace", changes: { workspaceId: 1 } },
        { name: "a missing user", changes: { userId: undefined } },
        { name: "a null user", changes: { userId: null } },
        { name: "a numeric user", changes: { userId: 1 } },
        { name: "a missing locale", changes: { locale: undefined } },
        { name: "a null locale", changes: { locale: null } },
        { name: "a numeric locale", changes: { locale: 1 } },
        { name: "an unsupported locale", changes: { locale: "fr" } },
    ])("rejects $name", ({ changes }) => {
        expect(guard({ ...payload, ...changes })).toBe(false)
    })

    it.each([
        { name: "missing", value: undefined },
        { name: "null", value: null },
        { name: "numeric", value: 1 },
    ])("rejects a $name subject id", ({ value }) => {
        expect(guard({ ...payload, [id]: value })).toBe(false)
    })
})

describe.each([
    { name: "isDecideWorkPayload", guard: isDecideWorkPayload, payload: work },
    { name: "isDecideExecutionPayload", guard: isDecideExecutionPayload, payload: execution },
])("$name verdict", ({ guard, payload }) => {
    it.each(["approved", "rejected"])("accepts %s", (decision) => {
        expect(guard({ ...payload, decision })).toBe(true)
    })

    it.each([
        { name: "missing", value: undefined },
        { name: "null", value: null },
        { name: "numeric", value: 1 },
        { name: "unknown", value: "pending" },
    ])("rejects a $name verdict", ({ value }) => {
        expect(guard({ ...payload, decision: value })).toBe(false)
    })
})

describe("isDecideWorkPayload edits", () => {
    it.each([
        { name: "omitted edits", edits: undefined },
        { name: "null edits", edits: null },
        { name: "empty edits", edits: {} },
        { name: "a draft", edits: { draft: "Revised draft" } },
        { name: "an amount", edits: { amount_vnd: 120_000 } },
        { name: "a cleared amount", edits: { amount_vnd: null } },
        { name: "a candidate", edits: { candidateId: "invoice-1" } },
        { name: "empty fields", edits: { fields: [] } },
        { name: "a field name", edits: { fields: [{ name: "status" }] } },
        { name: "a text field", edits: { fields: [{ name: "status", text: "paid" }] } },
        { name: "a numeric field", edits: { fields: [{ name: "quantity", number: 3 }] } },
        {
            name: "all edits and multiple fields",
            edits: {
                draft: "Revised draft",
                amount_vnd: 120_000,
                candidateId: "invoice-1",
                fields: [
                    { name: "status", text: "paid", number: 1 },
                    { name: "quantity", number: 3 },
                ],
            },
        },
    ])("accepts $name", ({ edits }) => {
        expect(isDecideWorkPayload({ ...work, edits })).toBe(true)
    })

    it.each([
        { name: "a string", edits: "edits" },
        { name: "a number", edits: 1 },
        { name: "a null draft", edits: { draft: null } },
        { name: "a numeric draft", edits: { draft: 1 } },
        { name: "a string amount", edits: { amount_vnd: "120000" } },
        { name: "a null candidate id", edits: { candidateId: null } },
        { name: "a numeric candidate id", edits: { candidateId: 1 } },
        { name: "null fields", edits: { fields: null } },
        { name: "record fields", edits: { fields: { name: "status" } } },
        { name: "string fields", edits: { fields: "status" } },
        { name: "an undefined field", edits: { fields: [undefined] } },
        { name: "a null field", edits: { fields: [null] } },
        { name: "a primitive field", edits: { fields: ["status"] } },
        { name: "a missing field name", edits: { fields: [{}] } },
        { name: "a null field name", edits: { fields: [{ name: null }] } },
        { name: "a numeric field name", edits: { fields: [{ name: 1 }] } },
        { name: "null field text", edits: { fields: [{ name: "status", text: null }] } },
        { name: "numeric field text", edits: { fields: [{ name: "status", text: 1 }] } },
        { name: "null field number", edits: { fields: [{ name: "quantity", number: null }] } },
        { name: "string field number", edits: { fields: [{ name: "quantity", number: "3" }] } },
        { name: "an invalid later field", edits: { fields: [{ name: "status", text: "paid" }, { name: 1 }] } },
    ])("rejects $name", ({ edits }) => {
        expect(isDecideWorkPayload({ ...work, edits })).toBe(false)
    })
})

describe.each([
    { name: "note", guard: isDecideWorkPayload, payload: work },
    { name: "basis", guard: isDecideWorkPayload, payload: work },
    { name: "editedDraft", guard: isDecideExecutionPayload, payload: execution },
])("optional $name", ({ name, guard, payload }) => {
    it.each([
        { description: "omitted text", value: undefined, expected: true },
        { description: "null text", value: null, expected: true },
        { description: "empty text", value: "", expected: true },
        { description: "supplied text", value: "Updated text", expected: true },
        { description: "a number", value: 1, expected: false },
        { description: "a boolean", value: false, expected: false },
        { description: "a record", value: {}, expected: false },
    ])("returns $expected for $description", ({ value, expected }) => {
        expect(guard({ ...payload, [name]: value })).toBe(expected)
    })
})

describe("decisions queue contract", () => {
    it("names the queue decisions", () => {
        expect(DECISIONS_QUEUE).toBe("decisions")
    })

    it.each([
        { job: DecisionsJob.DecideWork, subject: "work-1", key: "decisions.decide-work:work-1" },
        { job: DecisionsJob.DecideExecution, subject: "execution-1", key: "decisions.decide-execution:execution-1" },
        { job: DecisionsJob.ProposeCommand, subject: "message-1", key: "office.propose-command:message-1" },
        { job: DecisionsJob.ConfirmCommand, subject: "candidate-1", key: "office.confirm-command:candidate-1" },
    ])("keys $job by its subject", ({ job, subject, key }) => {
        expect(decisionsDedupeKey(job, subject)).toBe(key)
    })
})
