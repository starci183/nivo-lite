import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

/** How a recorded send attempt ended or waits. */
export type EmailMessageStatus = "sent" | "failed" | "no_smtp" | "blocked" | "rate_limited" | "waiting_decision"

/** Which sender carried the message. */
export type EmailMessageVia = "workspace" | "platform" | "none"

/** The records an email points at, as stored JSON. */
export interface EmailMessageRefs {
    /** One reference (invoice id, order id, work item id ...). */
    [name: string]: string | number | boolean | null | object
}

@Entity({ schema: "public", name: "email_messages" })
/** One send attempt of a workspace's email. */
export class EmailMessageEntity extends UuidAbstractEntity {
    /** The workspace that sent it. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The connection it went through, when there is one. */
    @Column({ name: "connection_id", type: "uuid", nullable: true })
    connectionId!: string | null

    /** The recipient. */
    @Column({ name: "to_address", type: "text" })
    toAddress!: string

    /** The subject. */
    @Column({ name: "subject", type: "text", default: () => "''::text" })
    subject!: string

    /** What the email is for. */
    @Column({ name: "purpose", type: "text", default: () => "''::text" })
    purpose!: string

    /** How the attempt ended. */
    @Column({ name: "status", type: "text" })
    status!: EmailMessageStatus

    /** The sender that carried it. */
    @Column({ name: "via", type: "text", default: () => "'workspace'::text" })
    via!: EmailMessageVia

    /** The id the provider answered, when it did. */
    @Column({ name: "provider_message_id", type: "text", nullable: true })
    providerMessageId!: string | null

    /** The failure text, when it failed. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** The records the email points at. */
    @Column({ name: "refs", type: "jsonb", default: () => "'{}'::jsonb" })
    refs!: EmailMessageRefs
}
