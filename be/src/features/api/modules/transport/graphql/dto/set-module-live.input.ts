import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"

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

    /** Resume only: "resumed" keeps this agent on the channels another agent of the role answers, "current" keeps that agent. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["resumed", "current"])
    keep?: "resumed" | "current"
}
