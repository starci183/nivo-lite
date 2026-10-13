import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of startTelegramLogin. */
export class StartTelegramLoginInput {
    /** The connection name. */
    @Field(() => String)
    @IsString()
    @MaxLength(120)
    name!: string

    /** The phone as typed. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    phone!: string

    /** True when the owner agreed to the commitment text. */
    @Field(() => Boolean)
    @IsBoolean()
    consent!: boolean

    /** A pending connection to reuse (a corrected number). */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(64)
    connectionId?: string | null
}
