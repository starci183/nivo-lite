import { Field, ID, InputType } from "@nestjs/graphql"
import { IsEmail, IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that invite a person into the caller's workspace. */
export class CreateInviteInput {
    /** The address to invite. */
    @Field()
    @IsEmail()
    @MaxLength(254)
    email!: string

    /** The role the invitation grants: `manager` or `staff`. */
    @Field()
    @IsIn(["manager", "staff"])
    role!: "manager" | "staff"

    /** The staff row the account will be, when any. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    staffId?: string
}
