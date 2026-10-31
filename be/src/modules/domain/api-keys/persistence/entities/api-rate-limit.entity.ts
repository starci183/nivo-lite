import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "api_rate_limits" })
/** The hits of one API key inside one minute window; public.api_rate_hit counts them and sweeps old windows. */
export class ApiRateLimitEntity extends AbstractEntity {
    /** The API key the hits count against. */
    @PrimaryColumn({ name: "key_id", type: "uuid" })
    keyId!: string

    /** The start of the minute window. */
    @PrimaryColumn({ name: "window_start", type: "timestamptz" })
    windowStart!: Date

    /** How many requests the key made in the window. */
    @Column({ name: "hits", type: "integer", default: () => "0" })
    hits!: number
}
