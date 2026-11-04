import { Field, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, MaxLength } from "class-validator"

@InputType()
/** The real person a persona is modelled on, and what of them it uses. */
export class LikenessClaimInput {
    /** The person. */
    @Field(() => String)
    @IsString()
    @MaxLength(120)
    personName!: string

    /** `name`, `avatar`, `voice_style` or `first_person`. */
    @Field(() => [String])
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(4)
    @IsIn(["name", "avatar", "voice_style", "first_person"], { each: true })
    allowedUses!: Array<"name" | "avatar" | "voice_style" | "first_person">

    /** The line shown to every customer. */
    @Field(() => String)
    @IsString()
    @MaxLength(300)
    disclosure!: string
}
