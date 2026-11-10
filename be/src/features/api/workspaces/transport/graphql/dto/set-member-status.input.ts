import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator"
import { MemberRefInput } from "./member-ref.input"

@InputType()
/** The member to enable or disable. */
export class SetMemberStatusInput extends MemberRefInput {
    /** `active` or `disabled`. */
    @Field()
    @IsIn(["active", "disabled"])
    status!: "active" | "disabled"

    /** Why the member is switched off; shown to them in the lobby. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string | null
}
