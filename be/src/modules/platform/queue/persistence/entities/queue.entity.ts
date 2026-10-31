import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "queue" })
/** One row of the legacy public.queue outbox: a payload for a named queue, unsent until the relay stamps sent_at. Nothing writes it any more; the table stays mapped so no table lacks an entity. */
export class QueueEntity extends UuidAbstractEntity {
    /** The queue the payload was written for. */
    @Column({ name: "queue", type: "varchar", length: 200 })
    queue!: string

    /** The payload the producer wrote. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: object

    /** When the relay sent it, or null while it is unsent. */
    @Column({ name: "sent_at", type: "timestamptz", nullable: true })
    sentAt!: Date | null
}
