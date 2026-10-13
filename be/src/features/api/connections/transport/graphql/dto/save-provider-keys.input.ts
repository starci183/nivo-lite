import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsUUID, MaxLength, ValidateNested } from "class-validator"
import { ProviderKeysInput } from "./provider-keys.input"

@InputType()
/** The bounded arguments of saveProviderKeys. */
export class SaveProviderKeysInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The keys by name. */
    @Field(() => ProviderKeysInput)
    @ValidateNested()
    @Type(() => ProviderKeysInput)
    values!: ProviderKeysInput
}
