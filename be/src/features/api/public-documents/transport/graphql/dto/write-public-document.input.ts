import { IsString, MaxLength, MinLength } from "class-validator"
import { Field, InputType } from "@nestjs/graphql"

@InputType()
/** A public document an owner writes by hand. */
export class WritePublicDocumentInput {
    /** The title. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    title!: string

    /** The text customers will read once it is approved. */
    @Field(() => String)
    @IsString()
    @MaxLength(40000)
    body!: string
}
