import { Injectable } from "@nestjs/common"
import { HttpError, InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import type { SimulationWebhookDelivery, SimulationWebhookReply } from "./simulation-post.contracts"

/** How long the operator's simulated delivery waits for the api. */
const SIMULATION_TIMEOUT_MS = 15_000

@Injectable()
/** Posts a simulated webhook's already serialized body and keeps the api's response as text. */
export class SimulationPostClient {
    constructor(@InjectHttpClient() private readonly http: HttpClient) {}

    /** Sends the operator's delivery once, preserving the original transport failure when no reply arrives. */
    async post(delivery: SimulationWebhookDelivery): Promise<SimulationWebhookReply> {
        const reply = await this.http
            .request({
                method: "POST",
                url: delivery.url,
                headers: Object.fromEntries(
                    Object.entries(delivery.headers).map(([name, value]) => [name.toLowerCase(), value]),
                ),
                bytes: Buffer.from(delivery.body),
                read: "text",
                timeoutMs: SIMULATION_TIMEOUT_MS,
            })
            .catch((cause: unknown) => Promise.reject(cause instanceof HttpError ? cause.cause : cause))
        return { status: reply.status, text: typeof reply.body === "string" ? reply.body : "" }
    }
}
