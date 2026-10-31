import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "hiring_events" })
/** One line of the timeline of a candidate. */
export class HiringEventEntity extends UuidAbstractEntity {
    /** The workspace the event belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The candidate the event is about. */
    @Column({ name: "candidate_id", type: "uuid" })
    candidateId!: string

    /** What kind of event it is. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** Who did it. */
    @Column({ name: "actor", type: "text" })
    actor!: string

    /** The one-line summary. */
    @Column({ name: "summary", type: "text" })
    summary!: string
}
