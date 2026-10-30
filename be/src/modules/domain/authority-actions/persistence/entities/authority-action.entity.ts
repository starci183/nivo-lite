import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"
import type { AuthorityActionLabel } from "../../authority-actions.contracts"

@Entity({ schema: "public", name: "authority_actions" })
/** One action of the authority catalogue. */
export class AuthorityActionEntity extends AbstractEntity {
    /** The stable action key. */
    @PrimaryColumn({ name: "action", type: "text" })
    action!: string

    /** The module that owns the action. */
    @Column({ name: "module_key", type: "text" })
    moduleKey!: string

    /** The position of the action inside its module. */
    @Column({ name: "sort_order", type: "integer", default: () => "0" })
    sortOrder!: number

    /** The default authority mode. */
    @Column({ name: "default_mode", type: "text", default: () => "'ask'::text" })
    defaultMode!: "auto" | "ask" | "never"

    /** The default amount limit in VND. */
    @Column({ name: "default_limit_vnd", type: "bigint", nullable: true })
    defaultLimitVnd!: string | null

    /** The fields a request for the action must carry. */
    @Column({ name: "default_required_fields", type: "text", array: true, default: () => "'{}'::text[]" })
    defaultRequiredFields!: Array<string>

    /** Whether an amount limit is meaningful for the action. */
    @Column({ name: "amount_limit", type: "boolean", default: () => "false" })
    amountLimit!: boolean

    /** The loosest mode the action can ever take. */
    @Column({ name: "max_mode", type: "text", nullable: true })
    maxMode!: "ask" | "never" | null

    /** The action title in both languages. */
    @Column({ name: "label", type: "jsonb", default: () => "'{}'::jsonb" })
    label!: AuthorityActionLabel
}
