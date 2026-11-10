import { Column, Entity, PrimaryColumn } from "typeorm"
import { bigintNumberTransformer } from "@modules/platform/primitives"

@Entity({ schema: "public", name: "agent_checkpoint_writes" })
/** One pending write of a checkpoint: what a task of the next super-step wrote; a finished task is replayed from these rows. */
export class AgentCheckpointWriteEntity {
    /** The workspace the thread belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The thread. */
    @PrimaryColumn({ name: "thread_id", type: "text" })
    threadId!: string

    /** The checkpoint namespace. */
    @PrimaryColumn({ name: "checkpoint_ns", type: "text", default: "" })
    checkpointNs!: string

    /** The checkpoint the write is pending on. */
    @PrimaryColumn({ name: "checkpoint_id", type: "text" })
    checkpointId!: string

    /** The task that wrote. */
    @PrimaryColumn({ name: "task_id", type: "text" })
    taskId!: string

    /** The position of the write in its task; negative for the library's special writes. */
    @PrimaryColumn({ name: "idx", type: "integer" })
    idx!: number

    /** The channel written. */
    @Column({ name: "channel", type: "text" })
    channel!: string

    /** The type tag of the serialisation. */
    @Column({ name: "value_type", type: "text" })
    valueType!: string

    /** The serialised value. */
    @Column({ name: "value", type: "bytea" })
    value!: Buffer

    /** The path of the task; empty when the library gave none. */
    @Column({ name: "task_path", type: "text", default: "" })
    taskPath!: string

    /** The lease fence of the driver that wrote the row, or null. */
    @Column({ name: "fence", type: "bigint", nullable: true, transformer: bigintNumberTransformer })
    fence!: number | null

    /** When the row was written; the database sets it. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date
}
