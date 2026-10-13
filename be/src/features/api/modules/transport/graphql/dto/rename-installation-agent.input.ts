import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** Renames the agent of an installation. */
export class RenameInstallationAgentInput {
    /** The installation. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** The new display name. */
    @Field()
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name!: string
}
