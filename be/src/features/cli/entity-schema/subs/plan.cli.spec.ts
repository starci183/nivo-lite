import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EntityPlannerService } from "@modules/domain/entity-planner"
import { PlanCli } from "./plan.cli"

const build = async () => {
    const planner = mock<EntityPlannerService>()
    const moduleRef = await Test.createTestingModule({
        providers: [PlanCli, { provide: EntityPlannerService, useValue: planner }],
    }).compile()
    return { command: moduleRef.get(PlanCli), planner }
}

describe("PlanCli", () => {
    it("hands the flags and stdout to the planner", async () => {
        const { command, planner } = await build()

        await expect(command.run([], { write: true, contract: true })).resolves.toBeUndefined()

        expect(planner.plan).toHaveBeenCalledWith({ write: true, contract: true }, process.stdout)
    })

    it("hands an empty flag set to the planner, which only prints", async () => {
        const { command, planner } = await build()

        await command.run([], {})

        expect(planner.plan).toHaveBeenCalledWith({}, process.stdout)
    })

    it("answers the value of its flags", async () => {
        const { command } = await build()

        expect(command.parseWrite()).toBe(true)
        expect(command.parseContract()).toBe(true)
    })
})
