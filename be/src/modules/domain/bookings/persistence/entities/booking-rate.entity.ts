import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "booking_rate" })
/** One row of public.booking_rate: the hits of one rate-limit key in one window, counted by public.booking_rate_hit. */
export class BookingRateEntity extends AbstractEntity {
    /** The rate-limit key. */
    @PrimaryColumn({ name: "key", type: "text" })
    key!: string

    /** When the window opened. */
    @PrimaryColumn({ name: "window_start", type: "timestamptz" })
    windowStart!: Date

    /** The hits counted in the window. */
    @Column({ name: "hits", type: "integer", default: () => "0" })
    hits!: number
}
