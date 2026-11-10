/** Log events of the checkpoint saver. Fields name the thread, a channel and sizes; never a stored value. */
export enum CheckpointLogEvent {
    /** A stored value reached the warning size (`thread`, `what`, `name`, `bytes`): the state carries more than ids and step outputs. */
    ValueLarge = "langgraph.checkpoint.value_large",
    /** A write was refused because a newer driver owns the thread (`thread`, `fence`): the caller was superseded. */
    WriteFenced = "langgraph.checkpoint.write_fenced",
}
