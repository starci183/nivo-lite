import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** The truth as the person writes it on the "Ghi vao Second Brain" form. */
export class ChatTruthFactInput {
    /** What the truth is about ("Giao hang"). */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    subjectLabel!: string

    /** Which property of it ("Phi ship noi thanh"). */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    attributeLabel!: string

    /** The new value; absent retires the truth in force. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    value?: string

    /** The unit, when written apart. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(20)
    unit?: string

    /** From when it holds (ISO), when said. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(40)
    validFrom?: string

    /** Until when it holds (ISO), when said. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(40)
    validTo?: string
}

@InputType()
/** "Ghi vao Second Brain" on one message of the team chat. */
export class CaptureChatTruthInput {
    /** The person's message (`chatMessages.nodes.id`). */
    @Field(() => ID)
    @IsString()
    @MaxLength(100)
    messageId!: string

    /** The agent that files it; absent in a private room with an agent, required in a room of several people. */
    @Field(() => ID, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    agentId?: string

    /** The truth as written on the form; absent lets the agent draft it from the message. */
    @Field(() => ChatTruthFactInput, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @ValidateNested()
    @Type(() => ChatTruthFactInput)
    fact?: ChatTruthFactInput
}
