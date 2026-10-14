import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the simulated SePay HTTP delivery. */
export enum SepaySimulationHttpErrorCode {
    /** The webhook could not be reached or its reply could not be read before the deadline. */
    DeliveryFailed = "SEPAY_SIMULATION_HTTP_DELIVERY_FAILED",
}

/** How a failed simulated delivery travels. */
export const SEPAY_SIMULATION_HTTP_ERROR_KINDS: Record<SepaySimulationHttpErrorCode, ErrorKind> = {
    [SepaySimulationHttpErrorCode.DeliveryFailed]: "unavailable",
}

/** The one error class of the simulated SePay HTTP delivery. */
export class SepaySimulationHttpError extends DomainError<SepaySimulationHttpErrorCode> {}
