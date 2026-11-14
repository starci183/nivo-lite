import { Field, Float, InputType } from "@nestjs/graphql"
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator"
import { WorkbenchFileTargetInput } from "./workbench-file-target.input"

/** The largest object one upload may name (5 GiB, one S3 PUT); the field's own `maxBytes` is checked by the door. */
const SIZE_MAX = 5_368_709_120

@InputType()
/** Bounded arguments for a ticket to upload one file into a record's file field. */
export class WorkbenchFileUploadInput extends WorkbenchFileTargetInput {
    /** The file name. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    name!: string

    /** The content type the upload will carry. */
    @Field()
    @IsString()
    @MinLength(3)
    @MaxLength(127)
    mime!: string

    /** The exact size in bytes (a Float: a GraphQL Int stops at 2 GiB). */
    @Field(() => Float)
    @IsInt()
    @Min(1)
    @Max(SIZE_MAX)
    size!: number
}
