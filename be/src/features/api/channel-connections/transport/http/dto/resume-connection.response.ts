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

/** The HTTP response of the ResumeConnection operation. */
export class ResumeConnectionResponse {
    /** The id. */
    id!: string
    /** The provider. */
    provider!: string
    /** The name. */
    name!: string
    /** The environment. */
    environment!: string
    /** The status. */
    status!: string
    /** The webhookUrl. */
    webhookUrl!: string
    /** The apiKey. */
    apiKey!: string
    /** The bankCode. */
    bankCode!: string
    /** The account. */
    account!: string
    /** The holder. */
    holder!: string
    /** The credentialsSaved. */
    credentialsSaved!: boolean
    /** The firstEvent. */
    firstEvent!: FirstEventBody | null
    /** The agentIds. */
    agentIds!: ReadonlyArray<string>
}
