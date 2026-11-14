import { readFileSync } from "node:fs"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { OPENAPI_CALL_OPERATION, OPENAPI_SANDBOX_CASE, OPENAPI_SANDBOX_CATALOGUE } from "./openapi-sandbox.catalogue"
import type { OpenApiReachAccount, OpenApiReachCall } from "./openapi-reach.contracts"
import { OpenApiSandboxFixturesRegistryService } from "./openapi-sandbox-fixtures-registry.service"
import { OPENAPI_SANDBOX_KEY_VALUE, OpenApiSandboxReachService } from "./openapi-sandbox-reach.service"

const BASE = sandboxAccount({ id: "conn-api", workspaceId: "ws-1", provider: "openapi" })
const ACCOUNT: OpenApiReachAccount = { ...BASE, connector: "crm.sample" }
const LIVE: OpenApiReachAccount = { ...ACCOUNT, id: "conn-live", sandbox: false }
const AUTH = { baseUrl: "https://api.sample.test", authType: "bearer" as const, authName: "" }

/** Package-shipped fixtures of a sample system, in the package's own words (the engine reads them as data). */
const fixtures = () => {
    const registry = new OpenApiSandboxFixturesRegistryService()
    registry.register({
        connector: "crm.sample",
        operations: {
            createThing: { status: 201, body: { status: "open" }, keeps: { collection: "things", keyField: "id" } },
            getThing: { status: 200, body: { id: "none", status: "unknown" }, readsBack: { collection: "things", keyParam: "id" } },
            listThings: { status: 200, body: { items: [{ id: "T-0", status: "open" }] }, listsBack: { collection: "things", listField: "items" } },
            priceList: { status: 200, body: [{ code: "P1", price: 100 }] },
        },
    })
    return registry
}

const callOf = (operationId: string, input: Readonly<Record<string, unknown>> = {}): OpenApiReachCall => ({
    baseUrl: AUTH.baseUrl,
    operationId,
    method: "GET",
    path: "/x",
    params: [],
    hasBody: input.body !== undefined,
    input,
    key: null,
    maxBytes: 1000,
})

const setup = () => {
    const { sandbox, store } = sandboxServiceOf(ACCOUNT)
    return { sandbox, store, service: new OpenApiSandboxReachService(sandbox, fixtures()) }
}

const bodyOf = (text: string): unknown => JSON.parse(text)

describe("OpenApiSandboxReachService", () => {
    it("OPENAPI-1 (default): answers a plain operation from the package's fixture", async () => {
        const { service } = setup()
        const answer = await service.call(ACCOUNT, callOf("priceList"))
        expect(answer.status).toBe(200)
        expect(bodyOf(answer.text)).toEqual([{ code: "P1", price: 100 }])
    })

    it("OPENAPI-1: a write that keeps its answer is read back by id and listed after the fixture's rows", async () => {
        const { service } = setup()
        const created = await service.call(ACCOUNT, callOf("createThing", { body: { name: "First" } }))
        expect(created.status).toBe(201)
        expect(bodyOf(created.text)).toEqual({ status: "open", name: "First", id: "sbx-1" })
        const named = await service.call(ACCOUNT, callOf("createThing", { body: { id: "T-9", name: "Named" } }))
        expect(bodyOf(named.text)).toEqual({ status: "open", id: "T-9", name: "Named" })

        expect(bodyOf((await service.call(ACCOUNT, callOf("getThing", { id: "sbx-1" }))).text)).toEqual({ status: "open", name: "First", id: "sbx-1" })
        expect(bodyOf((await service.call(ACCOUNT, callOf("getThing", { id: "nobody" }))).text)).toEqual({ id: "none", status: "unknown" })
        expect(bodyOf((await service.call(ACCOUNT, callOf("listThings"))).text)).toEqual({
            items: [
                { id: "T-0", status: "open" },
                { status: "open", name: "First", id: "sbx-1" },
                { status: "open", id: "T-9", name: "Named" },
            ],
        })
    })

    it("refuses an operation the package shipped no fixture for, naming the gap", async () => {
        const { service } = setup()
        await expect(service.call(ACCOUNT, callOf("deleteEverything"))).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.CaseUnknown,
            params: { caseId: "crm.sample:deleteEverything" },
        })
    })

    it("OPENAPI-2: the system refuses (422) and nothing is kept; sticky until the default is picked again", async () => {
        const { service, sandbox } = setup()
        await sandbox.setNextCase(ACCOUNT, OPENAPI_CALL_OPERATION, OPENAPI_SANDBOX_CASE.refused)
        expect((await service.call(ACCOUNT, callOf("createThing", { body: { id: "T-1" } }))).status).toBe(422)
        expect((await service.call(ACCOUNT, callOf("priceList"))).status).toBe(422)
        await sandbox.setNextCase(ACCOUNT, OPENAPI_CALL_OPERATION, OPENAPI_SANDBOX_CASE.answered)
        expect(bodyOf((await service.call(ACCOUNT, callOf("getThing", { id: "T-1" }))).text)).toEqual({ id: "none", status: "unknown" })
    })

    it("OPENAPI-3: the system fails (503) and nothing is kept", async () => {
        const { service, sandbox } = setup()
        await sandbox.setNextCase(ACCOUNT, OPENAPI_CALL_OPERATION, OPENAPI_SANDBOX_CASE.failed)
        expect((await service.call(ACCOUNT, callOf("createThing", { body: { id: "T-2" } }))).status).toBe(503)
        await sandbox.setNextCase(ACCOUNT, OPENAPI_CALL_OPERATION, OPENAPI_SANDBOX_CASE.answered)
        expect(bodyOf((await service.call(ACCOUNT, callOf("getThing", { id: "T-2" }))).text)).toEqual({ id: "none", status: "unknown" })
    })

    it("OPENAPI-4: the write is applied but its answer is lost (504); a later read sees it", async () => {
        const { service, sandbox } = setup()
        await sandbox.setNextCase(ACCOUNT, OPENAPI_CALL_OPERATION, OPENAPI_SANDBOX_CASE.timedOut)
        expect((await service.call(ACCOUNT, callOf("createThing", { body: { id: "T-3" } }))).status).toBe(504)
        await sandbox.setNextCase(ACCOUNT, OPENAPI_CALL_OPERATION, OPENAPI_SANDBOX_CASE.answered)
        expect(bodyOf((await service.call(ACCOUNT, callOf("getThing", { id: "T-3" }))).text)).toEqual({ status: "open", id: "T-3" })
    })

    it("logs ONE call per request, keyed by the operation id, with the request", async () => {
        const { service, sandbox } = setup()
        await service.call(ACCOUNT, callOf("priceList", { q: "a" }))
        await service.call(ACCOUNT, callOf("getThing", { id: "x" }))
        const calls = await sandbox.calls(ACCOUNT, OPENAPI_CALL_OPERATION)
        expect(calls.map((one) => one.key)).toEqual(["priceList", "getThing"])
        expect(calls[0]?.request).toMatchObject({ connector: "crm.sample", operationId: "priceList", input: { q: "a" } })
    })

    it("is deterministic: two fresh accounts answer the same calls identically", async () => {
        const run = async () => {
            const { service } = setup()
            const one = await service.call(ACCOUNT, callOf("createThing", { body: { name: "A" } }))
            const two = await service.call(ACCOUNT, callOf("listThings"))
            return [one, two]
        }
        expect(await run()).toEqual(await run())
    })

    it("reaches no host, holds no secret and reads no live document", async () => {
        const { service } = setup()
        await expect(service.reachable(ACCOUNT, AUTH)).resolves.toBeUndefined()
        await expect(service.keyOf(ACCOUNT, AUTH)).resolves.toEqual({ type: "bearer", name: "", value: OPENAPI_SANDBOX_KEY_VALUE })
        await expect(service.liveDocument(ACCOUNT, "https://api.sample.test/openapi.json")).resolves.toBeNull()
    })

    it("refuses a live account on every member", async () => {
        const { service } = setup()
        const refused = { code: ProviderSandboxErrorCode.LiveAccount }
        await expect(service.call(LIVE, callOf("priceList"))).rejects.toMatchObject(refused)
        await expect(service.reachable(LIVE, AUTH)).rejects.toMatchObject(refused)
        await expect(service.keyOf(LIVE, AUTH)).rejects.toMatchObject(refused)
        await expect(service.liveDocument(LIVE, "u")).rejects.toMatchObject(refused)
    })

    it("refuses everything with the switch off", async () => {
        const { sandbox } = sandboxServiceOff(ACCOUNT)
        const service = new OpenApiSandboxReachService(sandbox, fixtures())
        await expect(service.call(ACCOUNT, callOf("priceList"))).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
        await expect(service.keyOf(ACCOUNT, AUTH)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has a catalogue of OPENAPI-<n> ids, unique, with exactly one default of `call`", () => {
        const ids = OPENAPI_SANDBOX_CATALOGUE.cases.map((one) => one.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((id) => /^OPENAPI-\d+$/u.test(id))).toBe(true)
        expect(OPENAPI_SANDBOX_CATALOGUE.cases.filter((one) => one.default === true).map((one) => one.operation)).toEqual([OPENAPI_CALL_OPERATION])
    })

    it("calls no network: no integration client in its source, only the sandbox frame and the fixtures", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toMatch(/\bhttp\b/iu)
        expect(OpenApiSandboxReachService.length).toBe(2)
    })
})
