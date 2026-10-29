import { Column, Entity, PrimaryColumn } from "typeorm"
import { numberColumn } from "./number-column.mapper"

@Entity({ schema: "public", name: "credit_packs" })
/** One row of public.credit_packs: an add-on credit pack on sale. */
export class CreditPackEntity {
    /** The pack code. */
    @PrimaryColumn({ name: "code", type: "text" })
    code!: string

    /** The credits the pack adds. */
    @Column({ name: "credits", type: "bigint", transformer: numberColumn })
    credits!: number

    /** The price in VND. */
    @Column({ name: "price_vnd", type: "bigint", transformer: numberColumn })
    priceVnd!: number

    /** The order of the catalogue. */
    @Column({ name: "sort", type: "int", default: () => "0" })
    sort!: number

    /** Whether the pack is on sale. */
    @Column({ name: "active", type: "boolean", default: () => "true" })
    active!: boolean
}
