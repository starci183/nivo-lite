import { Test } from "@nestjs/testing"
import fixture from "./openapi-document.policy.fixtures.json"
import { readDocument } from "./openapi-document.policy"
import { argumentsSchemaOf, baseUrlProblemOf, dryRunPlaceOf, replayKeyOf, plannedRequestOf, resolvedProblemOf } from "./openapi-request.policy"
import type { CallIdentity, PinnedOperation, PlannedRequest, SchemaNode, ToolsAccountFacts } from "./openapi-tools.contracts"

const SUBJECT = Symbol("openapi-request.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { argumentsSchemaOf, baseUrlProblemOf, dryRunPlaceOf, replayKeyOf, plannedRequestOf, resolvedProblemOf } }],
    }).compile()
    return moduleRef.get<typeof import("./openapi-request.policy")>(SUBJECT)
}

type Subject = Awaited<ReturnType<typeof build>>

const reading = readDocument(JSON.stringify(fixture), "crm.nivoweb")
const SECURITY = reading.ok ? reading.document.securityHeaders : []
/** What a helper answers for an operation the fixture does not hold: nothing can be called on it. */
const MISSING: PinnedOperation = { toolId: "nivo.api.crm.nivoweb.get.missing", apiVerb: "nivo.api.crm.nivoweb.get.missing", purpose: false, operationId: "missing", method: "GET", path: "/", parameters: [], body: null, responses: {}, customerAudience: false, customerParameter: null, effect: null, unsupported: ["missing"] }
/** The operation of the fixture by the document's own operation id (the index is by tool id). */
const operationOf = (id: string): PinnedOperation =>
    (reading.ok ? [...reading.document.operations.values()].find((operation) => operation.operationId === id) : undefined) ?? MISSING

const TEST: ToolsAccountFacts = {
    connector: "crm.nivoweb",
    swaggerUrl: "",
    workspaceHeader: "X-Workspace-Id",
    documentSha256: "0".repeat(64),
    live: false,
    pinnedBy: "member-1",
    pinnedAt: "2026-11-12T00:00:00.000Z",
}
const LIVE: ToolsAccountFacts = { ...TEST, live: true }
const WORKSPACE = "7b0f0a52-1111-4222-8333-444455556666"
const STEP: CallIdentity = { workspaceId: WORKSPACE, tool: "nivo.api.crm.nivoweb.post.services.code.renewals", stepKey: "run-1:renew" }

const planned = (subject: Subject, id: string, account: ToolsAccountFacts, args: Record<string, unknown>, identity = STEP): PlannedRequest => {
    const planning = subject.plannedRequestOf(operationOf(id), account, SECURITY, args, identity)
    return planning.ok ? planning.request : { params: [], input: { problem: planning.problem }, dryRun: null, dryRunForced: false }
}

/** The names of the arguments a schema admits. */
const namesOf = (schema: SchemaNode): ReadonlyArray<string> =>
    typeof schema.properties === "object" && schema.properties !== null ? Object.keys(schema.properties) : []

describe("argumentsSchemaOf", () => {
    it("lists the path, query and body members by name and never the headers the provider fills", async () => {
        const subject = await build()
        const schema = subject.argumentsSchemaOf(operationOf("service.renewal.create"), TEST, SECURITY)

        expect(namesOf(schema)).toEqual(["code", "termMonths", "dryRun"])
        expect(schema.required).toEqual(["code", "termMonths"])
        expect(schema.additionalProperties).toBe(false)
        expect(namesOf(subject.argumentsSchemaOf(operationOf("customer.find"), TEST, SECURITY))).toEqual(["q", "limit", "cursor"])
    })
})

describe("plannedRequestOf", () => {
    it("places the arguments and fills the workspace header with the calling workspace", async () => {
        const subject = await build()
        const request = planned(subject, "customer.find", TEST, { q: "an", limit: 5, cursor: "c2" }, { ...STEP, stepKey: null })

        expect(request.input).toEqual({ "X-Workspace-Id": WORKSPACE, q: "an", limit: 5, cursor: "c2" })
        expect(request.params.map((parameter) => parameter.name)).toEqual(["X-Workspace-Id", "q", "limit", "cursor"])
        expect(request.dryRun).toBeNull()
    })

    it("refuses an argument the operation does not declare, a header the provider owns and a value that does not fit", async () => {
        const subject = await build()
        const operation = operationOf("customer.find")

        expect(subject.plannedRequestOf(operation, TEST, SECURITY, { q: "an", admin: true }, STEP)).toEqual({ ok: false, problem: "admin: not declared" })
        expect(subject.plannedRequestOf(operation, TEST, SECURITY, { q: "an", "X-Workspace-Id": "other" }, STEP)).toEqual({ ok: false, problem: "X-Workspace-Id: not declared" })
        expect(subject.plannedRequestOf(operation, TEST, SECURITY, { q: "an", limit: 500 }, STEP)).toEqual({ ok: false, problem: "limit: maximum" })
        expect(subject.plannedRequestOf(operation, TEST, SECURITY, {}, STEP)).toEqual({ ok: false, problem: "q: required" })
    })

    it("supplies the replay key of a write from the step and refuses a write that has no step", async () => {
        const subject = await build()
        const request = planned(subject, "service.renewal.create", TEST, { code: "ACME-HOST", termMonths: 12 })

        expect(request.input["Idempotency-Key"]).toBe(subject.replayKeyOf(STEP, { code: "ACME-HOST", termMonths: 12 }, true))
        expect(String(request.input["Idempotency-Key"])).toMatch(/^nivo:[0-9a-f]{64}$/u)
        expect(planned(subject, "service.renewal.create", TEST, { code: "ACME-HOST", termMonths: 12 }).input["Idempotency-Key"]).toBe(request.input["Idempotency-Key"])
        expect(planned(subject, "service.renewal.create", TEST, { code: "ACME-HOST", termMonths: 24 }).input["Idempotency-Key"]).not.toBe(request.input["Idempotency-Key"])
        expect(subject.plannedRequestOf(operationOf("service.renewal.create"), TEST, SECURITY, { code: "ACME-HOST", termMonths: 12 }, { ...STEP, stepKey: null })).toEqual({ ok: false, problem: "no step key" })
        expect(subject.plannedRequestOf(operationOf("service.renewal.create"), TEST, SECURITY, { code: "A", termMonths: 12, "Idempotency-Key": "mine" }, STEP)).toEqual({ ok: false, problem: "Idempotency-Key: not declared" })
    })
})

describe("plannedRequestOf dry run", () => {
    it("forces a dry run on an account that is not live, whatever the caller asks", async () => {
        const subject = await build()
        const request = planned(subject, "service.renewal.create", TEST, { code: "ACME-HOST", termMonths: 12, dryRun: false })

        expect(subject.dryRunPlaceOf(operationOf("service.renewal.create"))).toBe("body")
        expect(request.input.body).toEqual({ termMonths: 12, dryRun: true })
        expect(request).toMatchObject({ dryRun: true, dryRunForced: true })
        expect(planned(subject, "service.renewal.create", TEST, { code: "ACME-HOST", termMonths: 12 })).toMatchObject({ dryRun: true, dryRunForced: false })
    })

    it("defaults to a dry run on a live account and acts only on an explicit false, under another replay key", async () => {
        const subject = await build()
        const dry = planned(subject, "service.renewal.create", LIVE, { code: "ACME-HOST", termMonths: 12 })
        const real = planned(subject, "service.renewal.create", LIVE, { code: "ACME-HOST", termMonths: 12, dryRun: false })

        expect(dry.input.body).toEqual({ termMonths: 12, dryRun: true })
        expect(real.input.body).toEqual({ termMonths: 12, dryRun: false })
        expect(real).toMatchObject({ dryRun: false, dryRunForced: false })
        expect(real.input["Idempotency-Key"]).not.toBe(dry.input["Idempotency-Key"])
        expect(planned(subject, "service.reminder.record", LIVE, { code: "ACME-HOST", outcome: "asked" }, STEP).dryRun).toBeNull()
    })
})

describe("baseUrlProblemOf", () => {
    it("admits only https to a public host outside a development site", async () => {
        const subject = await build()
        expect(subject.baseUrlProblemOf("https://crm.example.test/v1", false)).toBeNull()
        expect(subject.baseUrlProblemOf("http://crm.example.test", false)).toBe("https_required")
        expect(subject.baseUrlProblemOf("http://127.0.0.1:3106", false)).toBe("private_host")
        expect(subject.baseUrlProblemOf("https://localhost:3106", false)).toBe("private_host")
        expect(subject.baseUrlProblemOf("https://10.0.0.5", false)).toBe("private_host")
        expect(subject.baseUrlProblemOf("crm", false)).toBe("not_a_url")
    })

    it("admits this machine, and nothing else private, on a development site", async () => {
        const subject = await build()
        expect(subject.baseUrlProblemOf("http://127.0.0.1:3106", true)).toBeNull()
        expect(subject.baseUrlProblemOf("http://localhost:3106", true)).toBeNull()
        expect(subject.baseUrlProblemOf("http://[::1]:3106", true)).toBeNull()
        expect(subject.baseUrlProblemOf("http://192.168.1.20:3106", true)).toBe("https_required")
        expect(subject.baseUrlProblemOf("https://192.168.1.20", true)).toBe("private_host")
        expect(subject.baseUrlProblemOf("https://169.254.169.254", true)).toBe("private_host")
        expect(subject.baseUrlProblemOf("ftp://127.0.0.1", true)).toBe("private_host")
    })

    it("judges the address a name resolved to the same way", async () => {
        const subject = await build()
        expect(subject.resolvedProblemOf("203.0.113.9", false)).toBeNull()
        expect(subject.resolvedProblemOf("127.0.0.1", false)).toBe("private_host")
        expect(subject.resolvedProblemOf("127.0.0.1", true)).toBeNull()
        expect(subject.resolvedProblemOf("10.1.2.3", true)).toBe("private_host")
    })
})
