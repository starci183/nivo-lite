import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Switches an agent live or paused. */
export class SetModuleLiveInput {
    /** The installation. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** True to act on channels, false to stay silent. */
    @Field()
    @IsBoolean()
    live!: boolean
}
