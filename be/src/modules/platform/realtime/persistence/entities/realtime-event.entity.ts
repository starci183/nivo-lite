import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "realtime_events" })
/** One retained frame of a realtime topic: the replay row a reconnecting client reads and a notification names. */
export class RealtimeEventEntity extends AbstractEntity {
    /** The global sequence number of the row: the order of publication and the key a notification names (a bigint, so text). */
    @PrimaryGeneratedColumn("identity", { name: "seq", type: "bigint", generatedIdentity: "ALWAYS" })
    seq!: string

    /** The topic the frame was published to. */
    @Column({ name: "topic", type: "text" })
    topic!: string

    /** The frame id the client resumes after, or null. */
    @Column({ name: "event_id", type: "text", nullable: true })
    eventId!: string | null

    /** The frame, as the database returns the jsonb value. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: object
}
