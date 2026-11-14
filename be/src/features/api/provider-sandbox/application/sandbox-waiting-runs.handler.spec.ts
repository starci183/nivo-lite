import { mock } from "@starci/jest-preset"
import type { ParkedWait, ThreadWaitExpiryService } from "@modules/domain/agent-threads"
import type { AgentDirectoryService } from "@modules/domain/agents"
import type { ContactsService } from "@modules/domain/contacts"
import type { ProviderSandboxAccountsService } from "@modules/domain/provider-sandbox"
import type { Logger } from "@modules/platform/logging"
import { SandboxWaitingRunsQuery } from "./provider-sandbox.queries"
import { SandboxWaitingRunsHandler } from "./sandbox-waiting-runs.handler"

/** One parked run with the given context. */
const parkedOf = (runId: string, agentId: string, context: Record<string, unknown>, verbs: ReadonlyArray<string> = ["customer.message"]): ParkedWait => ({
    runId,
    agentId,
    context,
    parkKey: `park-${runId}`,
    dueAt: "2026-11-14T10:00:00.000Z",
    waitsFor: verbs.map((verb, at) => ({ key: `k${at}`, verb })),
})

/** The handler over mocked doors. */
const handlerOf = (parked: ReadonlyArray<ParkedWait>) => {
    const accounts = mock<ProviderSandboxAccountsService>()
    const expiry = mock<ThreadWaitExpiryService>()
    const agents = mock<AgentDirectoryService>()
    const contacts = mock<ContactsService>()
    accounts.assertManager.mockResolvedValue(undefined)
    expiry.parked.mockResolvedValue(parked)
    agents.cardsOf.mockResolvedValue([{ id: "agent-1", name: "Sales agent", module: "sales" }])
    contacts.get.mockResolvedValue(null)
    return { accounts, expiry, agents, contacts, handler: new SandboxWaitingRunsHandler(mock<Logger>(), accounts, expiry, agents, contacts) }
}

/** The query of one read. */
const readOf = (limit?: number) =>
    new SandboxWaitingRunsQuery({ request: { workspaceId: "ws-1", limit }, principal: { id: "user-1", role: "authenticated" } })

describe("SandboxWaitingRunsHandler", () => {
    it("checks the gate first and refuses before the engine is read", async () => {
        const { accounts, expiry, handler } = handlerOf([])
        accounts.assertManager.mockRejectedValue({ code: "PROVIDER_SANDBOX_OFF" })

        await expect(handler.execute(readOf())).rejects.toMatchObject({ code: "PROVIDER_SANDBOX_OFF" })
        expect(accounts.assertManager).toHaveBeenCalledWith({ principalId: "user-1", workspaceId: "ws-1" })
        expect(expiry.parked).not.toHaveBeenCalled()
    })

    it.each([
        [undefined, 20],
        [5, 5],
        [500, 50],
        [0, 1],
    ])("asks the engine for %p as %p runs", async (asked, listed) => {
        const { expiry, handler } = handlerOf([])

        await handler.execute(readOf(asked))

        expect(expiry.parked).toHaveBeenCalledWith("ws-1", listed)
    })

    it("labels the agent from one batch read and the person from the contact's display name", async () => {
        const { agents, contacts, handler } = handlerOf([
            parkedOf("run-1", "agent-1", { contactId: "contact-1", conversationId: "conv-1" }),
            parkedOf("run-2", "agent-1", { contactId: "contact-1", routeId: "route-2" }),
        ])
        contacts.get.mockResolvedValue({ id: "contact-1", displayName: "Lan" } as never)

        const rows = await handler.execute(readOf())

        expect(agents.cardsOf).toHaveBeenCalledTimes(1)
        expect(agents.cardsOf).toHaveBeenCalledWith("ws-1", ["agent-1"])
        expect(contacts.get).toHaveBeenCalledTimes(1)
        expect(rows.map((row) => [row.agentLabel, row.personLabel, row.routeId])).toEqual([
            ["Sales agent", "Lan", "conv-1"],
            ["Sales agent", "Lan", "route-2"],
        ])
    })

    it("falls back: agent id, contact id, then the conversation or route, then an empty text", async () => {
        const { handler } = handlerOf([
            parkedOf("run-1", "agent-9", { contactId: "contact-1" }),
            parkedOf("run-2", "agent-9", { conversationId: "conv-2" }),
            parkedOf("run-3", "agent-9", { routeId: "route-3", conversationId: "conv-3" }),
            parkedOf("run-4", "agent-9", {}),
        ])

        const rows = await handler.execute(readOf())

        expect(rows.map((row) => [row.agentLabel, row.personLabel, row.routeId])).toEqual([
            ["agent-9", "contact-1", null],
            ["agent-9", "conv-2", "conv-2"],
            ["agent-9", "route-3", "route-3"],
            ["agent-9", "", null],
        ])
    })

    it("lists each wait's verbs once, in order, and carries the park and its time", async () => {
        const { handler } = handlerOf([parkedOf("run-1", "agent-1", {}, ["customer.message", "money.received", "customer.message"])])

        const [row] = await handler.execute(readOf())

        expect(row).toMatchObject({
            runId: "run-1",
            agentId: "agent-1",
            waitsFor: ["customer.message", "money.received"],
            parkKey: "park-run-1",
            dueAt: "2026-11-14T10:00:00.000Z",
        })
    })
})
