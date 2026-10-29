import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "automation_templates" })
/** One ready-made automation of the catalogue. */
export class AutomationTemplateEntity {
    /** The template key. */
    @PrimaryColumn({ name: "key", type: "text" })
    key!: string

    /** The definition version. */
    @Column({ name: "version", type: "integer", default: () => "1" })
    version!: number

    /** The module the template belongs to. */
    @Column({ name: "module_key", type: "text", nullable: true })
    moduleKey!: string | null

    /** The pack of the template. */
    @Column({ name: "pack", type: "text", default: () => "'core'::text" })
    pack!: string

    /** Who runs the template. */
    @Column({ name: "executor", type: "text", default: () => "'implemented'::text" })
    executor!: string

    /** The definition as stored, checked before it is used. */
    @Column({ name: "definition", type: "jsonb" })
    definition!: unknown

    /** When the row last changed. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date

    /** The gallery order. */
    @Column({ name: "position", type: "integer", default: () => "0" })
    position!: number
}
