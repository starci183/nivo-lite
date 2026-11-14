/** The one command kind `runFlow` takes: a verdict on a work item a thread approval wrote. */
export type FlowCommandKind = "decide"

/** The command of one `runFlow` call and its inputs. */
export interface RunFlowCall {
    /** What to do. */
    readonly kind: FlowCommandKind
    /** The inputs of the command. */
    readonly payload: object
}

/** One `runFlow` call, in the workspace of the request. */
export interface RunFlowRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The command and its inputs. */
    readonly flow: RunFlowCall
}
