import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, Max, Min } from "class-validator"

@InputType()
/** The bounded number of media library files to list. */
export class ContentMediaLibraryInput {
    /** The maximum number of workspace media files to return. */
    @Field(() => Int, { defaultValue: 30 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(80)
    limit = 30
}
