import { IsBoolean, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request of switch an item on or off. */
export class SetItemActiveRequest {
    /** The item. */
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** Whether the item is in use. */
    @IsBoolean()
    active!: boolean
}
