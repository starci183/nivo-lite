import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { SepaySimulationService } from "@modules/domain/sepay-simulation"
import { RunSimulateSepayCli } from "./run.cli"

const build = async () => {
    const simulation = mock<SepaySimulationService>()
    simulation.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [RunSimulateSepayCli, { provide: SepaySimulationService, useValue: simulation }],
    }).compile()
    return { command: moduleRef.get(RunSimulateSepayCli), simulation }
}

describe("RunSimulateSepayCli", () => {
    it("passes the order, amount, and flags to the simulation once", async () => {
        const { command, simulation } = await build()

        await expect(
            command.run(["NIVO8F3K2", "299000"], {
                id: "42",
                url: "http://localhost:3000/billing/webhook",
                out: true,
            }),
        ).resolves.toBeUndefined()

        expect(simulation.run).toHaveBeenCalledTimes(1)
        expect(simulation.run).toHaveBeenCalledWith(["NIVO8F3K2", "299000"], {
            id: "42",
            url: "http://localhost:3000/billing/webhook",
            out: true,
        })
    })

    it("defaults to empty flags when none are supplied", async () => {
        const { command, simulation } = await build()

        await expect(command.run(["NIVO8F3K2"])).resolves.toBeUndefined()

        expect(simulation.run).toHaveBeenCalledTimes(1)
        expect(simulation.run).toHaveBeenCalledWith(["NIVO8F3K2"], {})
    })

    it("fails with the simulation's refusal", async () => {
        const { command, simulation } = await build()
        const refusal = new Error("webhook refused the delivery")
        simulation.run.mockRejectedValue(refusal)

        await expect(command.run(["NIVO8F3K2"], {})).rejects.toBe(refusal)

        expect(simulation.run).toHaveBeenCalledTimes(1)
        expect(simulation.run).toHaveBeenCalledWith(["NIVO8F3K2"], {})
    })

    it("keeps the transaction id and webhook url exactly as supplied and enables debit deliveries", async () => {
        const { command, simulation } = await build()

        expect(command.parseId("0042")).toBe("0042")
        expect(command.parseUrl("http://localhost:3000/billing/webhook?retry=1")).toBe(
            "http://localhost:3000/billing/webhook?retry=1",
        )
        expect(command.sendDebit()).toBe(true)
        expect(simulation.run).not.toHaveBeenCalled()
    })
})
