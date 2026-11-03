import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "graph_node_effects" })
/**
 * The ledger of the effects graph nodes ran: one row per key in a workspace, the run step's own call key or the node's business
 * dedupe key, with the subject the first run touched. A repeat of a key answers that subject and acts no more.
 */
export class GraphNodeEffectEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** `call:<run step key>:<order>` or `dedupe:<business key>`; unique in the workspace. */
    @Column({ name: "ledger_key", type: "text" })
    ledgerKey!: string

    /** The effect id. */
    @Column({ name: "effect", type: "text" })
    effect!: string

    /** The kind of the subject it touched. */
    @Column({ name: "subject_kind", type: "text" })
    subjectKind!: string

    /** The id of the subject it touched. */
    @Column({ name: "subject_id", type: "text" })
    subjectId!: string
}
