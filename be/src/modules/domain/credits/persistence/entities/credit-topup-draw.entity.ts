import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"
import { numberColumn } from "./number-column.mapper"

@Entity({ schema: "public", name: "credit_topup_draws" })
/** One row of public.credit_topup_draws: the credits a workspace drew from its top-up lots in one quota period. */
export class CreditTopupDrawEntity extends AbstractEntity {
    /** The workspace id. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The first day of the quota period. */
    @PrimaryColumn({ name: "period", type: "date" })
    period!: string

    /** The credits drawn from the lots in the period. */
    @Column({ name: "drawn", type: "bigint", default: () => "0", transformer: numberColumn })
    drawn!: number

    /** The credits that no lot could fund. */
    @Column({ name: "unfunded", type: "bigint", default: () => "0", transformer: numberColumn })
    unfunded!: number
}
