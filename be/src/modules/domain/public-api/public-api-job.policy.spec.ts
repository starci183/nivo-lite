import { Test } from "@nestjs/testing"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import { parsePublicApiBody, parsePublicApiJob } from "./public-api-job.policy"

const SUBJECT = Symbol("public-api-job.policy")
const WS = "11111111-1111-1111-1111-111111111111"
const REQUEST = "22222222-2222-2222-2222-222222222222"
const CONVERSATION = "33333333-3333-3333-3333-333333333333"

const MESSAGE = {
    conversationId: CONVERSATION,
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
const LEGACY_MESSAGE = {
    ...MESSAGE,
    kind: "message",
    workspaceId: WS,
    keyName: "n8n",
    dedupeKey: "api.message:original",
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parsePublicApiBody, parsePublicApiJob } }],
    }).compile()
    return moduleRef.get<{
        parsePublicApiBody: typeof parsePublicApiBody
        parsePublicApiJob: typeof parsePublicApiJob
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

    it("reuses the historical knowledge identity", async () => {
        const subject = await build()
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
        [{ workspaceId: WS, kind: "lead" }, "kind"],
        [{ ...LEGACY_MESSAGE, dedupeKey: 1 }, "dedupeKey"],
        [{ ...LEGACY_MESSAGE, dedupeKey: "  " }, "dedupeKey"],
        [{ ...LEGACY_MESSAGE, conversationId: "invalid" }, "conversationId"],
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
    it("retains the exact message, with or without approval forced", async () => {
        const subject = await build()
        expect(subject.parsePublicApiBody("message", MESSAGE)).toEqual({ kind: "message", body: MESSAGE })
        const body = { ...MESSAGE, requireApproval: true }
        expect(subject.parsePublicApiBody("message", body)).toEqual({ kind: "message", body })
    })

    it("retains knowledge text, tags, visibility and optional topic", async () => {
        const subject = await build()
        expect(subject.parsePublicApiBody("knowledge", KNOWLEDGE)).toEqual({
            kind: "knowledge",
            body: KNOWLEDGE,
        })
        const body = { ...KNOWLEDGE, topic: "Support", tags: [] }
        expect(subject.parsePublicApiBody("knowledge", body)).toEqual({ kind: "knowledge", body })
    })

    it("reads a knowledge row an older version stored as public as internal", async () => {
        const subject = await build()
        const parsed = subject.parsePublicApiBody("knowledge", { ...KNOWLEDGE, visibility: "public" })
        expect(parsed).toEqual({ kind: "knowledge", body: { ...KNOWLEDGE, visibility: "internal" } })
    })

    it.each([
        ["message", null, "payload"],
        ["other", {}, "kind"],
        ["lead", {}, "kind"],
        ["knowledge", { ...KNOWLEDGE, visibility: "private" }, "visibility"],
        ["knowledge", { ...KNOWLEDGE, title: 1 }, "title"],
        ["knowledge", { ...KNOWLEDGE, content: 1 }, "content"],
        ["knowledge", { ...KNOWLEDGE, topic: 1 }, "topic"],
        ["knowledge", { ...KNOWLEDGE, tags: "api" }, "tags"],
        ["knowledge", { ...KNOWLEDGE, tags: [1] }, "tags"],
    ] as const)("refuses invalid %s ledger data at its %s", async (kind, payload, field) => {
        const subject = await build()
        expect(failureOf(() => subject.parsePublicApiBody(kind, payload))).toMatchObject({
            code: PublicApiErrorCode.RequestInvalid,
            params: { field },
        })
    })
})
