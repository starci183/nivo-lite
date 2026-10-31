import { AbstractEntity } from "@modules/platform/database"
import { Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "inbox" })
/** One claimed delivery key: `(source, delivery_id)` is unique, so a repeat claim inserts nothing. */
export class InboxEntity extends AbstractEntity {
    /** The door that received the delivery. */
    @PrimaryColumn({ name: "source", type: "text" })
    source!: string

    /** The sender's id of the delivery. */
    @PrimaryColumn({ name: "delivery_id", type: "text" })
    deliveryId!: string
}
