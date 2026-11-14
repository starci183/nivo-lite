import { OpenApiConnectorService } from "./openapi-native.service"
import {
    WORKSPACE,
    ACCOUNT,
    CALLER,
    CUSTOMER,
    CRM,
    declared,
    source,
    SOURCES,
    build,
    refusal,
    RUN,
} from "@tests/fixtures/builders/openapi-native.builder"

describe("OpenApiConnectorService customer audience", () => {
    // The runner hands an operation of a pinned document ONE account (an agent call with none handed is refused: ARCH-REVIEW S7).
    const TALKING = { agentId: "agent-1", conversationId: "conversation-1", opKey: "run-1:step-1", connectionId: ACCOUNT }

    /** A connector whose conversation is linked to the given customer, or to nobody. */
    const linked = (customer: string | null) => {
        const built = build()
        const customerOf = jest.fn().mockResolvedValue(customer)
        const connector = new OpenApiConnectorService(CRM, SOURCES, { ...built.ports, customerLinks: { customerOf } })
        return { ...built, connector, customerOf }
    }

    it("reads only the customer the conversation is linked to, filled by the provider, never by the caller", async () => {
        const { connector, call, customerOf } = linked("ACME")

        await connector.invoke(WORKSPACE, "get.customers.code", { code: "ACME" }, TALKING)

        expect(customerOf).toHaveBeenCalledWith(WORKSPACE, "conversation-1", ACCOUNT)
        expect(call.mock.calls[0]?.[0].input).toEqual({ "X-Workspace-Id": WORKSPACE, code: "ACME" })
    })

    it("refuses another customer's code, and every customer read while nobody linked the conversation", async () => {
        const other = linked("ACME")
        const none = linked(null)
        const unbound = build()

        await expect(other.connector.invoke(WORKSPACE, "get.customers.code", { code: "BETA" }, TALKING)).rejects.toMatchObject(refusal("other_customer"))
        await expect(none.connector.invoke(WORKSPACE, "get.customers.code", { code: "ACME" }, TALKING)).rejects.toMatchObject(refusal("customer_not_linked"))
        await expect(unbound.connector.invoke(WORKSPACE, "get.customers.code", { code: "ACME" }, TALKING)).rejects.toMatchObject(refusal("customer_not_linked"))
        expect(other.call).not.toHaveBeenCalled()
        expect(none.call).not.toHaveBeenCalled()
    })

    it("refuses an operation the document does not open to customers, and a run that acts for a customer without a conversation", async () => {
        const { connector, call } = linked("ACME")
        const acting = { agentId: "agent-1", conversationId: null, connectionId: ACCOUNT, run: { ...RUN, origin: "customer" as const } }

        await expect(connector.invoke(WORKSPACE, "get.customers", { q: "an" }, TALKING)).rejects.toMatchObject(refusal("internal_only"))
        await expect(connector.invoke(WORKSPACE, "get.customers.code", { code: "ACME" }, acting)).rejects.toMatchObject(refusal("customer_not_linked"))
        expect(call).not.toHaveBeenCalled()
    })

    it("leaves an internal run and a person's workbench read as they were", async () => {
        const { connector, call, customerOf } = linked(null)
        call.mockResolvedValue({ status: 200, headers: {}, text: JSON.stringify({ items: [CUSTOMER], nextCursor: null }) })

        await expect(connector.invoke(WORKSPACE, "get.customers", { q: "an" }, CALLER)).resolves.toMatchObject({ ok: true })
        await expect(connector.viewerRead(WORKSPACE, "nivo.api.crm.nivoweb.get.customers", { q: "an" })).resolves.toMatchObject({ ok: true })
        expect(customerOf).not.toHaveBeenCalled()
    })
})

describe("OpenApiConnectorService customer audience: the five cases of the guard", () => {
    // The runner hands a single-account operation its account (an agent call with none handed is refused: ARCH-REVIEW S7).
    const TALKING = { agentId: "agent-1", conversationId: "conversation-1", opKey: "run-1:step-1", connectionId: ACCOUNT }
    const EXPIRING = source(
        declared("get.services.expiring", true),
        { withinDays: "integer", includeExpired: "boolean", limit: "integer", cursor: "string" },
        ["withinDays", "includeExpired", "limit", "cursor"],
        "Lists services about to expire.",
    )
    const PAGE = { items: [{ code: "SVC-1", customerCode: "ACME", expiresOn: "2026-12-01" }], nextCursor: null }

    /** A connector that also declares the operation opened to customers with no customer parameter, linked to the customer given. */
    const linked = (customer: string | null) => {
        const built = build()
        const customerOf = jest.fn().mockResolvedValue(customer)
        const connector = new OpenApiConnectorService(CRM, [...SOURCES, EXPIRING], { ...built.ports, customerLinks: { customerOf } })
        return { ...built, connector, customerOf }
    }

    it("marked, with a customer parameter, linked: the parameter is bound to the link on the serving account, also when the caller leaves it out", async () => {
        const { connector, call, customerOf } = linked("ACME")
        const lenient = new OpenApiConnectorService(
            CRM,
            [source(declared("get.customers.code", true), { code: "string" }, ["code"], "Reads one customer.")],
            { ...build().ports, customerLinks: { customerOf } },
        )

        await connector.invoke(WORKSPACE, "get.customers.code", { code: "ACME" }, TALKING)
        expect(customerOf).toHaveBeenCalledWith(WORKSPACE, "conversation-1", ACCOUNT)
        expect(call.mock.calls[0]?.[0].input).toEqual({ "X-Workspace-Id": WORKSPACE, code: "ACME" })

        await expect(lenient.invoke(WORKSPACE, "get.customers.code", {}, TALKING)).resolves.toMatchObject({ ok: true })
    })

    it("marked, with a customer parameter, unlinked: customer_not_linked, and nothing is sent", async () => {
        const { connector, call } = linked(null)

        await expect(connector.invoke(WORKSPACE, "get.customers.code", { code: "ACME" }, TALKING)).rejects.toMatchObject(
            refusal("customer_not_linked"),
        )
        expect(call).not.toHaveBeenCalled()
    })

    it("marked, with no customer parameter: allowed in a conversation run with no link and no code, and the link is not even read", async () => {
        const { connector, call, customerOf } = linked(null)
        call.mockResolvedValue({ status: 200, headers: {}, text: JSON.stringify(PAGE) })

        await expect(connector.invoke(WORKSPACE, "get.services.expiring", { withinDays: 30 }, TALKING)).resolves.toMatchObject({ ok: true })

        expect(customerOf).not.toHaveBeenCalled()
        expect(call.mock.calls[0]?.[0].input).toEqual({ "X-Workspace-Id": WORKSPACE, withinDays: 30 })
    })

    it("unmarked: internal_only in a conversation run, linked or not", async () => {
        const { connector, call, customerOf } = linked("ACME")

        await expect(connector.invoke(WORKSPACE, "get.customers", { q: "an" }, TALKING)).rejects.toMatchObject(refusal("internal_only"))

        expect(customerOf).not.toHaveBeenCalled()
        expect(call).not.toHaveBeenCalled()
    })

    it("another value given for the customer parameter: other_customer, and nothing is sent", async () => {
        const { connector, call } = linked("ACME")

        await expect(connector.invoke(WORKSPACE, "get.customers.code", { code: "BETA" }, TALKING)).rejects.toMatchObject(
            refusal("other_customer"),
        )
        expect(call).not.toHaveBeenCalled()
    })
})
