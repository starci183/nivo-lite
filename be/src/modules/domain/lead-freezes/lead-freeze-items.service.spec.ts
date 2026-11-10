import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsService } from "@modules/domain/work-items"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { itemOf as workItemOf } from "@tests/fixtures/builders/work-decision.builder"
import { freezeCatalog, frozenFreezeOf } from "@tests/fixtures/builders/lead-freezes.builder"
import { LEAD_FROZEN_ACTION, LeadFreezeItemsService } from "./lead-freeze-items.service"

const FREEZE = frozenFreezeOf({ workItemId: null })

/** The item of the freeze waiting for the owner, as the work items store keeps it. */
const itemOf = (over: Parameters<typeof workItemOf>[0] = {}) =>
    workItemOf({
        action: "lead_frozen",
        proposal: { summary: "old", fields: { freezeId: "freeze-1" } },
        reason: "branch_ask",
        reasons: ["branch_ask"],
        ...over,
    })

const build = async (installed = true) => {
    const engine = mock<WorkEngineService>({ runWork: jest.fn().mockResolvedValue(itemOf({ id: "item-2" })) })
    const items = mock<WorkItemsService>({ findMany: jest.fn().mockResolvedValue([]) })
    const installations = mock<InstallationRecordsService>({
        ofAgent: jest.fn().mockResolvedValue(installed ? { moduleKey: "chatbot" } : null),
    })
    const catalog = mock<MessageCatalog>({ get: jest.fn(freezeCatalog.get) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezeItemsService,
            { provide: WorkEngineService, useValue: engine },
            { provide: WorkItemsService, useValue: items },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(LeadFreezeItemsService), engine, items }
}

describe("LeadFreezeItemsService.raise", () => {
    it("opens the one owner item of the lead, waiting for a person, with the words of each answer", async () => {
        const { service, engine } = await build()

        await expect(service.raise("ws-1", FREEZE, "en")).resolves.toBe("item-2")

        const [ctx, spec] = engine.runWork.mock.calls[0] ?? []
        expect(ctx).toEqual({ workspaceId: "ws-1", actor: "NIVO", locale: "en" })
        expect(spec).toMatchObject({
            action: LEAD_FROZEN_ACTION,
            department: "chatbot",
            subject_type: "lead",
            subject_id: "lead-1",
            lead_id: "lead-1",
            dedupeKey: "lead-freeze:freeze-1:1:1",
            preset: true,
            forceAsk: "branch_ask",
            ownCard: true,
            seed: {
                fields: {
                    freezeId: "freeze-1",
                    runId: "run-1",
                    code: "GRAPH_NODES_EXECUTOR_MISSING",
                    step: "Take a payment claim",
                },
            },
        })
        expect(spec?.seed?.summary).toContain(
            "Customer Nguyen Van A is waiting for you: the step Take a payment claim failed",
        )
        expect(spec?.seed?.fields?.retry).toContain("Retry:")
    })

    it("files the item about the conversation of a customer who is not a lead yet, under no department with no installation", async () => {
        const { service, engine } = await build(false)
        await service.raise("ws-1", { ...FREEZE, leadId: null, agentId: null }, "en")
        expect(engine.runWork.mock.calls[0]?.[1]).toMatchObject({
            subject_type: "conversation",
            subject_id: "c-1",
            lead_id: null,
        })
        expect(engine.runWork.mock.calls[0]?.[1]).not.toHaveProperty("department")
    })

    it("updates the item while it waits, with the newest failure, instead of opening another", async () => {
        const { service, engine, items } = await build()
        items.findMany.mockResolvedValue([itemOf({})])

        await expect(service.raise("ws-1", { ...FREEZE, workItemId: "item-1", failures: 2 }, "en")).resolves.toBe(
            "item-1",
        )

        expect(engine.runWork).not.toHaveBeenCalled()
        const [id, still] = items.markStillWaiting.mock.calls[0] ?? []
        expect(id).toBe("item-1")
        expect(still).toMatchObject({ missing: [], reason: "branch_ask", reasons: ["branch_ask"] })
        expect(still?.proposal.summary).toContain("Failed 2 times.")
        expect(still?.proposal.fields).toMatchObject({ freezeId: "freeze-1", failures: 2 })
    })

    it("opens the next item once the one it names was decided, or belongs to another workspace", async () => {
        const { service, engine, items } = await build()
        items.findMany
            .mockResolvedValueOnce([itemOf({ status: "done" })])
            .mockResolvedValueOnce([itemOf({ workspace_id: "ws-2" })])

        await service.raise("ws-1", { ...FREEZE, workItemId: "item-1", failures: 2 }, "vi")
        await service.raise("ws-1", { ...FREEZE, workItemId: "item-1", failures: 2 }, "vi")

        expect(engine.runWork).toHaveBeenCalledTimes(2)
        expect(engine.runWork.mock.calls[0]?.[1].dedupeKey).toBe("lead-freeze:freeze-1:1:2")
        expect(items.markStillWaiting).not.toHaveBeenCalled()
    })

    it("keeps the reason the gate asked with when the item names none", async () => {
        const { service, items } = await build()
        items.findMany.mockResolvedValue([itemOf({ reason: null })])
        await service.raise("ws-1", { ...FREEZE, workItemId: "item-1" }, "vi")
        expect(items.markStillWaiting.mock.calls[0]?.[1].reason).toBe("branch_ask")
    })
})
