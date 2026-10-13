import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one recipe of the caller's workspace. */
export class InventoryRecipeRefInput {
    /** The recipe. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
