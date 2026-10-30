import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { CandidateStatus, ShownRow } from "../../office-command-candidates.contracts"

@Entity({ schema: "public", name: "office_command_candidates" })
/** One command the model proposed from an owner's Office message, waiting for the owner to send or cancel it. */
export class OfficeCommandCandidateEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The owner's message the card sits under; one candidate per message. */
    @Column({ name: "message_id", type: "uuid" })
    messageId!: string

    /** The receiving module. */
    @Column({ name: "module", type: "text" })
    module!: string

    /** The command key of the receiver. */
    @Column({ name: "command", type: "text" })
    command!: string

    /** The payload the command will be sent with. */
    @Column({ name: "payload", type: "jsonb", default: () => "'{}'::jsonb" })
    payload!: object

    /** The one line the card shows. */
    @Column({ name: "summary", type: "text", default: () => "''::text" })
    summary!: string

    /** The card rows. */
    @Column({ name: "shown", type: "jsonb", default: () => "'[]'::jsonb" })
    shown!: Array<ShownRow>

    /** Where the candidate stands. */
    @Column({ name: "status", type: "text", default: () => "'pending'::text" })
    status!: CandidateStatus

    /** The work item the command became, once sent. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** Why the last send was refused, or null. */
    @Column({ name: "refusal_detail", type: "text", nullable: true })
    refusalDetail!: string | null

    /** The name of the person who owns the card. */
    @Column({ name: "created_by", type: "text", default: () => "''::text" })
    createdBy!: string

    /** When the owner decided it, or null. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null
}
