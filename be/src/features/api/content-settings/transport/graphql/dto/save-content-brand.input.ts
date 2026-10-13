import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** Bounded editable brand fields. */
export class SaveContentBrandInput {
    /** Voice and style guidance. */
    @Field()
    @IsString()
    @MaxLength(1500)
    brandVoice!: string

    /** Words and subjects to avoid. */
    @Field()
    @IsString()
    @MaxLength(1500)
    avoid!: string

    /** The usual call to action. */
    @Field()
    @IsString()
    @MaxLength(300)
    cta!: string

    /** Space- or comma-separated brand hashtags. */
    @Field()
    @IsString()
    @MaxLength(4000)
    hashtags!: string
}
