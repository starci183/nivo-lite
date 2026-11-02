import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { WorkItemsDecisionsReadService, WorkItemsService } from "@modules/domain/work-items"
import { DecisionLogReadService } from "./decision-log-read.service"
import type { WorkItem } from "@modules/domain/work-items"
import { itemOf } from "@tests/fixtures/builders/work-engine.builder"
import { AgentRunItemVerdictsService } from "./agent-run-item-verdicts.service"

const item = (id: string, status: WorkItem["status"]): WorkItem => itemOf({ id, status })

const build = async (
    found: ReadonlyArray<WorkItem>,
    actors: ReadonlyMap<string, string | null> = new Map([["a", "member-1"]]),
) => {
    const items = mock<WorkItemsService>({ findMany: jest.fn().mockResolvedValue(found) })
    const decisions = mock<DecisionLogReadService>({ decidersOf: jest.fn().mockResolvedValue(actors) })
    const reads = mock<WorkItemsDecisionsReadService>({ claimDecision: jest.fn().mockResolvedValue({ kind: "open" }) })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunItemVerdictsService,
            { provide: WorkItemsService, useValue: items },
            { provide: DecisionLogReadService, useValue: decisions },
            { provide: WorkItemsDecisionsReadService, useValue: reads },
        ],
    }).compile()
    return { service: container.get(AgentRunItemVerdictsService), items, decisions, reads }
}

describe("AgentRunItemVerdictsService.verdictsOf", () => {
    it("reads done as approved and rejected as refused, and leaves an item still open without a verdict", async () => {
        const { service } = await build([
            item("a", "done"),
            item("b", "rejected"),
            item("c", "waiting_decision"),
            item("d", "failed"),
        ])

        const verdicts = await service.verdictsOf(["a", "b", "c", "d"])

        expect([...verdicts]).toEqual([
            ["a", { approved: true, by: "member-1", data: { fields: { items: "tea" }, draft: null } }],
            ["b", { approved: false, by: null, data: { fields: { items: "tea" }, draft: null } }],
        ])
    })

    it("recovers the proposal's approved edits and recorded decider instead of the original calls", async () => {
        const proposal = {
            summary: "Order",
            fields: { tool: "orders.draft", args_json: '{"qty":1}' },
            draft: "One order",
        }
        const { service } = await build(
            [itemOf({ id: "edited", status: "done", proposal, decidedBy: "Lan" })],
            new Map([["edited", "member-1"]]),
        )
        await expect(service.verdictsOf(["edited"])).resolves.toEqual(
            new Map([
                ["edited", { approved: true, by: "member-1", data: { fields: proposal.fields, draft: "One order" } }],
            ]),
        )
    })

    it("keeps a missing recorded principal unknown instead of substituting the display name", async () => {
        const { service } = await build([itemOf({ id: "legacy", status: "done", decidedBy: "Lan" })], new Map())
        expect((await service.verdictsOf(["legacy"])).get("legacy")?.by).toBeNull()
    })

    it("reads nothing for no ids", async () => {
        const { service, items, decisions } = await build([])

        await expect(service.verdictsOf([])).resolves.toEqual(new Map())
        expect(items.findMany).not.toHaveBeenCalled()
        expect(decisions.decidersOf).not.toHaveBeenCalled()
    })
})

describe("AgentRunItemVerdictsService.claimTimeout", () => {
    it("uses the shared owner lock and leaves busy or open decisions without a fabricated verdict", async () => {
        const { service, reads, decisions } = await build([])
        const manager = mockEntityManager()
        await expect(service.claimTimeout(manager, "ws-1", "item-1")).resolves.toEqual({ kind: "open" })
        reads.claimDecision.mockResolvedValue({ kind: "busy" })
        await expect(service.claimTimeout(manager, "ws-1", "item-1")).resolves.toEqual({ kind: "busy" })
        expect(reads.claimDecision.mock.calls).toEqual([
            [manager, "ws-1", "item-1"],
            [manager, "ws-1", "item-1"],
        ])
        expect(decisions.decidersOf).not.toHaveBeenCalled()
    })

    it("reads the actual recorded principal and approved edits while retaining the caller's transaction", async () => {
        const { service, reads, decisions } = await build([], new Map([["edited", "member-1"]]))
        const manager = mockEntityManager()
        reads.claimDecision.mockResolvedValue({
            kind: "closed",
            item: itemOf({
                id: "edited",
                status: "done",
                decidedBy: "Display name",
                proposal: { summary: "Edited", fields: { args_json: '{"qty":1}' }, draft: "One order" },
            }),
        })
        await expect(service.claimTimeout(manager, "ws-1", "edited")).resolves.toEqual({
            kind: "closed",
            decision: {
                approved: true,
                by: "member-1",
                data: { fields: { args_json: '{"qty":1}' }, draft: "One order" },
            },
        })
        expect(decisions.decidersOf).toHaveBeenCalledWith(["edited"], manager)
    })

    it("keeps an unknown principal null when the locked owner rejected the work", async () => {
        const { service, reads } = await build([], new Map())
        reads.claimDecision.mockResolvedValue({
            kind: "closed",
            item: itemOf({ id: "legacy", status: "rejected", decidedBy: "Display name" }),
        })
        await expect(service.claimTimeout(mockEntityManager(), "ws-1", "legacy")).resolves.toEqual({
            kind: "closed",
            decision: { approved: false, by: null, data: { fields: { items: "tea" }, draft: null } },
        })
    })
})
