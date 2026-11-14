import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** Dong y or Khong on a truth-graph change card. */
export class DecideBrainChangeInput {
    /** The change request on the card (`brainChange.changeId`). */
    @Field(() => ID)
    @IsString()
    @MaxLength(100)
    changeId!: string

    /**
     * `approve` (Dong y, the workspace owner only), `reject` (Khong, the owner or a manager) or `keep_both` (Giu ca hai, the owner
     * only, offered when `brainChange.canKeepBoth`).
     */
    @Field(() => String)
    @IsIn(["approve", "reject", "keep_both"])
    @MaxLength(10)
    action!: "approve" | "reject" | "keep_both"

    /** The reason given with the decision. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string
}
