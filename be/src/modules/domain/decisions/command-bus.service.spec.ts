import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CommandBusService } from "./command-bus.service"
import { CommandPlannerService } from "./command-planner.service"
import type { SendCommandInput, WorkContext, WorkItem, WorkSpec } from "./decisions.contracts"
import { DecisionsErrorCode } from "./errors/decisions.error"
import type { CommandPlan } from "./work-engine.contracts"
import { WorkEngineService } from "./work-engine.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }

const inputOf = builder<SendCommandInput>({
    from: "owner",
    to: "sales",
    command: "classify_lead",
    payload: { lead_id: "lead-1" },
    reason: "handoff",
})

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "classify_lead",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "chain-1",
    depth: 2,
    status: "done",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const spec: WorkSpec = {
    action: "classify_lead",
    subject_type: "lead",
    dedupeKey: "key-1",
    origin: "live",
}

const build = async (plan: CommandPlan) => {
    const runWork = jest.fn().mockResolvedValue(itemOf())
    const planner = mock<CommandPlannerService>({ plan: jest.fn().mockResolvedValue(plan) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CommandBusService,
            { provide: CommandPlannerService, useValue: planner },
            { provide: WorkEngineService, useValue: mock<WorkEngineService>({ runWork }) },
        ],
    }).compile()
    return { bus: moduleRef.get(CommandBusService), runWork, planner }
}

const accepted = (created: boolean): CommandPlan => ({ ok: true, spec, depth: 1, inserted: () => created })
const refused: CommandPlan = { ok: false, refused: "cycle", detail: "again" }

describe("CommandBusService", () => {
    describe("sendCommand", () => {
        it("runs the planned spec through the engine and answers the item", async () => {
            const { bus, runWork, planner } = await build(accepted(true))

            const result = await bus.sendCommand(ctx, inputOf())

            expect(planner.plan).toHaveBeenCalledWith(ctx, inputOf())
            expect(runWork).toHaveBeenCalledWith(ctx, spec)
            expect(result).toEqual({ ok: true, item: itemOf(), created: true, chainId: "chain-1", depth: 2 })
        })

        it("says the item was not created when its dedupe key was already used", async () => {
            const { bus } = await build(accepted(false))

            expect(await bus.sendCommand(ctx, inputOf())).toEqual(expect.objectContaining({ ok: true, created: false }))
        })

        it("answers a refusal without running anything", async () => {
            const { bus, runWork } = await build(refused)

            expect(await bus.sendCommand(ctx, inputOf())).toBe(refused)
            expect(runWork).not.toHaveBeenCalled()
        })
    })

    describe("sendCommandItem", () => {
        it("answers the item", async () => {
            const { bus } = await build(accepted(true))

            expect(await bus.sendCommandItem(ctx, inputOf())).toEqual(itemOf())
        })

        it("throws the typed refusal when the command is refused", async () => {
            const { bus } = await build(refused)

            await expect(bus.sendCommandItem(ctx, inputOf())).rejects.toThrow(DecisionsErrorCode.CommandRefused)
        })
    })
})
