import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { SepaySimulationError, SepaySimulationErrorCode } from "./errors/sepay-simulation.error"
import { payloadOf } from "./sepay-payload.policy"
import type { SimulationFlags } from "./sepay-simulation.contracts"
import { InjectSepaySimulationOptions } from "./sepay-simulation.decorators"
import type { SepaySimulationOptions } from "./sepay-simulation.options"

@Injectable()
/** Posts one realistic SePay webhook delivery to a running api and prints what it answered. */
export class SepaySimulationService {
    constructor(
        @InjectSepaySimulationOptions() private readonly options: SepaySimulationOptions,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /**
     * Sends the delivery the command arguments describe (`<orderCode> [amount]` plus the flags) and prints the answer. Refuses
     * when SEPAY_WEBHOOK_API_KEY or the order code is missing, and when the api does not accept the delivery.
     */
    async run(params: ReadonlyArray<string>, flags: SimulationFlags): Promise<void> {
        const [orderCode, amount] = params
        if (orderCode === undefined) throw new SepaySimulationError({ code: SepaySimulationErrorCode.OrderCodeMissing })
        if (this.options.apiKey === undefined)
            throw new SepaySimulationError({ code: SepaySimulationErrorCode.KeyMissing })
        const body = payloadOf(
            {
                orderCode,
                amount: Number(amount ?? 0),
                transactionId: flags.id === undefined ? undefined : Number(flags.id),
                debit: flags.out === true,
            },
            this.options,
            this.clock.now(),
        )
        const reply = await this.options.post({
            url: flags.url ?? this.options.url,
            headers: { "Content-Type": "application/json", Authorization: `Apikey ${this.options.apiKey.reveal()}` },
            body: JSON.stringify(body),
        })
        this.options.print(`${reply.status} ${reply.text}`)
        this.options.print(`sent id=${body.id} content="${body.content}" amount=${body.transferAmount}`)
        if (reply.status < 200 || reply.status >= 300) {
            throw new SepaySimulationError({ code: SepaySimulationErrorCode.Refused, params: { status: reply.status } })
        }
    }
}
