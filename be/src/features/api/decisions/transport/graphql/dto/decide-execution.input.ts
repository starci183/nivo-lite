import { NullAsAbsent } from "@modules/platform/graphql"
import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Approves (optionally with an edited draft) or rejects an approval card. */
export class DecideExecutionInput {
    /** The approval card. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    executionId!: string

    /** Approve or reject. */
    @Field()
    @IsIn(["approved", "rejected"])
    decision!: "approved" | "rejected"

    /** The draft the person edited. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsString()
    @MaxLength(10000)
    editedDraft?: string
}
