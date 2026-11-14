import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsObject } from "class-validator"
import { GraphqlJsonObject } from "@modules/platform/graphql"
import type { FlowCommandKind } from "../../../application/run-flow.contracts"

const KINDS: ReadonlyArray<FlowCommandKind> = ["decide"]

@InputType()
/** One `runFlow` command: kind `decide` and its inputs (`workItemId`, `decision`, `locale`). */
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
