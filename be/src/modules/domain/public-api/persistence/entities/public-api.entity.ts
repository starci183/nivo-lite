import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

/** What a ledger row asks for. */
export type PublicApiKind = "lead" | "message" | "knowledge"

@Entity({ schema: "public", name: "public_api" })
/** One accepted public API request, once per dedupe key: one row of `public.public_api`. */
export class PublicApiEntity extends UuidAbstractEntity {
    /** The workspace of the key. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The API key that sent it. */
    @Column({ name: "key_id", type: "uuid" })
    keyId!: string

    /** The admitted request kind. */
    @Column({ name: "kind", type: "text" })
    kind!: PublicApiKind

    /** The prefix and the suffix that make one request, unique per workspace. */
    @Column({ name: "dedupe_key", type: "text" })
    dedupeKey!: string

    /** The original body, validated again at consumption. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: unknown

    /** The resolved customer, if already known. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** How many times the same request was sent again. */
    @Column({ name: "duplicates", type: "integer", default: () => "0" })
    duplicates!: number

    /** Durable fulfillment has committed when this is nonnull. */
    @Column({ name: "processed_at", type: "timestamptz", nullable: true })
    processedAt!: Date | null

    /** Nonempty need presence, or NULL for historical admissions. */
    @Column({ name: "need_supplied", type: "boolean", nullable: true })
    needSupplied!: boolean | null
}
