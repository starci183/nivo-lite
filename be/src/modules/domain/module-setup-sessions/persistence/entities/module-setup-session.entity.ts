import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { DraftSnapshot, GateEvidence } from "@modules/domain/module-context-versions"
import type { SetupSessionStatus } from "../../module-setup-sessions.contracts"

@Entity({ schema: "public", name: "module_setup_sessions" })
/** One draft session of the setup chat of an installation: one row of `public.module_setup_sessions`. */
export class ModuleSetupSessionEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The installation. */
    @Column({ name: "installation_id", type: "uuid" })
    installationId!: string

    /** The revision, from 1. */
    @Column({ name: "revision", type: "integer", default: () => "1" })
    revision!: number

    /** Where the session stands. */
    @Column({ name: "status", type: "text", default: () => "'draft'" })
    status!: SetupSessionStatus

    /** The draft being built in the chat. */
    @Column({ name: "draft_snapshot", type: "jsonb", default: () => `'{"facts": [], "summary": ""}'::jsonb` })
    draftSnapshot!: DraftSnapshot

    /** The evidence per gate. */
    @Column({ name: "gate_evidence", type: "jsonb", default: () => "'{}'::jsonb" })
    gateEvidence!: GateEvidence
}
