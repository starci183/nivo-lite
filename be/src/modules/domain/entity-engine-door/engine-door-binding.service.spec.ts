import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ModuleJobRunnerService } from "@modules/domain/entity-engine"
import { EngineDoorBindingService } from "./engine-door-binding.service"
import { EngineDoorService } from "./engine-door.service"

describe("EngineDoorBindingService", () => {
    it("hands the door provider to the job runner at boot", async () => {
        const runner = mock<ModuleJobRunnerService>()
        const door = mock<EngineDoorService>()
        let bound: unknown = null
        runner.bindDoor.mockImplementation((provider) => {
            bound = provider
        })
        const moduleRef = await Test.createTestingModule({
            providers: [
                EngineDoorBindingService,
                { provide: ModuleJobRunnerService, useValue: runner },
                { provide: EngineDoorService, useValue: door },
            ],
        }).compile()

        moduleRef.get(EngineDoorBindingService).onModuleInit()

        expect(bound).toBe(door)
    })
})
