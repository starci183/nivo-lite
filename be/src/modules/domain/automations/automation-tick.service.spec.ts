import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationTickService } from "./automation-tick.service"

const build = async () => {
    const engine = mock<AutomationEngineService>()
    engine.tickNow.mockResolvedValue({ pipelines: 0, runs: 0 })
    const moduleRef = await Test.createTestingModule({
        providers: [AutomationTickService, { provide: AutomationEngineService, useValue: engine }],
    }).compile()
    return { tick: moduleRef.get(AutomationTickService), engine }
}

describe("AutomationTickService", () => {
    it("runs the scheduled engine pass", async () => {
        const { tick, engine } = await build()

        await expect(tick.run()).resolves.toBeUndefined()

        expect(engine.tickNow).toHaveBeenCalledTimes(1)
    })
})
