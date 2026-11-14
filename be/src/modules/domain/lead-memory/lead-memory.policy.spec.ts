import type { ContactMemoryEntry, ContactMemoryValues, ContactWithIdentities } from "@modules/domain/contacts"
import type { MemoryWrite } from "@nivo-lite/agent-sdk/node"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { CONTACT_REMEMBER_SCHEMA } from "@modules/domain/contact-tools/contact-tools.schema"
import { LAN_BIRTHDAY_VI, MOM_BIRTHDAY_VI } from "@tests/fixtures/i18n/lead-memory-spec.messages"
import {
    entryKeyOf,
    expiresAtOf,
    contactMemorySubjectOf,
    factsOfContact,
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
    contactMemorySubjectOf,
    factsOfContact,
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

const rowOf = (values: ContactMemoryValues, id: string = "r1"): ContactMemoryEntry => ({
    ...values,
    id,
    version: 1,
    updatedAt: NOW.toISOString(),
})

const LEAD = contactMemorySubjectOf("l1", "c1")

const WRITE: MemoryWrite = {
    subject: LEAD,
    namespace: "sales.consult",
    workflowId: "wf",
    agentId: "a",
    nodeKey: "order",
    step: "sales.order-from-chat",
    outcome: {
        status: "done",
        output: { orderId: "o1" },
        error: null,
        runId: "run",
        versionId: "v",
        at: NOW.toISOString(),
    },
    facts: { address: "335 Ba Trieu" },
    trigger: { text: "hi" },
}

describe("lead memory policy", () => {
    it("keys a person by their contact, else their conversation, else nothing", async () => {
        const { entryKeyOf, memorySubjectOf } = await buildPolicy()
        expect(memorySubjectOf({ contactId: "l1", conversationId: "c1" })).toEqual(LEAD)
        expect(LEAD.key).toBe("contact:l1")
        expect(memorySubjectOf({ conversationId: "c1" })).toEqual({
            key: "conversation:c1",
            contactId: null,
            conversationId: "c1",
        })
        expect(memorySubjectOf({ contactId: "" })).toBeNull()
        expect(entryKeyOf("contact:l1", "sales.consult", "order")).toBe("contact:l1|sales.consult|order")
    })

    it("keeps 30 days after the lead closes, 365 idle days while open, 30 idle days for a conversation", async () => {
        const { expiresAtOf } = await buildPolicy()
        expect(expiresAtOf(LEAD, NOW, NOW).getTime()).toBe(NOW.getTime() + 30 * DAY)
        expect(expiresAtOf(LEAD, NOW, null).getTime()).toBe(NOW.getTime() + 365 * DAY)
        expect(expiresAtOf({ key: "conversation:c1", contactId: null, conversationId: "c1" }, NOW, null).getTime()).toBe(
            NOW.getTime() + 30 * DAY,
        )
    })

    it("writes a step's entry and its workflow's trigger entry, and reads the outcome back", async () => {
        const { stepMemoryOfRow, stepValuesOf, triggerValuesOf } = await buildPolicy()
        const values = stepValuesOf(WRITE, NOW)
        expect(values).toMatchObject({
            entryKey: "contact:l1|sales.consult|order",
            kind: "done",
            output: { value: { orderId: "o1" } },
            error: null,
        })
        expect(triggerValuesOf(WRITE, NOW)).toMatchObject({
            entryKey: "contact:l1|sales.consult|$trigger",
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
        expect(values.entryKey).toBe("contact:l1|$lead|$facts")
    })

    it("adds a date the customer mentions to the ones held, each once (D-MX-6: a second birthday never drops the first)", async () => {
        const { factsValuesOf } = await buildPolicy()
        const mom = { label: MOM_BIRTHDAY_VI, date: "03-08" }
        const lan = { label: LAN_BIRTHDAY_VI, date: "11-21" }
        const values = factsValuesOf(LEAD, { occasions: [mom], address: "1 Le Loi" }, { occasions: [lan, mom] }, NOW)
        expect(values.output).toEqual({ value: { occasions: [mom, lan], address: "1 Le Loi" } })
    })

    it("snapshots facts (contact under proved) and the latest outcome per workflow, the contact's entries over the conversation's", async () => {
        const { factsOfContact, factsValuesOf, snapshotOf, stepValuesOf, triggerValuesOf } = await buildPolicy()
        const at = NOW.toISOString()
        const identity = { contactId: "l1", provider: "", account: "", verifiedBy: "token" as const, source: "step" as const, joinedBy: null, at }
        const lead: ContactWithIdentities = {
            id: "l1",
            workspaceId: "ws",
            displayName: "An",
            tags: [],
            state: "active",
            createdAt: at,
            updatedAt: at,
            identities: [
                { ...identity, id: "i1", kind: "phone", value: "84901234567", verified: true },
                { ...identity, id: "i2", kind: "email", value: "an@claim.vn", verified: false, verifiedBy: null },
            ],
        }
        // Only the contact's own verified facts are read: the order and this memory are the homes of a delivery's details; a claim is no fact.
        expect(factsOfContact(lead)).toEqual({ name: "An", phone: "84901234567" })
        const conversation = {
            ...stepValuesOf(WRITE, NOW),
            subjectKey: "conversation:c1",
            output: { value: { orderId: "old" } },
        }
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
        expect(snapshot.lead).toEqual({ name: "An", phone: "84901234567", address: "335 Ba Trieu" })
        expect(snapshot.workflows["sales.consult"]?.["order"]?.output).toEqual({ orderId: "o1" })
        expect(Object.keys(snapshot.workflows["sales.consult"] ?? {})).toEqual(["order"])
    })
})

// D-MX-6 (live B-BUY / H3, 2026-11-11): the customer's "by the way, sister Lan's birthday is on 21/11" was heard by the consult but never
// written, so the care plan on payment armed `occasions: 0`. The ENGINE half of the chain is here: the payload the occasion keep writes
// is taken by the contact memory write's own payload schema, and laid over a memory that already held her mother's birthday the lead
// memory's facts entry keeps both dates (an earlier date kept). The sales half (the consult hears the date, the keep writes it, the care
// read of the kept facts, the occasion plan arming the reminder) moved to
// packages/blocks-core/src/nodes/sales/occasion-chain.spec.ts with the sales nodes and `leadCareOf`.

const OCCASION_LEAD = "lead-1"
const LAN = { label: LAN_BIRTHDAY_VI, date: "11-21" }
const MOM = { label: MOM_BIRTHDAY_VI, date: "03-08" }
/** Noon on the day of the walk (2026-11-11, Vietnam). */
const OCCASION_NOW = new Date("2026-11-11T05:00:00.000Z")

describe("an occasion the customer mentions reaches the lead memory (D-MX-6)", () => {
    it("LIVE B-BUY: the contact memory write takes the date as written, and laid over the earlier one both are kept", async () => {
        const { factsValuesOf } = await buildPolicy()
        const said = [LAN]

        // The keep writes the date with the contact memory write, exactly this payload; the tool's own payload schema takes it as written.
        const payload = { facts: { occasions: said } }
        expect(CONTACT_REMEMBER_SCHEMA.parse(payload)).toEqual(expect.objectContaining({ facts: { occasions: said } }))

        // Laid over a memory that already held her mother's birthday: both are kept.
        const memorySubject = leadMemorySubjectOf(OCCASION_LEAD, "conv-1")
        const entry = factsValuesOf(memorySubject, { occasions: [MOM] }, { occasions: said }, OCCASION_NOW)
        expect(entry.output).toEqual({ value: { occasions: [MOM, ...said] } })
    })
})
