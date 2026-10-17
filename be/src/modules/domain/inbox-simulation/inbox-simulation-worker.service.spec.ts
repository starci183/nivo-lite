import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { InboundEventsService, type OptionalInboundEvent } from "@modules/domain/inbound-events"
import { CLAIM_LEASE_SECONDS, WorkItemsService } from "@modules/domain/work-items"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { SimulateInboundPayload } from "@modules/queues/decisions"
import { InboxSimulationErrorCode } from "./errors/inbox-simulation.error"
import { InboxSimulationWorkerService } from "./inbox-simulation-worker.service"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
}

const PAYLOAD: SimulateInboundPayload = {
    kind: "simulate_inbound",
    workspaceId: "ws-1",
    userId: "user-1",
    locale: "vi",
    inboundEventId: "in-1",
    items: "",
}

const LIVE: NonNullable<OptionalInboundEvent> = {
    id: "in-1",
    workspace_id: "ws-1",
    channel: "zalo",
    kind: "message",
    origin: "live",
    sender_name: null,
    sender_contact: null,
    body: "hello",
    amount_vnd: null,
    external_ref: null,
    event_id: "evt-1",
    lead_id: null,
    status: "stored",
}

const itemOf = builder<WorkItem>({
    id: "work-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "handoff_lead",
    subject_type: "inbound",
    subject_id: "in-1",
    lead_id: "lead-1",
    inbound_event_id: "in-1",
    parent_id: null,
    chain_id: "work-1",
    depth: 0,
    status: "done",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Lead received", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "simulated",
    created_at: "2026-10-14T00:00:00Z",
    updated_at: "2026-10-14T00:00:00Z",
    completed_at: null,
    installation_id: null,
})

const CTX = { workspaceId: "ws-1", actor: "An", locale: "vi" }

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const inboundEvents = mock<InboundEventsService>()
    inboundEvents.find.mockResolvedValue(null)
    const engine = mock<WorkEngineService>()
    engine.startInboundWork.mockResolvedValue(itemOf())
    engine.startOrderWork.mockResolvedValue(itemOf())
    const workItems = mock<WorkItemsService>()
    workItems.inboundState.mockResolvedValue({ failed: 0, queued: 0, waiting: 0 })
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("Zalo channel")
    const moduleRef = await Test.createTestingModule({
        providers: [
            InboxSimulationWorkerService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InboundEventsService, useValue: inboundEvents },
            { provide: WorkEngineService, useValue: engine },
            { provide: WorkItemsService, useValue: workItems },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(InboxSimulationWorkerService), members, inboundEvents, engine, workItems, catalog }
}

describe("InboxSimulationWorkerService", () => {
    it("refuses a simulation whose stored event is missing", async () => {
        const { service } = await build()

        await expect(service.run(PAYLOAD)).rejects.toMatchObject({ code: InboxSimulationErrorCode.NotFound })
    })
    it("refuses a stored event that was not simulated", async () => {
        const { service, inboundEvents } = await build()
        inboundEvents.find.mockResolvedValue(LIVE)

        await expect(service.run(PAYLOAD)).rejects.toMatchObject({ code: InboxSimulationErrorCode.NotFound })
    })
    it("hands off the sender and localized channel and records the finished lead", async () => {
        const { service, members, inboundEvents, engine, workItems, catalog } = await build()
        inboundEvents.find.mockResolvedValue({
            ...LIVE,
            origin: "simulated",
            sender_name: "Binh",
            sender_contact: "123",
        })

        await expect(service.run(PAYLOAD)).resolves.toBeUndefined()

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(inboundEvents.find).toHaveBeenCalledWith("ws-1", "in-1")
        expect(catalog.get).toHaveBeenCalledWith("inboxSimulation.channel.zalo", {}, "vi")
        expect(engine.startInboundWork).toHaveBeenCalledWith(
            CTX,
            { id: "in-1", origin: "simulated" },
            "handoff_lead",
            {
                fields: {
                    contact_name: "Binh",
                    company: "",
                    need: "hello",
                    contact: "123",
                    channel_label: "Zalo channel",
                },
            },
            null,
        )
        expect(engine.runInboundQueued).toHaveBeenCalledWith(CTX, "in-1", 20)
        expect(workItems.inboundState).toHaveBeenCalledWith("ws-1", "in-1")
        expect(workItems.findByDedupe).not.toHaveBeenCalled()
        expect(inboundEvents.mark.mock.calls).toEqual([
            ["ws-1", "in-1", "processed", "lead-1"],
            ["ws-1", "in-1", "processed", "lead-1"],
        ])
    })
    it("supplies an empty contact name for an unnamed message", async () => {
        const { service, inboundEvents, engine } = await build()
        inboundEvents.find.mockResolvedValue({ ...LIVE, origin: "simulated" })

        await expect(service.run(PAYLOAD)).resolves.toBeUndefined()

        expect(engine.startInboundWork).toHaveBeenCalledWith(
            CTX,
            { id: "in-1", origin: "simulated" },
            "handoff_lead",
            { fields: { contact_name: "", company: "", need: "hello", contact: null, channel_label: "Zalo channel" } },
            null,
        )
    })
})

describe("InboxSimulationWorkerService", () => {
    it("starts order work with the supplied items and stored amount", async () => {
        const { service, inboundEvents, engine, catalog } = await build()
        inboundEvents.find.mockResolvedValue({ ...LIVE, origin: "simulated", kind: "order", amount_vnd: 1000 })

        await expect(service.run({ ...PAYLOAD, items: "2 boxes" })).resolves.toBeUndefined()

        expect(engine.startOrderWork).toHaveBeenCalledWith(
            CTX,
            { id: "in-1", origin: "simulated" },
            { items: "2 boxes", amount_vnd: 1000 },
        )
        expect(engine.startInboundWork).not.toHaveBeenCalled()
        expect(catalog.get).not.toHaveBeenCalled()
    })
    it("starts reconciliation for a simulated payment", async () => {
        const { service, inboundEvents, engine } = await build()
        inboundEvents.find.mockResolvedValue({ ...LIVE, origin: "simulated", kind: "payment", amount_vnd: 4500 })

        await expect(service.run(PAYLOAD)).resolves.toBeUndefined()

        expect(engine.startInboundWork).toHaveBeenCalledWith(
            CTX,
            { id: "in-1", origin: "simulated" },
            "reconcile_payment",
            { amount_vnd: 4500, fields: {} },
            null,
        )
    })
    it("marks an initial failed result and stops without draining follow-ups", async () => {
        const { service, inboundEvents, engine, workItems } = await build()
        inboundEvents.find.mockResolvedValue({ ...LIVE, origin: "simulated" })
        engine.startInboundWork.mockResolvedValue(itemOf({ status: "failed", lead_id: null }))

        await expect(service.run(PAYLOAD)).rejects.toMatchObject({
            code: InboxSimulationErrorCode.Failed,
            params: { unrecoverable: 1 },
        })

        expect(inboundEvents.mark.mock.calls).toEqual([["ws-1", "in-1", "failed", null]])
        expect(engine.runInboundQueued).not.toHaveBeenCalled()
        expect(workItems.inboundState).not.toHaveBeenCalled()
    })
    it("marks a failed follow-up even when another step remains queued", async () => {
        const { service, inboundEvents, workItems } = await build()
        inboundEvents.find.mockResolvedValue({ ...LIVE, origin: "simulated" })
        workItems.inboundState.mockResolvedValue({ failed: 1, queued: 1, waiting: 0 })

        await expect(service.run(PAYLOAD)).rejects.toMatchObject({
            code: InboxSimulationErrorCode.Failed,
            params: { unrecoverable: 1 },
        })

        expect(inboundEvents.mark.mock.calls).toEqual([
            ["ws-1", "in-1", "processed", "lead-1"],
            ["ws-1", "in-1", "failed", null],
        ])
    })
})

describe("InboxSimulationWorkerService", () => {
    it("leaves unfinished queued work received and requests a retry after its lease", async () => {
        const { service, inboundEvents, engine, workItems } = await build()
        inboundEvents.find.mockResolvedValue({ ...LIVE, origin: "simulated" })
        engine.startInboundWork.mockResolvedValue(itemOf({ status: "queued" }))
        workItems.inboundState.mockResolvedValue({ failed: 0, queued: 1, waiting: 0 })

        await expect(service.run(PAYLOAD)).rejects.toMatchObject({
            code: InboxSimulationErrorCode.Pending,
            params: { retryAfterSeconds: CLAIM_LEASE_SECONDS },
        })

        expect(inboundEvents.mark.mock.calls).toEqual([["ws-1", "in-1", "received", "lead-1"]])
        expect(workItems.findByDedupe).not.toHaveBeenCalled()
    })
    it("refreshes a queued first step after draining and records its refreshed lead", async () => {
        const { service, inboundEvents, engine, workItems } = await build()
        inboundEvents.find.mockResolvedValue({ ...LIVE, origin: "simulated" })
        engine.startInboundWork.mockResolvedValue(itemOf({ status: "queued", lead_id: null }))
        workItems.findByDedupe.mockResolvedValue(itemOf({ lead_id: "refreshed-lead" }))

        await expect(service.run(PAYLOAD)).resolves.toBeUndefined()

        expect(workItems.findByDedupe).toHaveBeenCalledWith("ws-1", "handoff_lead:inbound:in-1")
        expect(inboundEvents.mark.mock.calls).toEqual([
            ["ws-1", "in-1", "received", null],
            ["ws-1", "in-1", "processed", "refreshed-lead"],
        ])
    })
    it("fails if the drained first item cannot be refreshed", async () => {
        const { service, inboundEvents, engine, workItems } = await build()
        inboundEvents.find.mockResolvedValue({ ...LIVE, origin: "simulated" })
        engine.startInboundWork.mockResolvedValue(itemOf({ status: "queued" }))
        workItems.findByDedupe.mockResolvedValue(null)

        await expect(service.run(PAYLOAD)).rejects.toMatchObject({
            code: InboxSimulationErrorCode.Failed,
            params: { unrecoverable: 1 },
        })

        expect(inboundEvents.mark.mock.calls).toEqual([["ws-1", "in-1", "received", "lead-1"]])
    })
    it("marks a completed first step as needing a decision when a child waits", async () => {
        const { service, inboundEvents, workItems } = await build()
        inboundEvents.find.mockResolvedValue({ ...LIVE, origin: "simulated" })
        workItems.inboundState.mockResolvedValue({ failed: 0, queued: 0, waiting: 1 })

        await expect(service.run(PAYLOAD)).resolves.toBeUndefined()

        expect(inboundEvents.mark.mock.calls).toEqual([
            ["ws-1", "in-1", "processed", "lead-1"],
            ["ws-1", "in-1", "needs_decision", "lead-1"],
        ])
    })
})

describe("InboxSimulationWorkerService", () => {
    it("records a first step that waits for a decision as needing a decision", async () => {
        const { service, inboundEvents, engine } = await build()
        inboundEvents.find.mockResolvedValue({ ...LIVE, origin: "simulated" })
        engine.startInboundWork.mockResolvedValue(itemOf({ status: "waiting_decision" }))

        await expect(service.run(PAYLOAD)).resolves.toBeUndefined()

        expect(inboundEvents.mark.mock.calls).toEqual([
            ["ws-1", "in-1", "needs_decision", "lead-1"],
            ["ws-1", "in-1", "needs_decision", "lead-1"],
        ])
    })
})
