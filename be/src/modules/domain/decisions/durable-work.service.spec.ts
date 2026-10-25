import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { CommandPlannerService } from "./command-planner.service"
import type { SendCommandInput, WorkContext, WorkItem, WorkSpec } from "./decisions.contracts"
import { DurableWorkService } from "./durable-work.service"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { WorkIntakeService } from "./work-intake.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "api:CRM", locale: "en" }
const spec: WorkSpec = {
    action: "reply_customer",
    subject_type: "conversation",
    subject_id: "conversation-1",
    dedupeKey: "api.message:request-1",
    seed: { draft: "Exact API text" },
    preset: true,
    noChain: true,
    forceAsk: "over_authority",
}
const input: SendCommandInput = {
    from: "inbound",
    to: "chatbot",
    command: "handoff_lead",
    payload: { subject_type: "inbound", subject_id: "event-1" },
    reason: "Public API lead",
}

const build = async () => {
    const item = mock<WorkItem>({ id: "work-1" })
    const planner = mock<CommandPlannerService>({
        plan: jest.fn().mockResolvedValue({ ok: true, spec, depth: 0, inserted: () => true }),
    })
    const intake = mock<WorkIntakeService>({ insert: jest.fn().mockResolvedValue({ item, created: true }) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DurableWorkService,
            { provide: CommandPlannerService, useValue: planner },
            { provide: WorkIntakeService, useValue: intake },
        ],
    }).compile()
    return { service: moduleRef.get(DurableWorkService), planner, intake, item }
}

describe("DurableWorkService", () => {
    it("admits queued work with the supplied execution choices in the caller's transaction", async () => {
        const { service, intake, item } = await build()
        const manager = mockEntityManager()

        expect(await service.enqueueWork(ctx, { ...spec, queue: false }, manager)).toBe(item)

        expect(intake.insert).toHaveBeenCalledWith(ctx, { ...spec, queue: true }, manager)
    })

    it("uses the transaction for command validation, announcement and durable admission", async () => {
        const { service, planner, intake, item } = await build()
        const manager = mockEntityManager()

        expect(await service.enqueueCommand(ctx, input, manager)).toBe(item)

        expect(planner.plan).toHaveBeenCalledWith(ctx, input, manager)
        expect(intake.insert).toHaveBeenCalledWith(ctx, { ...spec, queue: true }, manager)
    })

    it("fails the producer transaction when the command is refused", async () => {
        const { service, planner, intake } = await build()
        planner.plan.mockResolvedValue({ ok: false, refused: "unknown_command", detail: "Unsupported command" })

        await expect(service.enqueueCommand(ctx, input, mockEntityManager())).rejects.toThrow(
            DecisionsErrorCode.CommandRefused,
        )

        expect(intake.insert).not.toHaveBeenCalled()
    })

    it("propagates admission failure so inbox and sibling effects can roll back", async () => {
        const { service, intake } = await build()
        intake.insert.mockRejectedValue(new Error("database unavailable"))

        await expect(service.enqueueWork(ctx, spec, mockEntityManager())).rejects.toThrow("database unavailable")
    })
})
