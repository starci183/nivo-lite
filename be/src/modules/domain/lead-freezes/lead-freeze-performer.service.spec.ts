import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { StopDoorService } from "@modules/domain/agent-threads"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkContext, WorkPerformerRegistry } from "@modules/domain/decisions"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { freezeCatalog } from "@tests/fixtures/builders/lead-freezes.builder"
import { itemOf } from "@tests/fixtures/builders/work-decision.builder"
import { LeadFreezePerformerService } from "./lead-freeze-performer.service"
import { LeadFreezesService } from "./lead-freezes.service"

const CTX: WorkContext = { workspaceId: "ws-1", actor: "Owner", locale: "en" }

const ITEM = itemOf({ action: "lead_frozen", proposal: { summary: "s", fields: { freezeId: "freeze-1" } } })

const BARE = itemOf({ action: "lead_frozen", proposal: { summary: "s", fields: {} } })

const OWNER = { name: "Owner", kind: "owner" as const, memberId: "member-1" }

const build = async (threads: "none" | "legacy" | "langgraph" = "none") => {
    const registry = mock<WorkPerformerRegistry>()
    const freezes = mock<LeadFreezesService>({
        retry: jest.fn().mockResolvedValue("released"),
        skip: jest.fn().mockResolvedValue("skipped"),
        reraise: jest.fn().mockResolvedValue(undefined),
        stateOf: jest.fn().mockResolvedValue({ id: "freeze-1", runId: "run-1" }),
    })
    const stops = mock<StopDoorService>({
        isThreadRun: jest.fn().mockResolvedValue(threads === "langgraph"),
        apply: jest.fn().mockResolvedValue({ outcome: "admitted", stepKey: "match" }),
    })
    const catalog = mock<MessageCatalog>({ get: jest.fn(freezeCatalog.get) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezePerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFreezesService, useValue: freezes },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            ...(threads === "none" ? [] : [{ provide: StopDoorService, useValue: stops }]),
        ],
    }).compile()
    return { performer: moduleRef.get(LeadFreezePerformerService), registry, freezes, stops }
}

describe("LeadFreezePerformerService", () => {
    it("registers as the performer of the lead_frozen item at boot, and keeps the proposal its freeze preset", async () => {
        const { performer, registry } = await build()
        performer.onModuleInit()
        expect(registry.add).toHaveBeenCalledWith("lead_frozen", performer)
        await expect(performer.prepare(CTX, ITEM)).resolves.toEqual({ proposal: ITEM.proposal })
    })

    it("approving retries the run under the member who decided", async () => {
        const { performer, freezes } = await build()

        const performed = await performer.perform(CTX, ITEM, ITEM.proposal, OWNER)

        expect(freezes.retry).toHaveBeenCalledWith("ws-1", "freeze-1", "member-1")
        expect(freezes.reraise).not.toHaveBeenCalled()
        expect(performed.summary).toBe("The retry succeeded; the customer is released and the waiting events run on.")
        expect(performed).toMatchObject({ evidence: "captured", lead_id: "lead-1" })
    })

    it("raises the next item when the retry did not release the customer", async () => {
        const { performer, freezes } = await build()
        freezes.retry.mockResolvedValueOnce("still_frozen").mockResolvedValueOnce("not_retryable")

        const still = await performer.perform(CTX, ITEM, ITEM.proposal, { name: "Owner" })
        await performer.perform(CTX, ITEM, ITEM.proposal, OWNER)

        expect(freezes.retry).toHaveBeenNthCalledWith(1, "ws-1", "freeze-1", "Owner")
        expect(freezes.reraise).toHaveBeenCalledTimes(2)
        expect(still.summary).toBe("The retry failed again; the customer still waits and a new item is open.")
    })

    it("rejecting skips the turn; an item that names no freeze does nothing", async () => {
        const { performer, freezes } = await build()

        await performer.onReject(CTX, ITEM, ITEM.proposal, OWNER)
        await performer.onReject(CTX, BARE, BARE.proposal, OWNER)
        const none = await performer.perform(CTX, BARE, BARE.proposal, OWNER)

        expect(freezes.skip).toHaveBeenCalledTimes(1)
        expect(freezes.skip).toHaveBeenCalledWith("ws-1", "freeze-1", "member-1")
        expect(none.summary).toBe("The customer no longer waits.")
    })
})

describe("LeadFreezePerformerService on a thread run: the decision goes to the run's stop", () => {
    it("approving hands retry to the stop door as the member who decided, and retries no old run", async () => {
        const { performer, freezes, stops } = await build("langgraph")

        const performed = await performer.perform(CTX, ITEM, ITEM.proposal, OWNER)

        expect(stops.apply).toHaveBeenCalledWith(
            { memberId: "member-1", name: "Owner" },
            { workspaceId: "ws-1", runId: "run-1", action: "retry" },
        )
        expect(freezes.retry).not.toHaveBeenCalled()
        expect(freezes.reraise).not.toHaveBeenCalled()
        expect(performed.summary).toBe(freezeCatalog.get("leadFreezes.outcome.retrying", {}, "en"))
    })

    it("rejecting hands skip to the stop door; a stop already closed is told the customer no longer waits", async () => {
        const { performer, freezes, stops } = await build("langgraph")

        await performer.onReject(CTX, ITEM, ITEM.proposal, OWNER)
        expect(stops.apply).toHaveBeenCalledWith(
            { memberId: "member-1", name: "Owner" },
            { workspaceId: "ws-1", runId: "run-1", action: "skip" },
        )
        expect(freezes.skip).not.toHaveBeenCalled()

        stops.apply.mockResolvedValueOnce({ outcome: "stop_closed", stepKey: "match" })
        const closed = await performer.perform(CTX, ITEM, ITEM.proposal, OWNER)
        expect(closed.summary).toBe("The customer no longer waits.")
    })

    it("keeps the old path for a run of the old engine even when the stops are composed", async () => {
        const { performer, freezes, stops } = await build("legacy")

        await performer.perform(CTX, ITEM, ITEM.proposal, OWNER)
        await performer.onReject(CTX, ITEM, ITEM.proposal, OWNER)

        expect(stops.isThreadRun).toHaveBeenCalledWith("ws-1", "run-1")
        expect(stops.apply).not.toHaveBeenCalled()
        expect(freezes.retry).toHaveBeenCalledWith("ws-1", "freeze-1", "member-1")
        expect(freezes.skip).toHaveBeenCalledWith("ws-1", "freeze-1", "member-1")
    })
})
