import type { ActionDefinition, ActionResult } from "../block/block.types"
import type { PortProvider, RunContext } from "../port/port.types"
import { sdkFailureOf } from "./sdk-failure"
import { hasExternalPort } from "./external-ports"

const failed = (code: string, at: string): ActionResult => ({
    ok: false,
    reason: "failed",
    message: { key: "invoke.failed" },
    data: { code, at },
})

/**
 * Runs an action that runs in the package: the one path the door and the graph host share. A transactional action that asks for a port
 * that reaches outside the database is refused with `INVOKE_EXTERNAL_IN_TX`; the call
 * must go through a declared job instead. A thrown SDK error becomes a `failed` result; any other thrown error propagates.
 */
export const invokeAction = async (
    action: ActionDefinition,
    provider: PortProvider,
    raw: unknown,
    context: RunContext,
): Promise<ActionResult> => {
    if (action.execute === undefined) return failed("INVOKE_NOT_PACKAGE", action.id)
    if (action.transactional === true && hasExternalPort(action.ports))
        return failed("INVOKE_EXTERNAL_IN_TX", action.id)
    try {
        return await action.execute(provider, raw, context)
    } catch (error) {
        const failure = sdkFailureOf(error)
        if (failure === undefined) throw error
        return failed(failure.code, failure.at)
    }
}
