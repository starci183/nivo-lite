import { Field, InputType } from "@nestjs/graphql"
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** Installs a module, or adds an instance of a multi-instance type. */
export class InstallModuleInput {
    /** The module to install. */
    @Field()
    @IsString()
    @Matches(/^[a-z][a-z0-9_]{1,23}$/u)
    @MaxLength(24)
    moduleKey!: string

    /** True to add another instance of a type that allows several. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    newInstance: boolean = false

    /** The label of the instance; the next free one when absent. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(160)
    name: string | null = null
}
