import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { ConnectionWishInput } from "./connection-wish.input"

@InputType()
/** The bounded arguments of setAgentConnections. */
export class SetAgentConnectionsInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    agentId!: string

    /** The connections wanted. */
    @Field(() => [ConnectionWishInput])
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => ConnectionWishInput)
    connections!: ReadonlyArray<ConnectionWishInput>
}
