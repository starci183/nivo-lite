import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainPolicyDerivationsService } from "@modules/domain/brain"
import { BackfillBrainPoliciesCli } from "./backfill.cli"

const build = async () => {
    const derivations = mock<BrainPolicyDerivationsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [BackfillBrainPoliciesCli, { provide: BrainPolicyDerivationsService, useValue: derivations }],
    }).compile()
    return { command: moduleRef.get(BackfillBrainPoliciesCli), derivations }
}

describe("BackfillBrainPoliciesCli", () => {
    it("hands the limit as typed and stdout to the derivations", async () => {
        const { command, derivations } = await build()
        derivations.backfillFor.mockResolvedValue(3)

        await expect(command.run([], { limit: "50" })).resolves.toBeUndefined()

        expect(derivations.backfillFor.mock.calls).toEqual([[process.stdout, "50"]])
    })

    it("leaves the limit to the derivations when none is given", async () => {
        const { command, derivations } = await build()

        await command.run([])

        expect(derivations.backfillFor.mock.calls).toEqual([[process.stdout, undefined]])
    })

    it("propagates a failure of the backfill", async () => {
        const { command, derivations } = await build()
        const failure = new Error("database unavailable")
        derivations.backfillFor.mockRejectedValue(failure)

        await expect(command.run([], {})).rejects.toBe(failure)
    })

    it("reads the limit flag as typed", async () => {
        const { command } = await build()

        expect(command.parseLimit("25")).toBe("25")
    })
})
