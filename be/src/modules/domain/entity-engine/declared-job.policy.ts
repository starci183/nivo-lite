import type { JobContext, JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import type { JobPorts } from "./entity-engine.contracts"

/**
 * Runs one declared job with its ports, its parsed input and its context. This is the single seam to `invokeJob` of the SDK (A1): when it
 * lands, the body of this function becomes a call to it and nothing else changes.
 */
export const runDeclaredJob = (
    job: JobDefinition,
    ports: JobPorts,
    input: Readonly<Record<string, unknown>>,
    context: JobContext,
): Promise<void> => job.run(ports, input, context)
