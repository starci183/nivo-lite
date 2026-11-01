import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkItemsService } from "@modules/domain/work-items"
import { AgentRunItemVerdictsService } from "./agent-run-item-verdicts.service"

const item = (id: string, status: string) => ({ id, status })

const build = async (found: ReadonlyArray<{ readonly id: string; readonly status: string }>) => {
    const items = mock<WorkItemsService>({ findMany: jest.fn().mockResolvedValue(found) })
    const container = await Test.createTestingModule({
        providers: [AgentRunItemVerdictsService, { provide: WorkItemsService, useValue: items }],
    }).compile()
    return { service: container.get(AgentRunItemVerdictsService), items }
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
            ["a", { approved: true, by: "recovered" }],
            ["b", { approved: false, by: "recovered" }],
        ])
    })

    it("reads nothing for no ids", async () => {
        const { service, items } = await build([])

        await expect(service.verdictsOf([])).resolves.toEqual(new Map())
        expect(items.findMany).not.toHaveBeenCalled()
    })
})
