import { Field, InputType } from "@nestjs/graphql"
import { IsBoolean, IsOptional } from "class-validator"

@InputType()
/** Bounded videoProjects arguments. */
export class ListVideoProjectsInput {
    /** Include archived projects. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    includeArchived?: boolean
}
