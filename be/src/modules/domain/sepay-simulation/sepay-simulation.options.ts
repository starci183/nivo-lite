import type { Type } from "@nestjs/common"
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

/** Posts one delivery. */
export type SimulationPost = (delivery: SimulationDelivery) => Promise<SimulationReply>

/** The integration transport the composition root supplies for a simulated delivery. */
export interface SimulationPoster {
    /** Posts the serialized webhook and returns the api's status and response text. */
    readonly post: SimulationPost
}

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

/** The runtime settings and transport class the cli composition root registers. */
export interface SepaySimulationRegistration extends Omit<SepaySimulationOptions, "post"> {
    /** The integration class that implements the simulated delivery transport. */
    readonly poster: Type<SimulationPoster>
}

/** The environment settings before the app binds delivery and operator output. */
export type SepaySimulationConfig = Pick<SepaySimulationOptions, "apiKey" | "bankCode" | "bankAccount" | "url">
