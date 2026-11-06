import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { RunIn, ScopedTx } from "@modules/domain/entity-engine"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import { ChatEntitiesService } from "./chat-entities.service"

describe("ChatEntitiesService", () => {
    it("runs the work in one scoped transaction over a handle bound to that transaction", async () => {
        const tx = mock<ScopedTx>()
        const engine = mock<EntityEngineService>()
        engine.scoped.mockImplementation((_workspace, work) => work(tx))
        const api = mock<EntitiesApi>()
        const ports = mock<EntityPortsService>()
        const bound: Array<RunIn> = []
        ports.entitiesApi.mockImplementation((runIn) => {
            bound.push(runIn)
            return api
        })
        const moduleRef = await Test.createTestingModule({
            providers: [
                ChatEntitiesService,
                { provide: EntityEngineService, useValue: engine },
                { provide: EntityPortsService, useValue: ports },
            ],
        }).compile()
        const result = await moduleRef.get(ChatEntitiesService).run("ws-1", (handle) => Promise.resolve(handle === api))
        expect(result).toBe(true)
        expect(await bound[0]?.((given) => Promise.resolve(given === tx))).toBe(true)
        expect(engine.scoped).toHaveBeenCalledWith("ws-1", expect.any(Function))
        expect(ports.entitiesApi).toHaveBeenCalledWith(expect.any(Function), "job")
    })
})
