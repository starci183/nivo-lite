import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsObject } from "class-validator"
import type { FlowCommandKind } from "@modules/domain/flows"
import { GraphqlJsonObject } from "@modules/platform/graphql"

const KINDS: ReadonlyArray<FlowCommandKind> = [
    "save_authority",
    "save_rule",
    "save_staff",
    "decide",
    "hold",
    "assign",
    "take_over",
    "send_as_human",
    "authority_from_chat",
    "owner_chat",
]

@InputType()
/** One operating-flow command a member asks for. */
export class RunFlowInput {
    /** What to do. */
    @Field()
    @IsIn(KINDS)
    kind!: FlowCommandKind

    /** The inputs of the command. */
    @Field(() => GraphqlJsonObject)
    @IsObject()
    payload!: object
}
