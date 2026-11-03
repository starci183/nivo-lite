import { Field, ID, InputType } from "@nestjs/graphql"
import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { GraphqlJsonObject, NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** A listing to install in this workspace. */
export class InstallTemplateListingInput {
    /** The listing. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    listingId!: string

    /** The values of the parameters, by key. */
    @Field(() => GraphqlJsonObject)
    @IsObject()
    values!: object

    /** The label of the new agent. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(80)
    name?: string
}
