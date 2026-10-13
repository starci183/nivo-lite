import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** Confirms, reopens or edits one gate of the open draft. */
export class SetSetupGateInput {
    /** The open draft. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    setupSessionId!: string

    /** The gate. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    gateKey!: string

    /** What to do with it. */
    @Field()
    @IsIn(["confirm", "reopen", "edit"])
    action!: "confirm" | "reopen" | "edit"

    /** The own wording of the owner, for an edit. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(800)
    evidence: string = ""
}
