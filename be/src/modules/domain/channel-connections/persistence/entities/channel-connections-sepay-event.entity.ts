import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "channel_connections_sepay_events" })
/** One row of public.channel_connections_sepay_events: a delivery the SePay webhook door answered. */
export class ChannelConnectionsSepayEventEntity extends UuidAbstractEntity {
    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The SePay connection that received the delivery. */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** When the delivery arrived. */
    @Column({ name: "received_at", type: "timestamptz", default: () => "now()" })
    receivedAt!: Date

    /** The outcome: accepted, duplicate or unauthorized. */
    @Column({ name: "outcome", type: "text" })
    outcome!: "accepted" | "duplicate" | "unauthorized"

    /** The kind: credit, debit or ping. */
    @Column({ name: "kind", type: "text" })
    kind!: "credit" | "debit" | "ping"

    /** The amount in VND, as the driver answers a bigint; null for a ping or a refused key. */
    @Column({ name: "amount_vnd", type: "bigint", nullable: true })
    amountVnd!: string | null

    /** The SePay transaction id, when there is one. */
    @Column({ name: "provider_event_id", type: "text", nullable: true })
    providerEventId!: string | null

    /** The environment of the connection: test or live. */
    @Column({ name: "environment", type: "text" })
    environment!: "test" | "live"
}
