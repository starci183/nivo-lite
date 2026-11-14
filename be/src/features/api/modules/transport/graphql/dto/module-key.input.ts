import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator"

@InputType()
/** Names one module of the catalogue. */
export class ModuleKeyInput {
    /** The key of the module: short lowercase ASCII. */
    @Field()
    @IsString()
    @Matches(/^[a-z][a-z0-9_]{1,23}$/u)
    @MaxLength(24)
    key!: string

    /** The workspace that reads the module (the caller must be a member); needed only for a module of a private plugin. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    workspaceId: string | null = null
}
