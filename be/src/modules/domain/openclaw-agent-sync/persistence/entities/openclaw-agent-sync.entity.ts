import { Column, Entity, PrimaryColumn } from "typeorm"

import { AbstractEntity } from "@modules/platform/database"

/** The meta of one file written into the OpenClaw workspace of an agent. */
export interface OpenclawSyncFileMeta {
    /** The path relative to the workspace. */
    readonly path: string
    /** The size in bytes. */
    readonly bytes: number
    /** The SHA-256 of the content. */
    readonly sha256: string
}

@Entity({ schema: "public", name: "openclaw_agent_sync" })
/** The OpenClaw copy of the agent of an installation: one row of `public.openclaw_agent_sync`. */
export class OpenclawAgentSyncEntity extends AbstractEntity {
    /** The installation. */
    @PrimaryColumn({ name: "installation_id", type: "uuid" })
    installationId!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The OpenClaw agent id. */
    @Column({ name: "agent_id", type: "text" })
    agentId!: string

    /** The context version the files were built from. */
    @Column({ name: "context_version", type: "integer", nullable: true })
    contextVersion!: number | null

    /** The hash over the files last written. */
    @Column({ name: "content_hash", type: "text", nullable: true })
    contentHash!: string | null

    /** When the files were last rewritten. */
    @Column({ name: "synced_at", type: "timestamptz", nullable: true })
    syncedAt!: Date | null

    /** When the copy was last checked. */
    @Column({ name: "checked_at", type: "timestamptz", default: () => "now()" })
    checkedAt!: Date

    /** ok or error. */
    @Column({ name: "status", type: "text", default: () => "'ok'" })
    status!: "ok" | "error"

    /** The last failure. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** The meta of the files last written. */
    @Column({ name: "files", type: "jsonb", default: () => "'[]'::jsonb" })
    files!: ReadonlyArray<OpenclawSyncFileMeta>
}
