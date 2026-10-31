import { AbstractEntity } from "@modules/platform/database"
import { Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "channel_receipts" })
/** One row of public.channel_receipts. */
export class ChannelReceiptEntity extends AbstractEntity {
    /** The workspace id. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The channel. */
    @PrimaryColumn({ name: "channel", type: "text" })
    channel!: string

    /** The receipt id. */
    @PrimaryColumn({ name: "receipt_id", type: "text" })
    receiptId!: string
}
