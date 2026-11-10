import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { MemoryWrite } from "@nivo-lite/agent-sdk/node"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    entryKeyOf,
    expiresAtOf,
    factsOfLead,
    factsValuesOf,
    leadMemorySubjectOf,
    memorySubjectOf,
    snapshotOf,
    stepMemoryOfRow,
    stepValuesOf,
    triggerValuesOf,
} from "./lead-memory.policy"

const POLICY = {
    entryKeyOf,
    expiresAtOf,
    factsOfLead,
    factsValuesOf,
    memorySubjectOf,
    snapshotOf,
    stepMemoryOfRow,
    stepValuesOf,
    triggerValuesOf,
}

const SUBJECT = Symbol("lead-memory.policy")

/** The policy, bound as a kit double over its real functions. */
const subject = mock<typeof POLICY>({ ...POLICY })

/** The policy as Nest hands it to a caller. */
const buildPolicy = async (): Promise<typeof POLICY> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: subject }],
    }).compile()
    return moduleRef.get<typeof POLICY>(SUBJECT)
}

const NOW = new Date("2026-11-09T00:00:00.000Z")
const DAY = 86_400_000

const rowOf = (data: Readonly<Record<string, unknown>>, id: string = "r1"): RecordRow => ({
    id,
    workspaceId: "ws",
    version: "1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    data,
})

const LEAD = leadMemorySubjectOf("l1", "c1")

const WRITE: MemoryWrite = {
    subject: LEAD,
    namespace: "sales.consult",
    workflowId: "wf",
    agentId: "a",
    nodeKey: "order",
    step: "sales.order-from-chat",
    outcome: { status: "done", output: { orderId: "o1" }, error: null, runId: "run", versionId: "v", at: NOW.toISOString() },
    facts: { address: "335 Ba Trieu" },
    trigger: { text: "hi" },
}

describe("lead memory policy", () => {
    it("keys a customer by their lead, else their conversation, else nothing", async () => {
        const { entryKeyOf, memorySubjectOf } = await buildPolicy()
        expect(memorySubjectOf({ leadId: "l1", conversationId: "c1" })).toEqual(LEAD)
        expect(memorySubjectOf({ conversationId: "c1" })).toEqual({
            key: "conversation:c1",
            leadId: null,
            conversationId: "c1",
        })
        expect(memorySubjectOf({ leadId: "" })).toBeNull()
        expect(entryKeyOf("lead:l1", "sales.consult", "order")).toBe("lead:l1|sales.consult|order")
    })

    it("keeps 30 days after the lead closes, 365 idle days while open, 30 idle days for a conversation", async () => {
        const { expiresAtOf } = await buildPolicy()
        expect(expiresAtOf(LEAD, NOW, NOW).getTime()).toBe(NOW.getTime() + 30 * DAY)
        expect(expiresAtOf(LEAD, NOW, null).getTime()).toBe(NOW.getTime() + 365 * DAY)
        expect(expiresAtOf({ key: "conversation:c1", leadId: null, conversationId: "c1" }, NOW, null).getTime()).toBe(
            NOW.getTime() + 30 * DAY,
        )
    })

    it("writes a step's entry and its workflow's trigger entry, and reads the outcome back", async () => {
        const { stepMemoryOfRow, stepValuesOf, triggerValuesOf } = await buildPolicy()
        const values = stepValuesOf(WRITE, NOW)
        expect(values).toMatchObject({
            entryKey: "lead:l1|sales.consult|order",
            kind: "done",
            output: { value: { orderId: "o1" } },
            error: null,
        })
        expect(triggerValuesOf(WRITE, NOW)).toMatchObject({
            entryKey: "lead:l1|sales.consult|$trigger",
            kind: "trigger",
            output: { value: { text: "hi" } },
        })
        expect(stepMemoryOfRow(rowOf(values))).toEqual(WRITE.outcome)
        expect(stepMemoryOfRow(rowOf(triggerValuesOf(WRITE, NOW)))).toBeNull()
    })

    it("lays new facts over the held ones, only facts of the closed list and only non-empty", async () => {
        const { factsValuesOf } = await buildPolicy()
        const values = factsValuesOf(LEAD, { phone: "0901" }, { address: "335 Ba Trieu", name: "", phone: "0902" }, NOW)
        expect(values.output).toEqual({ value: { phone: "0902", address: "335 Ba Trieu" } })
        expect(values.entryKey).toBe("lead:l1|$lead|$facts")
    })

    it("snapshots facts (record under proved) and the latest outcome per workflow, the lead's entries over the conversation's", async () => {
        const { factsOfLead, factsValuesOf, snapshotOf, stepValuesOf, triggerValuesOf } = await buildPolicy()
        const lead = rowOf({ contactName: "An", phone: "0901", consultFacts: { address: "old", deliveryAt: "Sat" } })
        expect(factsOfLead(lead)).toEqual({ name: "An", phone: "0901", address: "old", deliveryAt: "Sat" })
        const conversation = { ...stepValuesOf(WRITE, NOW), subjectKey: "conversation:c1", output: { value: { orderId: "old" } } }
        const snapshot = snapshotOf(
            LEAD,
            [
                rowOf(stepValuesOf(WRITE, NOW), "a"),
                rowOf(conversation, "b"),
                rowOf(factsValuesOf(LEAD, {}, { address: "335 Ba Trieu" }, NOW), "c"),
                rowOf(triggerValuesOf(WRITE, NOW), "d"),
            ],
            lead,
        )
        expect(snapshot.lead).toEqual({ name: "An", phone: "0901", address: "335 Ba Trieu", deliveryAt: "Sat" })
        expect(snapshot.workflows["sales.consult"]?.["order"]?.output).toEqual({ orderId: "o1" })
        expect(Object.keys(snapshot.workflows["sales.consult"] ?? {})).toEqual(["order"])
    })
})
