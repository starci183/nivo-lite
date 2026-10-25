import { Test } from "@nestjs/testing"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import { parsePublicApiBody, parsePublicApiJob, parsePublicLeadBody } from "./public-api-job.policy"

const SUBJECT = Symbol("public-api-job.policy")
const WS = "11111111-1111-1111-1111-111111111111"
const REQUEST = "22222222-2222-2222-2222-222222222222"
const CONVERSATION = "33333333-3333-3333-3333-333333333333"
const LEAD_ID = "44444444-4444-4444-4444-444444444444"

const LEAD = {
    name: "Mai",
    contact: null,
    need: "Created through the API",
    channel: "API",
    company: "",
    note: "",
    stage: null,
    externalId: "",
    source: "api:n8n",
}
const MESSAGE = {
    conversationId: CONVERSATION,
    leadId: null,
    text: "Exact draft",
    requireApproval: false,
    source: "api:n8n",
}
const KNOWLEDGE = {
    title: "Guide",
    content: "Source text",
    topic: null,
    tags: ["api"],
    visibility: "internal",
    source: "api:n8n",
}
const LEGACY_LEAD = {
    kind: "lead",
    workspaceId: WS,
    inboundEventId: REQUEST,
    keyName: "n8n",
    company: "ACME",
    stage: "qualified",
    note: "Call later",
}
const LEGACY_MESSAGE = {
    ...MESSAGE,
    kind: "message",
    workspaceId: WS,
    keyName: "n8n",
    dedupeKey: "api.message:original",
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parsePublicApiBody, parsePublicApiJob, parsePublicLeadBody } }],
    }).compile()
    return moduleRef.get<{
        parsePublicApiBody: typeof parsePublicApiBody
        parsePublicApiJob: typeof parsePublicApiJob
        parsePublicLeadBody: typeof parsePublicLeadBody
    }>(SUBJECT)
}

const failureOf = (action: () => unknown): unknown => {
    try {
        action()
    } catch (cause) {
        return cause
    }
    throw new PublicApiError({ code: PublicApiErrorCode.RequestInvalid, params: { field: "expectedFailure" } })
}

describe("public-api-job policy / delivery identities", () => {
    it("retains the ledger request and workspace identities", async () => {
        const subject = await build()
        expect(subject.parsePublicApiJob({ workspaceId: WS, requestId: REQUEST })).toEqual({
            format: "ledger",
            workspaceId: WS,
            requestId: REQUEST,
        })
    })

    it("reuses historical inbound and knowledge identities", async () => {
        const subject = await build()
        expect(subject.parsePublicApiJob(LEGACY_LEAD)).toEqual({
            format: "lead",
            workspaceId: WS,
            identity: REQUEST,
            body: {
                inboundEventId: REQUEST,
                keyName: "n8n",
                company: "ACME",
                stage: "qualified",
                note: "Call later",
            },
        })
        expect(subject.parsePublicApiJob({ kind: "knowledge", workspaceId: WS, sourceId: REQUEST })).toEqual({
            format: "knowledge",
            workspaceId: WS,
            identity: REQUEST,
            sourceId: REQUEST,
        })
    })

    it("retains historical message work dedupe and derives the API actor", async () => {
        const subject = await build()
        expect(subject.parsePublicApiJob(LEGACY_MESSAGE)).toEqual({
            format: "message",
            workspaceId: WS,
            identity: LEGACY_MESSAGE.dedupeKey,
            dedupeKey: LEGACY_MESSAGE.dedupeKey,
            body: MESSAGE,
        })
    })

    it("retains a recovered original legacy channel without defaulting or rewriting it", async () => {
        const subject = await build()
        expect(subject.parsePublicApiJob({ ...LEGACY_LEAD, channel: " Campaign landing page " })).toMatchObject({
            format: "lead",
            body: { channel: " Campaign landing page " },
        })
    })
})

describe("public-api-job policy / invalid delivery identities", () => {
    it.each([
        [null, "payload"],
        ["text", "payload"],
        [{}, "workspaceId"],
        [{ workspaceId: "invalid" }, "workspaceId"],
        [{ workspaceId: WS, requestId: "" }, "requestId"],
        [{ workspaceId: WS, requestId: 1 }, "requestId"],
        [{ workspaceId: WS, kind: "unknown" }, "kind"],
        [{ ...LEGACY_LEAD, inboundEventId: "invalid" }, "inboundEventId"],
        [{ ...LEGACY_LEAD, keyName: 1 }, "keyName"],
        [{ ...LEGACY_LEAD, channel: 1 }, "channel"],
        [{ ...LEGACY_LEAD, channel: null }, "channel"],
        [{ ...LEGACY_LEAD, channel: "" }, "channel"],
        [{ ...LEGACY_LEAD, channel: "  " }, "channel"],
        [{ ...LEGACY_LEAD, stage: "other" }, "stage"],
        [{ ...LEGACY_MESSAGE, dedupeKey: 1 }, "dedupeKey"],
        [{ ...LEGACY_MESSAGE, dedupeKey: "  " }, "dedupeKey"],
        [{ ...LEGACY_MESSAGE, conversationId: "invalid" }, "conversationId"],
        [{ ...LEGACY_MESSAGE, leadId: "invalid" }, "leadId"],
        [{ ...LEGACY_MESSAGE, text: 1 }, "text"],
        [{ ...LEGACY_MESSAGE, requireApproval: "true" }, "requireApproval"],
        [{ kind: "knowledge", workspaceId: WS, sourceId: "invalid" }, "sourceId"],
    ])("refuses an unsupported or incomplete delivery without inventing its %s", async (payload, field) => {
        const subject = await build()
        expect(failureOf(() => subject.parsePublicApiJob(payload))).toMatchObject({
            code: PublicApiErrorCode.RequestInvalid,
            params: { field },
        })
    })
})

describe("public-api-job policy / ledger bodies", () => {
    it("preserves old lead bodies and reads a supplied contact and stage", async () => {
        const subject = await build()
        expect(subject.parsePublicApiBody("lead", LEAD, null)).toEqual({ kind: "lead", body: LEAD })
        expect(subject.parsePublicLeadBody(LEAD, null)).toEqual(LEAD)
        const body = { ...LEAD, contact: "mai@example.test", stage: "won", needSupplied: false }
        expect(subject.parsePublicApiBody("lead", body, null)).toEqual({ kind: "lead", body })
    })

    it("uses the presence flag, including false, independently of the recorded need text", async () => {
        const subject = await build()
        expect(subject.parsePublicApiBody("lead", { ...LEAD, needSupplied: true }, null)).toEqual({
            kind: "lead",
            body: { ...LEAD, needSupplied: true },
        })
        expect(subject.parsePublicApiBody("lead", { ...LEAD, needSupplied: false }, true)).toEqual({
            kind: "lead",
            body: { ...LEAD, needSupplied: true },
        })
        expect(subject.parsePublicApiBody("lead", { ...LEAD, needSupplied: true }, false)).toEqual({
            kind: "lead",
            body: { ...LEAD, needSupplied: false },
        })
    })

    it("retains the exact message with or without a linked lead", async () => {
        const subject = await build()
        expect(subject.parsePublicApiBody("message", MESSAGE, null)).toEqual({ kind: "message", body: MESSAGE })
        const body = { ...MESSAGE, leadId: LEAD_ID, requireApproval: true }
        expect(subject.parsePublicApiBody("message", body, null)).toEqual({ kind: "message", body })
    })

    it("retains knowledge text, tags, visibility and optional topic", async () => {
        const subject = await build()
        expect(subject.parsePublicApiBody("knowledge", KNOWLEDGE, null)).toEqual({
            kind: "knowledge",
            body: KNOWLEDGE,
        })
        const body = { ...KNOWLEDGE, topic: "Support", tags: [], visibility: "public" }
        expect(subject.parsePublicApiBody("knowledge", body, null)).toEqual({ kind: "knowledge", body })
    })

    it.each([
        ["lead", null, "payload"],
        ["other", {}, "kind"],
        ["lead", { ...LEAD, name: 1 }, "name"],
        ["lead", { ...LEAD, contact: 1 }, "contact"],
        ["lead", { ...LEAD, need: 1 }, "need"],
        ["lead", { ...LEAD, channel: 1 }, "channel"],
        ["lead", { ...LEAD, company: 1 }, "company"],
        ["lead", { ...LEAD, note: 1 }, "note"],
        ["lead", { ...LEAD, externalId: 1 }, "externalId"],
        ["lead", { ...LEAD, source: 1 }, "source"],
        ["lead", { ...LEAD, needSupplied: "true" }, "needSupplied"],
        ["knowledge", { ...KNOWLEDGE, visibility: "private" }, "visibility"],
        ["knowledge", { ...KNOWLEDGE, title: 1 }, "title"],
        ["knowledge", { ...KNOWLEDGE, content: 1 }, "content"],
        ["knowledge", { ...KNOWLEDGE, topic: 1 }, "topic"],
        ["knowledge", { ...KNOWLEDGE, tags: "api" }, "tags"],
        ["knowledge", { ...KNOWLEDGE, tags: [1] }, "tags"],
    ] as const)("refuses invalid %s ledger data at its %s", async (kind, payload, field) => {
        const subject = await build()
        expect(failureOf(() => subject.parsePublicApiBody(kind, payload, null))).toMatchObject({
            code: PublicApiErrorCode.RequestInvalid,
            params: { field },
        })
    })
})
