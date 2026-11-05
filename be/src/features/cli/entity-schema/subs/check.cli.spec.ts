import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EntityPlannerService } from "@modules/domain/entity-planner"
import { CheckCli } from "./check.cli"

describe("CheckCli", () => {
    it("checks once with stdout and propagates the refusal of the planner", async () => {
        const planner = mock<EntityPlannerService>()
        const moduleRef = await Test.createTestingModule({
            providers: [CheckCli, { provide: EntityPlannerService, useValue: planner }],
        }).compile()
        const command = moduleRef.get(CheckCli)

        await expect(command.run()).resolves.toBeUndefined()
        expect(planner.check).toHaveBeenCalledWith(process.stdout)

        planner.check.mockRejectedValue(new Error("not empty"))
        await expect(command.run()).rejects.toThrow("not empty")
    })
})
