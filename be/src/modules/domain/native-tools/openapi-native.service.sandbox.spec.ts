import { OpenApiReachRegistryService, OpenApiSandboxFixturesRegistryService, OpenApiSandboxReachService, OPENAPI_CALL_OPERATION } from "@modules/domain/openapi-provider"
import { ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import { sandboxAccount, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { ACCOUNT, CALLER, CRM, CUSTOMER, SOURCES, WORKSPACE, build, metaOf } from "@tests/fixtures/builders/openapi-native.builder"
import { OpenApiLiveReach } from "./openapi-live-reach.service"
import { OpenApiConnectorService } from "./openapi-native.service"

/** The connector's tool reading one customer (operation id `customer.get` of the sample document). */
const GET_CUSTOMER = "get.customers.code"

/** A world whose one account is a SANDBOX account, reached through the registry (live: this app's client; sandbox: the fixtures). */
const sandboxWorld = (withRegistry = true) => {
    const world = build()
    const { sandbox } = sandboxServiceOf(sandboxAccount({ id: ACCOUNT, workspaceId: WORKSPACE, provider: "openapi" }))
    const fixtures = new OpenApiSandboxFixturesRegistryService()
    fixtures.register({ connector: CRM, operations: { "customer.get": { status: 200, body: CUSTOMER } } })
    const reaches = new OpenApiReachRegistryService()
    reaches.register({
        live: new OpenApiLiveReach(world.ports.secrets, world.ports.client, world.ports.host),
        sandbox: new OpenApiSandboxReachService(sandbox, fixtures),
    })
    const ports = {
        ...world.ports,
        bindings: { ...world.ports.bindings, recordOf: jest.fn().mockResolvedValue({ meta: metaOf(), sandbox: true }) },
        ...(withRegistry ? { reaches } : {}),
    }
    return { ...world, sandbox, connector: new OpenApiConnectorService(CRM, SOURCES, ports) }
}

describe("OpenApiConnectorService on a sandbox account (lane concept provider-sandbox)", () => {
    it("answers a declared tool from the package's fixtures, checked against the pinned document like a live answer, and reaches nothing live", async () => {
        const { connector, call, fetchSpec, secretOf, resolve, sandbox } = sandboxWorld()

        const answer = await connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)

        expect(answer).toMatchObject({ ok: true, status: 200, data: CUSTOMER })
        expect(call).not.toHaveBeenCalled()
        expect(fetchSpec).not.toHaveBeenCalled()
        expect(secretOf).not.toHaveBeenCalled()
        expect(resolve).not.toHaveBeenCalled()
        const logged = await sandbox.calls(sandboxAccount({ id: ACCOUNT, workspaceId: WORKSPACE, provider: "openapi" }), OPENAPI_CALL_OPERATION)
        expect(logged.map((one) => one.key)).toEqual(["customer.get"])
    })

    it("never reaches a sandbox account live when no registry is composed: PROVIDER_SANDBOX_MISSING, nothing sent", async () => {
        const { connector, call, secretOf } = sandboxWorld(false)

        await expect(connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).rejects.toMatchObject({
            code: ProviderRegistryErrorCode.SandboxMissing,
        })
        expect(call).not.toHaveBeenCalled()
        expect(secretOf).not.toHaveBeenCalled()
    })

    it("still reaches a LIVE account through the registry's live reach exactly as before", async () => {
        const world = build()
        const reaches = new OpenApiReachRegistryService()
        const { sandbox } = sandboxServiceOf()
        reaches.register({
            live: new OpenApiLiveReach(world.ports.secrets, world.ports.client, world.ports.host),
            sandbox: new OpenApiSandboxReachService(sandbox, new OpenApiSandboxFixturesRegistryService()),
        })
        const connector = new OpenApiConnectorService(CRM, SOURCES, { ...world.ports, reaches })
        world.call.mockResolvedValue({ status: 200, headers: {}, text: JSON.stringify(CUSTOMER) })

        await expect(connector.invoke(WORKSPACE, GET_CUSTOMER, { code: "ACME" }, CALLER)).resolves.toMatchObject({ ok: true, data: CUSTOMER })
        expect(world.secretOf).toHaveBeenCalledWith(ACCOUNT, "openapi")
        expect(world.call).toHaveBeenCalledTimes(1)
    })
})
