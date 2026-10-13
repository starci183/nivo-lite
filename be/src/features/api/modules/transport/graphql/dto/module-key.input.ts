import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** Names one module of the catalogue. */
export class ModuleKeyInput {
    /** The key of the module: short lowercase ASCII. */
    @Field()
    @IsString()
    @Matches(/^[a-z][a-z0-9_]{1,23}$/u)
    @MaxLength(24)
    key!: string
}
