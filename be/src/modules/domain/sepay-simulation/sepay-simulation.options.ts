import type { InjectionToken } from "@nestjs/common"
import type { Secret } from "@modules/platform/config"

/** What a delivery to the webhook answered. */
export interface SimulationReply {
    /** The HTTP status. */
    readonly status: number
    /** The response body. */
    readonly text: string
}

/** One JSON delivery to post. */
export interface SimulationDelivery {
    /** The url. */
    readonly url: string
    /** The request headers. */
    readonly headers: Readonly<Record<string, string>>
    /** The JSON body. */
    readonly body: string
}

/** Posts one delivery through the integration composed by the cli. */
export type SimulationPost = (delivery: SimulationDelivery) => Promise<SimulationReply>

/** The simulated SePay delivery: the key SePay would sign with, the account it reports and where it posts. */
export interface SepaySimulationOptions {
    /** The API key of the billing webhook; undefined makes the simulation refuse to run. */
    readonly apiKey: Secret | undefined
    /** The bank gateway name the payload carries. */
    readonly bankCode: string
    /** The account number the payload carries. */
    readonly bankAccount: string
    /** The webhook url deliveries go to unless the command names another. */
    readonly url: string
    /** Posts the delivery. */
    readonly post: SimulationPost
    /** Prints one line to the operator. */
    readonly print: (line: string) => void
}

/** The simulation settings and the provider token of the delivery callback composed by the cli. */
export interface SepaySimulationRegistrationOptions extends Omit<SepaySimulationOptions, "post"> {
    /** The provider token of the integration's delivery callback. */
    readonly post: InjectionToken<SimulationPost>
}
