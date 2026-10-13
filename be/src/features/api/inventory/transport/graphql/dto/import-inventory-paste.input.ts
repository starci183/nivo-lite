import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that import items from a pasted table. */
export class ImportInventoryPasteInput {
    /** The pasted rows of a sheet or CSV. */
    @Field(() => String)
    @IsString()
    @MaxLength(200000)
    raw!: string
}
