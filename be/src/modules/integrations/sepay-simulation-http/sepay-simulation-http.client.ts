import { Injectable } from "@nestjs/common"
import { HttpError, HttpErrorCode, InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { SepaySimulationHttpError, SepaySimulationHttpErrorCode } from "./errors/sepay-simulation-http.error"
import type { SepaySimulationDelivery, SepaySimulationReply } from "./sepay-simulation-http.contracts"
import { InjectSepaySimulationHttpOptions } from "./sepay-simulation-http.decorators"
import type { SepaySimulationHttpOptions } from "./sepay-simulation-http.options"

@Injectable()
/** Sends the simulated SePay JSON delivery and keeps the api's status and text for the operator. */
export class SepaySimulationHttpClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectSepaySimulationHttpOptions() private readonly options: SepaySimulationHttpOptions,
    ) {}

    /** Posts the body exactly as supplied and reads the webhook's answer as text. */
    async post(delivery: SepaySimulationDelivery): Promise<SepaySimulationReply> {
        const response = await this.http
            .request({
                method: "POST",
                url: delivery.url,
                headers: Object.fromEntries(
                    Object.entries(delivery.headers).map(([name, value]) => [name.toLowerCase(), value]),
                ),
                bytes: Buffer.from(delivery.body, "utf8"),
                read: "text",
                timeoutMs: this.options.timeoutMs,
            })
            .catch((cause: unknown) => {
                if (
                    cause instanceof HttpError &&
                    (cause.code === HttpErrorCode.Network || cause.code === HttpErrorCode.Timeout) &&
                    cause.cause !== undefined
                ) {
                    throw new SepaySimulationHttpError({ code: SepaySimulationHttpErrorCode.DeliveryFailed, cause })
                }
                throw cause
            })
        return { status: response.status, text: typeof response.body === "string" ? response.body : "" }
    }
}
