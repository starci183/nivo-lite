import { specDocumentSchema, type SpecDocument } from "@nivo-lite/agent-sdk/spec"
import data from "./agent-runs.workbench.json"

/** The seed spec of the runs of an agent: the list with its status filter beside the steps of the chosen run, parsed once. */
export const AGENT_RUNS_SPEC: SpecDocument = specDocumentSchema.parse(data)
