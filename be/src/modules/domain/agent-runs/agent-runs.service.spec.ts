import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { OPEN, runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunsService } from "./agent-runs.service"

const build = async () => {
    const em = mockEntityManager()
    fakeTransaction(em)
    const store = mock<AgentRunStoreService>()
    store.open.mockResolvedValue(runViewOf())
    store.runById.mockResolvedValue(runViewOf())
    store.runOfWake.mockResolvedValue(runViewOf())
    const container = await Test.createTestingModule({
        providers: [AgentRunsService, { provide: AgentRunStoreService, useValue: store }],
    })
        // Anything else the service may still name is a quiet double: the door reads only the store.
        .useMocker(() => ({}))
        .compile()
    return { service: container.get(AgentRunsService), em, store }
}

describe("AgentRunsService", () => {
    it("opens the one run of a wake through the store, in the caller's transaction", async () => {
        const { service, store, em } = await build()

        await expect(service.open(em, OPEN)).resolves.toMatchObject({ id: "run-1" })
        expect(store.open).toHaveBeenCalledWith(em, OPEN)
    })

    it("answers the run the store holds for an id, and null for none", async () => {
        const { service, store } = await build()

        await expect(service.runOf("ws-1", "run-1")).resolves.toEqual(runViewOf())
        expect(store.runById).toHaveBeenCalledWith("ws-1", "run-1")
        store.runById.mockResolvedValue(null)
        await expect(service.runOf("ws-1", "run-9")).resolves.toBeNull()
    })

    it("answers the id of a wake's run, and null when the wake has none", async () => {
        const { service, store } = await build()

        await expect(service.runIdOfWake("ws-1", "wake-1")).resolves.toBe("run-1")
        expect(store.runOfWake).toHaveBeenCalledWith("ws-1", "wake-1")
        store.runOfWake.mockResolvedValue(null)
        await expect(service.runIdOfWake("ws-1", "wake-9")).resolves.toBeNull()
    })
})
