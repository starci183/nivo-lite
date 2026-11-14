import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator"

@InputType()
/** How a CRM key is sent, as typed in the connect wizard; a blank value keeps the stored key. */
export class CrmAuthInput {
    /** `bearer` or `header`. */
    @Field(() => String)
    @IsIn(["bearer", "header"])
    type!: string

    /** The header the key goes in (`header` only). */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    name?: string | null

    /** The key or token; write-only. */
    @Field(() => String)
    @IsString()
    @MaxLength(4000)
    value!: string
}
