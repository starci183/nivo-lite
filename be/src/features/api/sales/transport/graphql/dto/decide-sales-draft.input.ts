import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** A person's bounded decision on a Sales approval card. */
export class DecideSalesDraftInput {
    /** The approval card id. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** Approve or reject the draft. */
    @Field()
    @IsIn(["approved", "rejected"])
    decision!: "approved" | "rejected"

    /** The replacement draft, when the person edited it. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    editedDraft?: string
}
