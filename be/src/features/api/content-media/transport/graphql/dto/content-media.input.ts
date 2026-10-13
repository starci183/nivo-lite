import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The media items and bounded library size requested by the workbench. */
export class ContentMediaInput {
    /** Workspace-scoped media paths that need temporary links. */
    @Field(() => [String], { defaultValue: [] })
    @IsArray()
    @ArrayMaxSize(80)
    @IsString({ each: true })
    @MaxLength(1024, { each: true })
    paths: Array<string> = []

    /** Workspace video ids that need temporary links. */
    @Field(() => [ID], { defaultValue: [] })
    @IsArray()
    @ArrayMaxSize(80)
    @IsUUID("4", { each: true })
    videoIds: Array<string> = []

    /** The maximum number of workspace media files to return. */
    @Field(() => Int, { defaultValue: 30 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(80)
    limit = 30
}
