import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "shifts_positions" })
/** A position of the shop a person can work at (cashier, kitchen, floor). */
export class ShiftsPositionEntity {
    /** The position id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The colour of its chip. */
    @Column({ name: "color", type: "text", default: () => "'#2f6fed'" })
    color!: string

    /** Where it sits in the list. */
    @Column({ name: "sort_order", type: "int", default: () => "0" })
    sortOrder!: number

    /** Whether it is still in use. */
    @Column({ name: "active", type: "boolean", default: () => "true" })
    active!: boolean

    /** When it was made. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
