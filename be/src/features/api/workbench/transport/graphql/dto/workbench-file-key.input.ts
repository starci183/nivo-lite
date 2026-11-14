import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"
import { WorkbenchFileTargetInput } from "./workbench-file-target.input"

@InputType({ isAbstract: true })
/** The bounded arguments of a file call that names an object of the store: its key and the name to keep. */
export abstract class WorkbenchFileKeyInput extends WorkbenchFileTargetInput {
    /** The object key the ticket named. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(512)
    key!: string

    /** The file name to keep. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    name!: string
}
