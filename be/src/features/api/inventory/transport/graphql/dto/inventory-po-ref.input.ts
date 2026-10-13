import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one purchase order of the caller's workspace. */
export class InventoryPoRefInput {
    /** The purchase order. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    poId!: string
}
