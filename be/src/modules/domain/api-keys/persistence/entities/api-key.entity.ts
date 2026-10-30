import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "api_keys" })
/** A workspace API key, stored by its hash; an agent key is bound to one agent and carries only the agent scopes. */
export class ApiKeyEntity extends UuidAbstractEntity {
    /** The workspace that owns the key. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The key display name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The visible key prefix. */
    @Column({ name: "key_prefix", type: "text" })
    keyPrefix!: string

    /** The hash used to authenticate the key. */
    @Column({ name: "key_hash", type: "text" })
    keyHash!: string

    /** The scopes granted to the key. */
    @Column({
        name: "scopes",
        type: "text",
        array: true,
        default: () =>
            "'{leads:read,leads:write,messages:write,knowledge:write,events:read,loyalty:read,loyalty:write}'::text[]",
    })
    scopes!: Array<string>

    /** The user who created the key, or null. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null

    /** When the key was last used, or null. */
    @Column({ name: "last_used_at", type: "timestamptz", nullable: true })
    lastUsedAt!: Date | null

    /** When the key was revoked, or null. */
    @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
    revokedAt!: Date | null

    /** The agent the key acts as on the MCP endpoint, or null for a public API key. */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null
}
