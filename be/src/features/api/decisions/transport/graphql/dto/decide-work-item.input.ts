import { Field, ID, InputType } from "@nestjs/graphql"
import { Transform, Type } from "class-transformer"
import type { TransformFnParams } from "class-transformer"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { WorkEditsInput } from "./work-edits.input"

@InputType()
/** Approves (optionally edited) or rejects a waiting work item. */
export class DecideWorkItemInput {
    /** The work item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    workItemId!: string

    /** Approve or reject. */
    @Field()
    @IsIn(["approved", "rejected"])
    decision!: "approved" | "rejected"

    /** What the person changed before approving. */
    @Field(() => WorkEditsInput, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @ValidateNested()
    @Type(() => WorkEditsInput)
    edits?: WorkEditsInput

    /** A note from the decider. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsString()
    @MaxLength(1000)
    note?: string

    /** The written reason the outcome is true; required to approve a payment reconciliation. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsString()
    @MaxLength(1000)
    basis?: string
}
