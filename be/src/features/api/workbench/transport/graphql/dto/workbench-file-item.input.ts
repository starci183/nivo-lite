import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"
import { WorkbenchFileTargetInput } from "./workbench-file-target.input"

@InputType({ isAbstract: true })
/** The bounded arguments of a file call that may name one file of a list field: the field's own call, and the object key of the item. */
export abstract class WorkbenchFileItemInput extends WorkbenchFileTargetInput {
    /** The object key of one file of a list field (each reference carries it); required for a list field, absent for a single one. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(512)
    key?: string
}
