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

/** One connection of a workspace, without any secret. */
export class ConnectionBody {
    /** The id of the connection. */
    id!: string
    /** The workspace that owns it. */
    workspaceId!: string
    /** The provider it connects to. */
    provider!: string
    /** The name the owner gave it. */
    name!: string
    /** Non-secret facts. */
    meta!: Record<string, string>
    /** Where the connection is in its life. */
    status!: string
    /** The last failure shown to the owner, if any. */
    lastError!: string | null
    /** Test or live. */
    environment!: string
    /** SMTP only: the workspace default sender. */
    isDefault!: boolean
    /** When the last event arrived, ISO 8601. */
    lastEventAt!: string | null
    /** The first event the connection accepted. */
    firstEvent!: FirstEventBody | null
    /** Who created it. */
    createdBy!: string | null
    /** When it was created, ISO 8601. */
    createdAt!: string
}

/** The HTTP response of the ConnectTelegram operation. */
export class ConnectTelegramResponse {
    /** The connection. */
    connection!: ConnectionBody
    /** The webhookRegistered. */
    webhookRegistered!: boolean
}
