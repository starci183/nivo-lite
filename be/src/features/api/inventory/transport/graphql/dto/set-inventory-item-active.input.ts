import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that switch an item on or off. */
export class SetInventoryItemActiveInput {
    /** The item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** Whether the item is in use. */
    @Field(() => Boolean)
    @IsBoolean()
    active!: boolean
}
