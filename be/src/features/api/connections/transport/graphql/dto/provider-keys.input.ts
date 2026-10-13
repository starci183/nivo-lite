import { Field, InputType } from "@nestjs/graphql"
import { Transform } from "class-transformer"
import { IsOptional, IsString, MaxLength } from "class-validator"

@InputType()
/** The keys the owner copied from the provider. */
export class ProviderKeysInput {
    /** payOS client id. */
    @Field(() => String, { nullable: true })
    @Transform(({ value }) => value ?? undefined)
    @IsOptional()
    @IsString()
    @MaxLength(400)
    clientId?: string

    /** payOS API key. */
    @Field(() => String, { nullable: true })
    @Transform(({ value }) => value ?? undefined)
    @IsOptional()
    @IsString()
    @MaxLength(400)
    apiKey?: string

    /** payOS checksum key. */
    @Field(() => String, { nullable: true })
    @Transform(({ value }) => value ?? undefined)
    @IsOptional()
    @IsString()
    @MaxLength(400)
    checksumKey?: string

    /** Casso secure key. */
    @Field(() => String, { nullable: true })
    @Transform(({ value }) => value ?? undefined)
    @IsOptional()
    @IsString()
    @MaxLength(400)
    secureKey?: string
}
