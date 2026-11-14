import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of providerRightHolders. */
export class GetProviderRightHoldersInput {
    /** The connected account whose rights tab is read. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    connectionId!: string
}
