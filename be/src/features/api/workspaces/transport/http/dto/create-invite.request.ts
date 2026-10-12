import { IsEmail, IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request that invites a person into the caller's workspace. */
export class CreateInviteRequest {
    /** The address to invite. */
    @IsEmail()
    @MaxLength(254)
    email!: string

    /** The role the invitation grants. */
    @IsIn(["manager", "staff"])
    role!: "manager" | "staff"

    /** The staff row the account will be, when any. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    staffId?: string
}
