import { parseStrict } from "../block/input"
import type { JobContext, JobDefinition } from "../mutation/job"
import { portsOf } from "../port/port"
import type { PortProvider } from "../port/port.types"
import type { InvokeJobResult } from "./invoke.types"

/**
 * Runs a declared job on a payload: the one path the job runner shares with the door and the graph host. The payload is parsed
 * strictly (an unknown key is refused); a refused payload is a result, never a throw. A failure of the run is thrown unchanged, so
 * the processor classifies it (retry or park).
 */
export const invokeJob = async (
    job: JobDefinition,
    provider: PortProvider,
    input: unknown,
    context: JobContext,
): Promise<InvokeJobResult> => {
    const parsed = parseStrict(job.input, input)
    if (!parsed.ok) return { ok: false, reason: "invalid", problems: parsed.problems }
    await job.run(portsOf(provider, job.ports), parsed.value, context)
    return { ok: true }
}
