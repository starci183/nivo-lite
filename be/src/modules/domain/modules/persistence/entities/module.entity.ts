import { Column, Entity, PrimaryColumn } from "typeorm"

import { AbstractEntity } from "@modules/platform/database"
import type { ModuleDefinition } from "../../modules.contracts"

@Entity({ schema: "public", name: "modules" })
/** One module of the catalogue as the database mirrors it: one row of `public.modules`. */
export class ModuleEntity extends AbstractEntity {
    /** The module key. */
    @PrimaryColumn({ name: "key", type: "text" })
    key!: string

    /** Where the module sits in the catalogue. */
    @Column({ name: "sort_order", type: "integer", default: () => "0" })
    sortOrder!: number

    /** Where the module stands (early, live...). */
    @Column({ name: "status", type: "text", default: () => "'early'" })
    status!: ModuleDefinition["status"]

    /** The key of the category the module belongs to. */
    @Column({ name: "category", type: "text" })
    category!: string

    /** Who the module is for. */
    @Column({ name: "audience", type: "text", default: () => "'internal'" })
    audience!: ModuleDefinition["audience"]

    /** The knowledge folder of the module. */
    @Column({ name: "knowledge_folder", type: "text" })
    knowledgeFolder!: string

    /** The key of the module's workbench, when it has one. */
    @Column({ name: "workbench", type: "text", nullable: true })
    workbench!: string | null

    /** How an agent of the module starts running. */
    @Column({ name: "default_operating_mode", type: "text", default: () => "'assist'" })
    defaultOperatingMode!: ModuleDefinition["defaultOperatingMode"]

    /** The whole definition of the module. */
    @Column({ name: "definition", type: "jsonb", default: () => "'{}'::jsonb" })
    definition!: ModuleDefinition

    /** True when the type allows several instances. */
    @Column({ name: "multi_instance", type: "boolean", default: () => "false" })
    multiInstance!: boolean
}
