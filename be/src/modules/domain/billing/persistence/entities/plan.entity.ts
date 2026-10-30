import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"
import { numeric } from "./numeric-column.mapper"

@Entity({ schema: "public", name: "plans" })
/** One plan of the catalogue: its price, period, seats, allowances and the lists that describe it. */
export class PlanEntity extends AbstractEntity {
    /** The plan code. */
    @PrimaryColumn({ name: "code", type: "text" })
    code!: string

    /** The Vietnamese name. */
    @Column({ name: "name_vi", type: "text" })
    nameVi!: string

    /** The English name. */
    @Column({ name: "name_en", type: "text" })
    nameEn!: string

    /** The price of one period in VND. */
    @Column({ name: "price_vnd", type: "bigint", transformer: numeric })
    priceVnd!: number

    /** The billing period, a member of the table check. */
    @Column({ name: "period", type: "text" })
    period!: "month" | "year"

    /** The seats the plan includes. */
    @Column({ name: "seats", type: "integer" })
    seats!: number

    /** The feature lists, a { vi, en } object when well formed. */
    @Column({ name: "features", type: "jsonb", default: () => `'{"en": [], "vi": []}'::jsonb` })
    features!: unknown

    /** The order of the catalogue. */
    @Column({ name: "sort", type: "integer", default: () => "0" })
    sort!: number

    /** Whether the plan exists for payments at all. */
    @Column({ name: "active", type: "boolean", default: () => "true" })
    active!: boolean

    /** The monthly AI credits; null is unlimited. */
    @Column({ name: "ai_credits_per_month", type: "bigint", nullable: true, transformer: numeric })
    aiCreditsPerMonth!: number | null

    /** A contract plan. */
    @Column({ name: "is_custom", type: "boolean", default: () => "false" })
    isCustom!: boolean

    /** The price of a year paid at once, or null. */
    @Column({ name: "price_annual_vnd", type: "bigint", nullable: true, transformer: numeric })
    priceAnnualVnd!: number | null

    /** The share saved by paying a year at once, or null. */
    @Column({ name: "annual_discount_pct", type: "integer", nullable: true })
    annualDiscountPct!: number | null

    /** The monthly price of the intro months, or null. */
    @Column({ name: "promo_price_vnd", type: "bigint", nullable: true, transformer: numeric })
    promoPriceVnd!: number | null

    /** The paid months the intro price lasts, or null. */
    @Column({ name: "promo_months", type: "integer", nullable: true })
    promoMonths!: number | null

    /** The storage included in GB, or null. */
    @Column({ name: "storage_gb", type: "integer", nullable: true })
    storageGb!: number | null

    /** On sale to new customers. */
    @Column({ name: "listed", type: "boolean", default: () => "true" })
    listed!: boolean

    /** One person only. */
    @Column({ name: "individual", type: "boolean", default: () => "false" })
    individual!: boolean

    /** Priced per seat. */
    @Column({ name: "per_seat", type: "boolean", default: () => "false" })
    perSeat!: boolean
}
