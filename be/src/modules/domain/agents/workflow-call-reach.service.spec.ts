import { mock } from "@starci/jest-preset"
import type { ProviderTriggerReceivers } from "@modules/domain/provider-triggers"
import { agentInstallationOf } from "@tests/fixtures/builders/agents.builder"
import type { ConversationChannelOwners, InstallationDirectory } from "./agents.port"
import { WorkflowCallReachService } from "./workflow-call-reach.service"

// E-SMALL item 1: the ONE answer to "who takes a workflow call, can it start here", shared by the call effect and the engine's
// `run.unreachable`. Rule: an agent of the target module (the route's channel owner, else the oldest) AND a live registration of the
// workflow taking a call pinned to it (the delivery's own MATCH, read only).

const ORIGIN = { workspaceId: "ws-1", routeId: "route-1", contactId: "contact-1" }

const build = (opts: { owner?: string | null; first?: string | null; taker?: boolean; receivers?: boolean } = {}) => {
    const installations = mock<InstallationDirectory>()
    installations.firstOfModule.mockResolvedValue(
        opts.first === null ? null : agentInstallationOf({ agentId: opts.first ?? "booking-1" }),
    )
    const owners = mock<ConversationChannelOwners>()
    owners.ownerAgentOf.mockResolvedValue(opts.owner ?? null)
    const receivers = mock<ProviderTriggerReceivers>()
    receivers.takerOf.mockResolvedValue(opts.taker === false ? null : { workflowId: "wf-book", ownKey: null })
    const service = new WorkflowCallReachService(installations, owners, opts.receivers === false ? null : receivers)
    return { service, installations, owners, receivers }
}

describe("WorkflowCallReachService", () => {
    it("agentOf: the route's channel owner, else the oldest agent of the module; no route asks no owner", async () => {
        const owned = build({ owner: "booking-zalo" })
        await expect(owned.service.agentOf("ws-1", "route-1", "booking")).resolves.toBe("booking-zalo")
        const plain = build()
        await expect(plain.service.agentOf("ws-1", null, "booking")).resolves.toBe("booking-1")
        expect(plain.owners.ownerAgentOf).not.toHaveBeenCalled()
        await expect(build({ first: null }).service.agentOf("ws-1", null, "booking")).resolves.toBeNull()
    })

    it("startable: the delivery's MATCH on the call verb, pinned to the workflow's key, for the module's agent", async () => {
        const { service, receivers } = build()
        await expect(service.startable(ORIGIN, { module: "booking", workflow: "book" })).resolves.toBe(true)
        expect(receivers.takerOf).toHaveBeenCalledWith(
            "ws-1",
            "booking-1",
            "nivo.trigger.workflow.called",
            expect.objectContaining({ eventId: expect.any(String), contactId: "contact-1", routeId: "route-1", data: {} }),
            null,
            "book",
        )
    })

    it("no agent of the module, or no live registration of the workflow: the call cannot start", async () => {
        await expect(build({ first: null }).service.startable(ORIGIN, { module: "booking", workflow: "book" })).resolves.toBe(false)
        await expect(build({ taker: false }).service.startable(ORIGIN, { module: "booking", workflow: "book" })).resolves.toBe(false)
    })

    it("an app with no MATCH reader bound judges by the agent alone", async () => {
        await expect(build({ receivers: false }).service.startable(ORIGIN, { module: "booking", workflow: "book" })).resolves.toBe(true)
    })
})
