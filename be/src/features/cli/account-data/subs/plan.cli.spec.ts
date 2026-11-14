import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AccountDataPlanService } from "@modules/domain/account-data"
import { PlanAccountDataCli } from "./plan.cli"

const build = async () => {
    const planner = mock<AccountDataPlanService>()
    planner.print.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [PlanAccountDataCli, { provide: AccountDataPlanService, useValue: planner }],
    }).compile()
    return { command: moduleRef.get(PlanAccountDataCli), planner }
}

describe("PlanAccountDataCli", () => {
    it("hands stdout to the planner, which prints the plan as JSON", async () => {
        const { command, planner } = await build()

        await expect(command.run()).resolves.toBeUndefined()

        expect(planner.print).toHaveBeenCalledWith(process.stdout)
    })

    it("answers the value of its flag", async () => {
        const { command } = await build()

        expect(command.parseJson()).toBe(true)
    })
})
