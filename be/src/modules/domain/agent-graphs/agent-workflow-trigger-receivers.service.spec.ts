import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { AccountAttachmentsService } from "@modules/domain/tool-grants"
import type { ProviderWake } from "@modules/domain/provider-triggers"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowTriggerReceiversService } from "./agent-workflow-trigger-receivers.service"
import { tagSourceOf, triggerScopeOf } from "./policies/graph-flow.policy"

type Attachments = Awaited<ReturnType<AccountAttachmentsService["listOfWorkspace"]>>

const attachment = (agentId: string, connectionId: string): Attachments[number] => ({
    agentId,
    connectionId,
    provider: "sepay",
})

const WAKE: ProviderWake = {
    providerTrigger: "sepay:transaction.received",
    connectionId: "conn-1",
    params: { transactionId: "tx-1", direction: "in" },
}

const build = async () => {
    const access = mock<AccountAttachmentsService>()
    const runs = mock<AgentWorkflowRunsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentWorkflowTriggerReceiversService,
            { provide: AccountAttachmentsService, useValue: access },
            { provide: AgentWorkflowRunsService, useValue: runs },
        ],
    }).compile()
    return { service: moduleRef.get(AgentWorkflowTriggerReceiversService), access, runs }
}

describe("AgentWorkflowTriggerReceiversService", () => {
    it("names the agents attached to the account, once each, and no agent of another account", async () => {
        const { service, access } = await build()
        access.listOfWorkspace.mockResolvedValue([
            attachment("agent-1", "conn-1"),
            attachment("agent-2", "conn-2"),
            attachment("agent-3", "conn-1"),
            attachment("agent-1", "conn-1"),
        ])

        await expect(service.attachedTo("ws-1", "conn-1")).resolves.toEqual(["agent-1", "agent-3"])
        expect(access.listOfWorkspace).toHaveBeenCalledWith("ws-1")
    })

    it("MATCH: the workflow whose registration takes the event, with the registration's own key; none when no registration does", async () => {
        const { service, runs } = await build()
        runs.takerOfEvent.mockResolvedValueOnce({
            workflowId: "wf-1",
            registration: { key: "paid", correlationKey: "data.orderId" } as never,
            flow: {} as never,
        })
        runs.takerOfEvent.mockResolvedValueOnce(null)

        await expect(service.takerOf("ws-1", "agent-1", TRIGGER.paymentCreditReceived, { eventId: "tx-1", data: {} })).resolves.toEqual({
            workflowId: "wf-1",
            ownKey: "data.orderId",
        })
        await expect(service.takerOf("ws-1", "agent-1", TRIGGER.paymentCreditReceived, { eventId: "tx-2", data: {} })).resolves.toBeNull()
        expect(runs.takerOfEvent).toHaveBeenCalledWith("ws-1", "agent-1", TRIGGER.paymentCreditReceived, { eventId: "tx-1", data: {} }, null, null)
    })

    it("an agent hears a verb no registration of it takes when a `wait` of one of its active workflows lists it", async () => {
        const { service, runs } = await build()
        runs.waitVerbsOf.mockResolvedValue(new Set([TRIGGER.videoRenderCompleted]))

        await expect(service.waitsOn("ws-1", "agent-1", TRIGGER.videoRenderCompleted)).resolves.toBe(true)
        await expect(service.waitsOn("ws-1", "agent-1", TRIGGER.paymentCreditReceived)).resolves.toBe(false)
        expect(runs.waitVerbsOf).toHaveBeenCalledWith("ws-1", "agent-1")
    })

    it("the registry read: asks routing with the sample wake a trigger would write (a system event naming the trigger, the account, the params)", async () => {
        const { service, runs } = await build()
        runs.takersOf.mockResolvedValue([{ workflowId: "wf-1", key: "payment", name: "Payment" }, null])
        runs.waitVerbsOf.mockResolvedValue(new Set())

        await expect(service.registered("ws-1", "agent-1", [WAKE, { ...WAKE, params: { transactionId: "tx-2", direction: "out" } }])).resolves.toEqual([
            true,
            false,
        ])
        const [workspaceId, agentId, wakes] = runs.takersOf.mock.calls[0] ?? []
        const [first] = wakes ?? []
        expect([workspaceId, agentId, wakes?.length]).toEqual(["ws-1", "agent-1", 2])
        expect(first === undefined ? null : tagSourceOf(first)).toBe("system-event")
        expect(first === undefined ? null : triggerScopeOf(first)).toMatchObject({
            providerTrigger: "sepay:transaction.received",
            connectionId: "conn-1",
            transactionId: "tx-1",
            direction: "in",
        })
    })

    it("the registry read: a sample wake whose verb no head registers counts when a `wait` of an active workflow lists it", async () => {
        const { service, runs } = await build()
        runs.takersOf.mockResolvedValue([null, null])
        runs.waitVerbsOf.mockResolvedValue(new Set([TRIGGER.videoRenderCompleted]))
        const render: ProviderWake = {
            providerTrigger: "shotstack:render.completed",
            connectionId: "conn-9",
            params: { renderRowId: "row-1", renderId: "r-1", status: "done" },
        }

        await expect(service.registered("ws-1", "agent-1", [render, WAKE])).resolves.toEqual([true, false])
    })
})
