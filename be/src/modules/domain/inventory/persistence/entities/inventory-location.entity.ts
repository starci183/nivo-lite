import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "inventory_locations" })
/** One stock location of a workspace. */
export class InventoryLocationEntity extends UuidAbstractEntity {
    /** The workspace that owns the location. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The location name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** Whether stock without a named place lands here. */
    @Column({ name: "is_default", type: "boolean", default: () => "false" })
    isDefault!: boolean
}
