import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { JobOpsTickService } from "@modules/domain/job-ops"
import { TickJobsCli } from "./tick.cli"

const build = async () => {
    const ticks = mock<JobOpsTickService>()
    const moduleRef = await Test.createTestingModule({
        providers: [TickJobsCli, { provide: JobOpsTickService, useValue: ticks }],
    }).compile()
    return { cli: moduleRef.get(TickJobsCli), ticks }
}

describe("TickJobsCli", () => {
    it.each([
        { params: ["automation-tick"], id: "automation-tick" },
        { params: [], id: "" },
    ])("delegates the id for validation: $id", async ({ params, id }) => {
        const { cli, ticks } = await build()
        await cli.run(params)
        expect(ticks.tick).toHaveBeenCalledTimes(1)
        expect(ticks.tick).toHaveBeenCalledWith(id)
    })

    it("propagates enqueue failures", async () => {
        const { cli, ticks } = await build()
        const failure = new Error("enqueue refused")
        ticks.tick.mockRejectedValue(failure)
        await expect(cli.run(["content-tick"])).rejects.toBe(failure)
    })
})
