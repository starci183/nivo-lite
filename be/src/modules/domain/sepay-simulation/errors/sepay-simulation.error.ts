import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the SePay simulation. */
export enum SepaySimulationErrorCode {
    /** SEPAY_WEBHOOK_API_KEY is not set, so nothing can be signed. */
    KeyMissing = "SEPAY_SIMULATION_KEY_MISSING",
    /** The api did not accept the delivery. */
    Refused = "SEPAY_SIMULATION_REFUSED",
    /** The command did not get an order code. */
    OrderCodeMissing = "SEPAY_SIMULATION_ORDER_CODE_MISSING",
}

/** How each simulation code travels. */
export const SEPAY_SIMULATION_ERROR_KINDS: Record<SepaySimulationErrorCode, ErrorKind> = {
    [SepaySimulationErrorCode.KeyMissing]: "unavailable",
    [SepaySimulationErrorCode.Refused]: "unavailable",
    [SepaySimulationErrorCode.OrderCodeMissing]: "invalid",
}

/** The one error class of the SePay simulation. */
export class SepaySimulationError extends DomainError<SepaySimulationErrorCode> {}
