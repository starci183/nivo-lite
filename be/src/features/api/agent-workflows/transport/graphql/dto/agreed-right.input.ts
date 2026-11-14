import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** One operation on a connected account the owner agrees a workflow node may call, as the refusal AGENT_GRAPHS_RIGHTS_NEED_OWNER listed it. */
export class AgreedRightInput {
    /** The key of the node in the graph. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    nodeKey!: string

    /** The connected account. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    connectionId!: string

    /** The operation, by tool id. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    operation!: string

    /** auto (the node calls it by itself) or ask (each call waits for a person). */
    @Field(() => String)
    @IsString()
    @IsIn(["auto", "ask"])
    @MaxLength(4)
    mode!: string
}
