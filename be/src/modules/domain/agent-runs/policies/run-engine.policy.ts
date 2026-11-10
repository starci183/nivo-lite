import type { RunRecord } from "../agent-runs-records.contracts"

/**
 * Whether the old step engine may move a run: advance its steps, finish a wait from a work item, resume it from a failed step, or take
 * it in a sweep. A run on a LangGraph thread (`engine = langgraph`) moves only through its thread (a wake under the lease, a stop's
 * decision): its step rows are a projection, so an old path that read one as its own would drive that run a second time. A run that
 * names no engine is the old engine's. Every old-engine advance, resume, sweep and due path asks this one question.
 */
export const isOldEngineRun = (run: Pick<RunRecord, "engine">): boolean => run.engine !== "langgraph"
