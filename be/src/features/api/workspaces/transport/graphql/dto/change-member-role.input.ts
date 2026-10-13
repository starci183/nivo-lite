import { Field, InputType } from "@nestjs/graphql"
import { IsIn } from "class-validator"
import { MemberRefInput } from "./member-ref.input"

@InputType()
/** The member whose role changes and the role to give. */
export class ChangeMemberRoleInput extends MemberRefInput {
    /** `owner`, `manager` or `staff`. */
    @Field()
    @IsIn(["owner", "manager", "staff"])
    role!: "owner" | "manager" | "staff"
}
