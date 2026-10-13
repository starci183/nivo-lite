import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** Renames an instance. */
export class RenameModuleInstallationInput {
    /** The installation. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** The new label. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    name!: string
}
