import type { ReadDefinition } from "../block/block.types"
import type { PortProvider, RunContext } from "../port/port.types"
import { sdkFailureOf } from "./sdk-failure"
import type { InvokeReadResult } from "./invoke.types"

/**
 * Runs a read that runs in the package: the one path the door and the graph host share. The read validates the variables
 * (`execute`), the provider builds its ports, and a thrown SDK error (an unprovided port) becomes a `failed` result. Any other
 * thrown error is a bug of the run and propagates.
 */
export const invokeRead = async (
    read: ReadDefinition,
    provider: PortProvider,
    raw: unknown,
    context: RunContext,
): Promise<InvokeReadResult> => {
    if (read.execute === undefined) return { ok: false, reason: "failed", code: "INVOKE_NOT_PACKAGE", at: read.id }
    try {
        const result = await read.execute(provider, raw, context)
        return result.ok ? result : { ok: false, reason: "invalid", problems: result.problems }
    } catch (error) {
        const failure = sdkFailureOf(error)
        if (failure === undefined) throw error
        return { ok: false, reason: "failed", code: failure.code, at: failure.at }
    }
}
