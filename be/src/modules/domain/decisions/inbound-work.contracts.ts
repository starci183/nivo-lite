import type { Origin } from "@modules/domain/work-items"

/** The recorded identity and origin that starts department work; richer channel fields are carried in the proposal seed. */
export interface InboundWorkSource {
    /** The recorded input. */
    readonly id: string
    /** Whether the input is live or simulated. */
    readonly origin: Origin
}
