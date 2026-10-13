import { Field, InputType } from "@nestjs/graphql"
import { IsIn } from "class-validator"
import { MemberRefInput } from "./member-ref.input"

@InputType()
/** The member to enable or disable. */
export class SetMemberStatusInput extends MemberRefInput {
    /** `active` or `disabled`. */
    @Field()
    @IsIn(["active", "disabled"])
    status!: "active" | "disabled"
}
