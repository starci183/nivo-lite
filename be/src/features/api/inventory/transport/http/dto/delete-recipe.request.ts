import { IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request of delete one recipe. */
export class DeleteRecipeRequest {
    /** The recipe. */
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
