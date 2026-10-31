import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "billing_events" })
/** One billing fact of a workspace (a payment settled, a plan changed), appended by the billing functions. */
export class BillingEventEntity extends UuidAbstractEntity {
    /** The workspace it belongs to, when known. */
    @Column({ name: "workspace_id", type: "uuid", nullable: true })
    workspaceId!: string | null

    /** What happened. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The details of the event. */
    @Column({ name: "data", type: "jsonb", default: () => "'{}'::jsonb" })
    data!: Readonly<Record<string, unknown>>
}
