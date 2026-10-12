/** The HTTP response of the CheckConnection operation. */
export class CheckConnectionResponse {
    /** The provider. */
    provider!: string
    /** The webhookOk. */
    webhookOk!: boolean
    /** The localOnly. */
    localOnly!: boolean
    /** The pending. */
    pending!: number
    /** The lastError. */
    lastError!: string | null
}
