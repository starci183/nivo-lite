import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "inventory_movements" })
/** One signed stock movement, written by the movement function only. */
export class InventoryMovementEntity extends UuidAbstractEntity {
    /** The workspace that owns the movement. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The item that moved. */
    @Column({ name: "item_id", type: "uuid" })
    itemId!: string

    /** The location it moved at. */
    @Column({ name: "location_id", type: "uuid" })
    locationId!: string

    /** in, out, adjust or transfer. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The signed quantity, decimal text. */
    @Column({ name: "qty", type: "numeric" })
    qty!: string

    /** The level after the movement, decimal text. */
    @Column({ name: "qty_after", type: "numeric" })
    qtyAfter!: string

    /** The unit cost of the movement, decimal text. */
    @Column({ name: "unit_cost_vnd", type: "numeric", nullable: true })
    unitCostVnd!: string | null

    /** Why it moved. */
    @Column({ name: "reason", type: "text", default: () => "''::text" })
    reason!: string

    /** What the reference points at. */
    @Column({ name: "ref_type", type: "text", default: () => "'manual'::text" })
    refType!: string

    /** The reference id. */
    @Column({ name: "ref_id", type: "text", nullable: true })
    refId!: string | null

    /** The reference label. */
    @Column({ name: "ref_label", type: "text", nullable: true })
    refLabel!: string | null

    /** Who moved it. */
    @Column({ name: "by_name", type: "text", default: () => "'NIVO'::text" })
    byName!: string

    /** The evidence kept with it. */
    @Column({ name: "evidence", type: "text", nullable: true })
    evidence!: string | null

    /** The key that makes a retry a no-op. */
    @Column({ name: "dedupe_key", type: "text", nullable: true })
    dedupeKey!: string | null
}
