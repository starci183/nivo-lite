import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

/** Reads a bigint column as the number the contracts carry, and writes it as it is. */
const numeric = {
    to: (value: number): number => value,
    from: Number,
}

@Entity({ schema: "public", name: "plan_usage_tiers" })
/** One usage tier of a plan: a monthly credit allowance and its price. */
export class PlanUsageTierEntity extends AbstractEntity {
    /** The plan the tier belongs to. */
    @PrimaryColumn({ name: "plan_code", type: "text" })
    planCode!: string

    /** The credits a month. */
    @PrimaryColumn({ name: "credits_per_month", type: "bigint", transformer: numeric })
    creditsPerMonth!: number

    /** The price of a month in VND. */
    @Column({ name: "price_vnd", type: "bigint", transformer: numeric })
    priceVnd!: number

    /** The price is per seat. */
    @Column({ name: "per_seat", type: "boolean", default: () => "false" })
    perSeat!: boolean

    /** The order inside the plan. */
    @Column({ name: "sort", type: "integer", default: () => "0" })
    sort!: number
}
