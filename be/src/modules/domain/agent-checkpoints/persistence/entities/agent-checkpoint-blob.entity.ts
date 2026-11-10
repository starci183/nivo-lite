import { Column, Entity, PrimaryColumn } from "typeorm"
import { bigintNumberTransformer } from "@modules/platform/primitives"

@Entity({ schema: "public", name: "agent_checkpoint_blobs" })
/** The value one channel of a thread held at one version; written once, shared by every checkpoint that names the version. */
export class AgentCheckpointBlobEntity {
    /** The workspace the thread belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The thread. */
    @PrimaryColumn({ name: "thread_id", type: "text" })
    threadId!: string

    /** The checkpoint namespace. */
    @PrimaryColumn({ name: "checkpoint_ns", type: "text", default: "" })
    checkpointNs!: string

    /** The channel. */
    @PrimaryColumn({ name: "channel", type: "text" })
    channel!: string

    /** The channel version, as text. */
    @PrimaryColumn({ name: "version", type: "text" })
    version!: string

    /** The type tag of the serialisation. */
    @Column({ name: "value_type", type: "text" })
    valueType!: string

    /** The serialised value. */
    @Column({ name: "value", type: "bytea" })
    value!: Buffer

    /** The lease fence of the driver that wrote the row, or null. */
    @Column({ name: "fence", type: "bigint", nullable: true, transformer: bigintNumberTransformer })
    fence!: number | null

    /** When the row was written; the database sets it. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date
}
