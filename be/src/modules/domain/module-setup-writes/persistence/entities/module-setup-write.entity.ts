import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type {
    BranchCardPayload,
    CardResult,
    CardStatus,
    FactCardPayload,
    RuleCardPayload,
} from "../../module-setup-writes.contracts"

@Entity({ schema: "public", name: "module_setup_writes" })
/** One confirm card of the setup chat: one row of `public.module_setup_writes`. */
export class ModuleSetupWriteEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The session it belongs to. */
    @Column({ name: "setup_session_id", type: "uuid" })
    setupSessionId!: string

    /** The owner message it came from. */
    @Column({ name: "source_message_id", type: "uuid", nullable: true })
    sourceMessageId!: string | null

    /** The gate it answers. */
    @Column({ name: "gate_key", type: "text" })
    gateKey!: string

    /** Fact, rule or branch. */
    @Column({ name: "kind", type: "text" })
    kind!: "fact" | "rule" | "branch"

    /** The target: one waiting card per target. */
    @Column({ name: "target_key", type: "text" })
    targetKey!: string

    /** The fact, the rule or the branch proposed. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: FactCardPayload | RuleCardPayload | BranchCardPayload

    /** Where the card stands. */
    @Column({ name: "status", type: "text", default: () => "'proposed'" })
    status!: CardStatus

    /** What the card did once decided. */
    @Column({ name: "result", type: "jsonb", nullable: true })
    result!: CardResult | null

    /** Who decided it. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null

    /** When it was decided. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null
}
