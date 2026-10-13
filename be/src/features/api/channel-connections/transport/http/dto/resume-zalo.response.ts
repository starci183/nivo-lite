/** The first event a connection accepted. */
export class FirstEventBody {
    /** The amount of the event. */
    amount!: number
    /** The content of the event. */
    content!: string
    /** When it arrived, ISO 8601. */
    at!: string
    /** An optional readable line. */
    text?: string
}

/** The HTTP response of the ResumeZalo operation. */
export class ResumeZaloResponse {
    /** The id. */
    id!: string
    /** The name. */
    name!: string
    /** The status. */
    status!: string
    /** The webhookUrl. */
    webhookUrl!: string
    /** The callbackUrl. */
    callbackUrl!: string
    /** The authorized. */
    authorized!: boolean
    /** The oaSecretSaved. */
    oaSecretSaved!: boolean
    /** The oaId. */
    oaId!: string
    /** The firstEvent. */
    firstEvent!: FirstEventBody | null
    /** The agentIds. */
    agentIds!: ReadonlyArray<string>
}
