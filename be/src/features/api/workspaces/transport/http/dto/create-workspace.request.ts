import { IsString, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that creates a free workspace. */
export class CreateWorkspaceRequest {
    /** The name of the new workspace. */
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string
}
