import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"
import { numeric } from "./numeric-column.mapper"

@Entity({ schema: "public", name: "billing_config" })
/** One row of public.billing_config: a named billing constant, such as the USD value of one credit. */
export class BillingConfigEntity extends AbstractEntity {
    /** The constant's key. */
    @PrimaryColumn({ name: "key", type: "text" })
    key!: string

    /** The constant's value. */
    @Column({ name: "value", type: "numeric", transformer: numeric })
    value!: number

    /** Where the constant comes from. */
    @Column({ name: "note", type: "text", default: () => "''" })
    note!: string
}
