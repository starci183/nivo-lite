import { Column, Entity, PrimaryColumn } from "typeorm"
import { AbstractEntity } from "../../abstract.entity"

@Entity({ schema: "public", name: "http_security" })
/** One fixed rate-limit window shared by every API and MCP replica: one row of `public.http_security`. */
export class HttpSecurityEntity extends AbstractEntity {
    /** The caller key the window counts. */
    @PrimaryColumn({ name: "bucket_key", type: "text" })
    bucketKey!: string

    /** The hits counted in the window, bigint text. */
    @Column({ name: "hits", type: "bigint" })
    hits!: string

    /** When the window ends, by the database clock. */
    @Column({ name: "reset_at", type: "timestamptz" })
    resetAt!: Date
}
