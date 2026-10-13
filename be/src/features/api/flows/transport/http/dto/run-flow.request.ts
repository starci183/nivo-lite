import { IsIn, IsObject } from "class-validator"
import type { FlowCommandKind } from "@modules/domain/flows"

const KINDS: ReadonlyArray<FlowCommandKind> = [
    "save_authority",
    "save_rule",
    "save_staff",
    "decide",
    "hold",
    "assign",
    "simulate_inbound",
    "take_over",
    "send_as_human",
    "authority_from_chat",
    "owner_chat",
]

/** One operating-flow command a member asks for. */
export class RunFlowRequest {
    /** What to do. */
    @IsIn(KINDS)
    kind!: FlowCommandKind

    /** The inputs of the command. */
    @IsObject()
    payload!: object
}
