import { mock } from "@starci/jest-preset"
import type { AgentDirectoryService } from "@modules/domain/agents"
import type { ConnectionGrantsService } from "@modules/domain/connection-grants"
import type { ProviderTriggerState, ProviderTriggerStatesService } from "@modules/domain/provider-triggers"
import { ProviderSandboxError, ProviderSandboxErrorCode, type ProviderSandboxAccountsService } from "@modules/domain/provider-sandbox"
import { ToolsErrorCode, type ToolsConsoleService } from "@modules/domain/tools"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { SandboxAttachmentsService } from "./sandbox-attachments.service"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const SANDBOX = connectionRecord({ id: "c-sbx", provider: "sepay", name: "SePay sandbox", sandbox: true })
const LAN = { id: "a-lan", name: "Lan", module: "sales" }
const MINH = { id: "a-minh", name: "Minh", module: "accounting" }

/** A trigger state of the account: the name and whether the switch is on. */
const stateOf = (name: string, enabled: boolean): ProviderTriggerState => ({ connectionId: SANDBOX.id, name, enabled }) as ProviderTriggerState

/**
 * The service over doubles: the sandbox doors holding one sandbox account, two agents of the workspace (only Lan may be bound to a
 * sepay account), the account's two triggers both off, and no attachment yet.
 */
const serviceOf = () => {
    const accounts = mock<ProviderSandboxAccountsService>()
    accounts.assertManager.mockResolvedValue()
    accounts.open.mockResolvedValue({ id: SANDBOX.id, sandboxKey: "sbx_key" })
    accounts.account.mockResolvedValue({ id: SANDBOX.id, workspaceId: "ws-1", provider: "sepay", sandbox: true })
    accounts.accounts.mockResolvedValue([SANDBOX])
    accounts.discard.mockResolvedValue()
    const attached: Array<{ agentId: string; connectionId: string; provider: string }> = []
    const tools = mock<ToolsConsoleService>()
    tools.attachProvider.mockImplementation((_actor, agentId, wish) => {
        attached.push({ agentId, connectionId: wish.connectionId, provider: "sepay" })
        return Promise.resolve()
    })
    tools.detachProvider.mockImplementation((_actor, agentId, connectionId) => {
        const at = attached.findIndex((row) => row.agentId === agentId && row.connectionId === connectionId)
        if (at >= 0) attached.splice(at, 1)
        return Promise.resolve()
    })
    tools.providerBoard.mockImplementation(() => Promise.resolve({ providers: [], attachments: [...attached] }))
    const bound = new Set<string>()
    const grants = mock<ConnectionGrantsService>()
    grants.bindableAgents.mockResolvedValue([{ agentId: LAN.id, purpose: "inbound_chat" }])
    grants.setGrant.mockImplementation((_actor, _connectionId, agentId, on) => {
        if (on) bound.add(agentId)
        else bound.delete(agentId)
        return Promise.resolve()
    })
    grants.board.mockImplementation(() =>
        Promise.resolve([{ connection: SANDBOX, botUsername: null, accountMasked: null, grants: [...bound].map((agentId) => ({ agentId })) }]),
    )
    const triggers = mock<ProviderTriggerStatesService>()
    triggers.statesOf.mockResolvedValue([stateOf("transaction.received", false), stateOf("transaction.settled", false)])
    triggers.setEnabled.mockResolvedValue(stateOf("transaction.received", true))
    const agents = mock<AgentDirectoryService>()
    agents.cardsOf.mockImplementation((_ws, ids) => Promise.resolve([LAN, MINH].filter((card) => ids.includes(card.id))))
    return { accounts, tools, grants, triggers, agents, attached, bound, service: new SandboxAttachmentsService(accounts, tools, grants, triggers, agents) }
}

describe("SandboxAttachmentsService (open + attach in one owner action)", () => {
    it("opens the account alone when attachTo is empty: no attachment, no binding, no trigger switch", async () => {
        const { service, accounts, tools, grants, triggers } = serviceOf()

        await expect(service.open(ACTOR, { provider: "sepay", name: "SePay sandbox", attachTo: [] })).resolves.toEqual({ id: SANDBOX.id, sandboxKey: "sbx_key" })

        expect(accounts.open).toHaveBeenCalledWith(ACTOR, { provider: "sepay", name: "SePay sandbox" })
        expect(tools.attachProvider).not.toHaveBeenCalled()
        expect(grants.setGrant).not.toHaveBeenCalled()
        expect(triggers.setEnabled).not.toHaveBeenCalled()
    })

    it("attaches each agent once, binds the grant of the one that may be bound, and turns every off trigger on once", async () => {
        const { service, tools, grants, triggers } = serviceOf()

        await service.open(ACTOR, { provider: "sepay", name: "SePay sandbox", attachTo: [LAN.id, MINH.id, LAN.id] })

        expect(tools.attachProvider.mock.calls.map((call) => [call[1], call[2]])).toEqual([
            [LAN.id, { connectionId: SANDBOX.id }],
            [MINH.id, { connectionId: SANDBOX.id }],
        ])
        expect(grants.bindableAgents).toHaveBeenCalledWith("user-1", "ws-1", "sepay")
        expect(grants.setGrant.mock.calls).toEqual([[ACTOR, SANDBOX.id, LAN.id, true]])
        expect(triggers.setEnabled.mock.calls).toEqual([
            [ACTOR, { connectionId: SANDBOX.id, trigger: "transaction.received", enabled: true, catchUp: false }],
            [ACTOR, { connectionId: SANDBOX.id, trigger: "transaction.settled", enabled: true, catchUp: false }],
        ])
    })

    it("leaves a trigger that is already on alone", async () => {
        const { service, triggers } = serviceOf()
        triggers.statesOf.mockResolvedValue([stateOf("transaction.received", true), stateOf("transaction.settled", false)])

        await service.open(ACTOR, { provider: "sepay", name: "x", attachTo: [LAN.id] })

        expect(triggers.setEnabled.mock.calls.map((call) => call[1].trigger)).toEqual(["transaction.settled"])
    })

    it("refuses an agent that is unknown or of another workspace before anything is made", async () => {
        const { service, accounts, tools } = serviceOf()

        await expect(service.open(ACTOR, { provider: "sepay", name: "x", attachTo: [LAN.id, "a-other-workspace"] })).rejects.toMatchObject({
            code: ToolsErrorCode.AttachmentRefused,
            params: { reason: "unknown_agent" },
        })

        expect(accounts.open).not.toHaveBeenCalled()
        expect(tools.attachProvider).not.toHaveBeenCalled()
    })

    it("is refused with the switch off or for a non-manager, before anything is read or made", async () => {
        const { service, accounts, agents } = serviceOf()
        accounts.assertManager.mockRejectedValue(new ProviderSandboxError({ code: ProviderSandboxErrorCode.Off }))

        await expect(service.open(ACTOR, { provider: "sepay", name: "x", attachTo: [LAN.id] })).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.Off,
        })

        expect(agents.cardsOf).not.toHaveBeenCalled()
        expect(accounts.open).not.toHaveBeenCalled()
    })

    it("takes everything back and removes the account when a later agent cannot be attached", async () => {
        const { service, accounts, tools, grants, attached, bound } = serviceOf()
        const refused = new Error("attach refused")
        tools.attachProvider.mockImplementationOnce((_actor, agentId, wish) => {
            attached.push({ agentId, connectionId: wish.connectionId, provider: "sepay" })
            return Promise.resolve()
        })
        tools.attachProvider.mockRejectedValueOnce(refused)

        await expect(service.open(ACTOR, { provider: "sepay", name: "x", attachTo: [LAN.id, MINH.id] })).rejects.toBe(refused)

        expect(grants.setGrant.mock.calls).toEqual([
            [ACTOR, SANDBOX.id, LAN.id, true],
            [ACTOR, SANDBOX.id, LAN.id, false],
        ])
        expect(tools.detachProvider).toHaveBeenCalledWith(ACTOR, LAN.id, SANDBOX.id)
        expect(attached).toEqual([])
        expect(bound.size).toBe(0)
        expect(accounts.discard).toHaveBeenCalledWith(ACTOR, SANDBOX.id)
    })

    it("detaches the agent whose binding failed (it was attached, never bound) and removes the account", async () => {
        const { service, accounts, tools, grants } = serviceOf()
        const refused = new Error("not the owner")
        grants.setGrant.mockRejectedValueOnce(refused)

        await expect(service.open(ACTOR, { provider: "sepay", name: "x", attachTo: [LAN.id] })).rejects.toBe(refused)

        expect(grants.setGrant).toHaveBeenCalledTimes(1)
        expect(tools.detachProvider).toHaveBeenCalledWith(ACTOR, LAN.id, SANDBOX.id)
        expect(accounts.discard).toHaveBeenCalledWith(ACTOR, SANDBOX.id)
    })

    it("answers the failure itself even when taking back fails", async () => {
        const { service, tools, grants } = serviceOf()
        const refused = new Error("trigger refused")
        grants.setGrant.mockResolvedValueOnce().mockRejectedValue(new Error("unbind failed"))
        tools.detachProvider.mockRejectedValue(new Error("detach failed"))
        tools.attachProvider.mockResolvedValueOnce().mockRejectedValueOnce(refused)

        await expect(service.open(ACTOR, { provider: "sepay", name: "x", attachTo: [LAN.id, MINH.id] })).rejects.toBe(refused)
    })

    it("attaches an agent to an existing sandbox account and answers the account with its agents", async () => {
        const { service, tools, grants, triggers } = serviceOf()

        const view = await service.attach(ACTOR, SANDBOX.id, LAN.id)

        expect(tools.attachProvider).toHaveBeenCalledWith(ACTOR, LAN.id, { connectionId: SANDBOX.id })
        expect(grants.setGrant).toHaveBeenCalledWith(ACTOR, SANDBOX.id, LAN.id, true)
        expect(triggers.setEnabled).toHaveBeenCalledTimes(2)
        expect(view).toEqual({ account: SANDBOX, agents: [{ id: LAN.id, label: "Lan" }] })
    })

    it("does not bind an agent that may not be bound to the provider, and still attaches it", async () => {
        const { service, grants } = serviceOf()

        const view = await service.attach(ACTOR, SANDBOX.id, MINH.id)

        expect(grants.setGrant).not.toHaveBeenCalled()
        expect(view.agents).toEqual([{ id: MINH.id, label: "Minh" }])
    })

    it("refuses a live account and an unknown agent on attach, making nothing", async () => {
        const { service, accounts, tools } = serviceOf()

        await expect(service.attach(ACTOR, SANDBOX.id, "a-other-workspace")).rejects.toMatchObject({ params: { reason: "unknown_agent" } })
        accounts.account.mockRejectedValue(new ProviderSandboxError({ code: ProviderSandboxErrorCode.LiveAccount }))
        await expect(service.attach(ACTOR, "c-live", LAN.id)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })

        expect(tools.attachProvider).not.toHaveBeenCalled()
    })

    it("takes the attachment and binding back when the triggers cannot be turned on", async () => {
        const { service, grants, triggers, attached } = serviceOf()
        const refused = new Error("switch refused")
        triggers.setEnabled.mockRejectedValue(refused)

        await expect(service.attach(ACTOR, SANDBOX.id, LAN.id)).rejects.toBe(refused)

        expect(grants.setGrant.mock.calls.map((call) => call[3])).toEqual([true, false])
        expect(attached).toEqual([])
    })

    it("detaches: unbinds the grant, then removes the attachment, and answers the account without the agent", async () => {
        const { service, tools, grants, bound } = serviceOf()
        await service.attach(ACTOR, SANDBOX.id, LAN.id)
        await service.attach(ACTOR, SANDBOX.id, MINH.id)
        grants.setGrant.mockClear()
        tools.detachProvider.mockClear()

        const view = await service.detach(ACTOR, SANDBOX.id, LAN.id)

        expect(grants.setGrant).toHaveBeenCalledWith(ACTOR, SANDBOX.id, LAN.id, false)
        expect(tools.detachProvider).toHaveBeenCalledWith(ACTOR, LAN.id, SANDBOX.id)
        expect(bound.has(LAN.id)).toBe(false)
        expect(view.agents).toEqual([{ id: MINH.id, label: "Minh" }])
    })

    it("detaches an agent that was never bound without touching the grants", async () => {
        const { service, grants } = serviceOf()
        await service.attach(ACTOR, SANDBOX.id, MINH.id)

        await service.detach(ACTOR, SANDBOX.id, MINH.id)

        expect(grants.setGrant).not.toHaveBeenCalled()
    })

    it("refuses to detach an agent that is not attached, changing nothing", async () => {
        const { service, tools, grants } = serviceOf()

        await expect(service.detach(ACTOR, SANDBOX.id, LAN.id)).rejects.toMatchObject({
            code: ToolsErrorCode.AttachmentRefused,
            params: { reason: "not_attached" },
        })

        expect(grants.setGrant).not.toHaveBeenCalled()
        expect(tools.detachProvider).not.toHaveBeenCalled()
    })

    it("puts the binding back when the detach itself fails, and refuses a live account on detach", async () => {
        const { service, tools, grants, accounts, bound } = serviceOf()
        await service.attach(ACTOR, SANDBOX.id, LAN.id)
        const refused = new Error("detach refused")
        tools.detachProvider.mockRejectedValueOnce(refused)

        await expect(service.detach(ACTOR, SANDBOX.id, LAN.id)).rejects.toBe(refused)

        expect(grants.setGrant.mock.calls.map((call) => call[3])).toEqual([true, false, true])
        expect(bound.has(LAN.id)).toBe(true)
        accounts.account.mockRejectedValue(new ProviderSandboxError({ code: ProviderSandboxErrorCode.LiveAccount }))
        await expect(service.detach(ACTOR, "c-live", LAN.id)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
    })

    it("lists the sandbox accounts with the agents each is attached to (a gone agent is labelled by its id), one read each", async () => {
        const { service, tools, agents, attached } = serviceOf()
        attached.push(
            { agentId: LAN.id, connectionId: SANDBOX.id, provider: "sepay" },
            { agentId: "a-gone", connectionId: SANDBOX.id, provider: "sepay" },
            { agentId: MINH.id, connectionId: "c-live", provider: "sepay" },
        )

        const views = await service.list(ACTOR)

        expect(views).toEqual([{ account: SANDBOX, agents: [{ id: LAN.id, label: "Lan" }, { id: "a-gone", label: "a-gone" }] }])
        expect(tools.providerBoard).toHaveBeenCalledTimes(1)
        expect(agents.cardsOf).toHaveBeenCalledTimes(1)
    })

    it("lists nothing, and reads nothing else, when the workspace has no sandbox account", async () => {
        const { service, accounts, tools } = serviceOf()
        accounts.accounts.mockResolvedValue([])

        await expect(service.list(ACTOR)).resolves.toEqual([])

        expect(tools.providerBoard).not.toHaveBeenCalled()
    })
})
