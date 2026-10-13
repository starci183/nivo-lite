import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** Which fact and what is decided about it. */
export class DecideBrainFactInput {
    /** The id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string

    /** `apply`, `reject`, `choose`, `split` or `retire`. */
    @Field(() => String)
    @IsIn(["apply", "reject", "choose", "split", "retire"])
    @MaxLength(40)
    action!: "apply" | "reject" | "choose" | "split" | "retire"

    /** The reason given with the decision. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string

    /** The situation a split value is for. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    situation?: string
}
