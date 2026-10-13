import { CommandRunner, Option, SubCommand } from "nest-commander"
import { SepaySimulationService } from "@modules/domain/sepay-simulation"
import type { SimulationFlags } from "@modules/domain/sepay-simulation"

@SubCommand({
    name: "run",
    description: "Post a SePay credit for an order code: run <orderCode> [amount] [--id N] [--url U] [--out]",
    arguments: "<orderCode> [amount]",
})
/** `cli simulate-sepay run <orderCode> [amount]`: sends one simulated bank credit (or debit with --out) to the billing webhook. */
export class RunSimulateSepayCli extends CommandRunner {
    constructor(private readonly simulation: SepaySimulationService) {
        super()
    }

    /** Hands the arguments and flags to the simulation; a refusal fails the command. */
    run(passedParams: Array<string>, options: SimulationFlags = {}): Promise<void> {
        return this.simulation.run(passedParams, options)
    }

    /** SePay transaction id; repeating an id repeats a delivery. */
    @Option({ flags: "--id <id>", description: "SePay transaction id; reuse it to repeat a delivery" })
    parseId(value: string): string {
        return value
    }

    /** The webhook url. */
    @Option({ flags: "--url <url>", description: "Webhook url instead of SEPAY_SIMULATE_URL" })
    parseUrl(value: string): string {
        return value
    }

    /** Sends a debit, which the door must ignore. */
    @Option({ flags: "--out", description: "Send transferType out (must be ignored)" })
    sendDebit(): boolean {
        return true
    }
}
