import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** What openSandboxAccount takes. */
export class OpenSandboxAccountInput {
    /** The provider key. */
    @Field(() => String)
    @IsString()
    @MaxLength(64)
    provider!: string

    /** The name of the account. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The agents to attach the account to in the same action: attached, bound where they may be, the provider's triggers on. */
    @Field(() => [ID], { nullable: true, defaultValue: [] })
    @NullAsAbsent()
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @IsUUID(undefined, { each: true })
    attachTo?: Array<string>
}

@InputType()
/** What attachSandboxAccount and detachSandboxAccount take. */
export class SandboxAccountAgentInput {
    /** The sandbox account. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The agent to attach or detach. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    agentId!: string
}

@InputType()
/** One input value of an inbound case, as text. */
export class SandboxInputValueInput {
    /** The field name. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    name!: string

    /** The value as typed. */
    @Field(() => String)
    @IsString()
    @MaxLength(2000)
    value!: string
}

@InputType()
/** What sendSandboxCase takes. */
export class SendSandboxCaseInput {
    /** The sandbox account. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The inbound case id. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    caseId!: string

    /** The inputs given; one not given is prefilled. */
    @Field(() => [SandboxInputValueInput], { nullable: true, defaultValue: [] })
    @NullAsAbsent()
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => SandboxInputValueInput)
    inputs?: Array<SandboxInputValueInput>
}

@InputType()
/** What setSandboxNextCase takes. */
export class SetSandboxNextCaseInput {
    /** The sandbox account. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The outbound case id. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    caseId!: string
}

@InputType()
/** What expireSandboxWait takes. */
export class ExpireSandboxWaitInput {
    /** The run parked at a wait. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    runId!: string
}
