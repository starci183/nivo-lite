import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { SalesWorkEditsInput } from "./sales-work-edits.input"

@InputType()
/** A person's bounded decision and edits for a Sales proposal. */
export class DecideSalesWorkItemInput {
    /** The Sales work item id. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** Approve or reject the proposal. */
    @Field()
    @IsIn(["approved", "rejected"])
    decision!: "approved" | "rejected"

    /** The bounded changes made before approving. */
    @Field(() => SalesWorkEditsInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => SalesWorkEditsInput)
    edits?: SalesWorkEditsInput

    /** The decider's note. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string

    /** The evidence supporting the decision. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    basis?: string
}
