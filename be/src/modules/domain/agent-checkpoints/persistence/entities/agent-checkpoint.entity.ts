import { Column, Entity, PrimaryColumn } from "typeorm"
import { bigintNumberTransformer } from "@modules/platform/primitives"

@Entity({ schema: "public", name: "agent_checkpoints" })
/** One checkpoint of a LangGraph thread (thread = the run id): the saver's serialised checkpoint without its channel values. */
export class AgentCheckpointEntity {
    /** The workspace the thread belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The thread: the run id. */
    @PrimaryColumn({ name: "thread_id", type: "text" })
    threadId!: string

    /** The checkpoint namespace; empty for the thread's own graph. */
    @PrimaryColumn({ name: "checkpoint_ns", type: "text", default: "" })
    checkpointNs!: string

    /** The checkpoint id; ids of one thread sort by the time they were made. */
    @PrimaryColumn({ name: "checkpoint_id", type: "text" })
    checkpointId!: string

    /** The checkpoint this one continues, or null. */
    @Column({ name: "parent_checkpoint_id", type: "text", nullable: true })
    parentCheckpointId!: string | null

    /** The type tag of the serialisation. */
    @Column({ name: "checkpoint_type", type: "text" })
    checkpointType!: string

    /** The serialised checkpoint. */
    @Column({ name: "checkpoint", type: "bytea" })
    checkpoint!: Buffer

    /** The checkpoint's metadata as plain JSON. */
    @Column({ name: "metadata", type: "jsonb", default: () => "'{}'::jsonb" })
    metadata!: Record<string, unknown>

    /** The lease fence of the driver that wrote the row, or null. */
    @Column({ name: "fence", type: "bigint", nullable: true, transformer: bigintNumberTransformer })
    fence!: number | null

    /** When the row was written; the database sets it. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date
}
