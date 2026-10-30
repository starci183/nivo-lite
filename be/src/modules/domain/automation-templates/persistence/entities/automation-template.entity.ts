import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "automation_templates" })
/** One ready-made automation of the catalogue. */
export class AutomationTemplateEntity extends AbstractEntity {
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

    /** The gallery order. */
    @Column({ name: "position", type: "integer", default: () => "0" })
    position!: number
}
