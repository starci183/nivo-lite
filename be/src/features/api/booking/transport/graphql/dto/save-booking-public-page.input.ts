import { Field, InputType } from "@nestjs/graphql"
import { IsBoolean, IsString, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for save booking public page. */
export class SaveBookingPublicPageInput {
    /** The enabled. */
    @Field(() => Boolean)
    @IsBoolean()
    enabled!: boolean

    /** The slug. */
    @Field(() => String)
    @IsString()
    @MaxLength(80)
    slug!: string

    /** The note. */
    @Field(() => String)
    @IsString()
    @MaxLength(400)
    note!: string
}
