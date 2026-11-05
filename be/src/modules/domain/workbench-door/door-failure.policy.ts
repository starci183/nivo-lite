import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { ENTITY_ENGINE_ERROR_KINDS } from "@modules/domain/entity-engine"
import { isDomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"
import { WorkbenchDoorErrorCode } from "./errors/workbench-door.error"

/** How a failure of an action travels to the screen: the reason of the result, the code its text comes from and what to offer. */
export interface ActionFailure {
    /** The reason of the `ActionResult`. */
    readonly reason: "invalid" | "forbidden" | "conflict" | "failed"
    /** The code whose text the screen shows. */
    readonly code: WorkbenchDoorErrorCode
    /** Data the screen may use, for instance that trying again may succeed. */
    readonly data?: JsonValue
}

const FAILURES: Readonly<Record<string, ActionFailure>> = {
    invalid: { reason: "invalid", code: WorkbenchDoorErrorCode.PayloadInvalid },
    forbidden: { reason: "forbidden", code: WorkbenchDoorErrorCode.PermissionDenied },
    conflict: { reason: "conflict", code: WorkbenchDoorErrorCode.ActionConflict },
    unavailable: { reason: "failed", code: WorkbenchDoorErrorCode.ActionFailed, data: { retry: true } },
}

const FAILED: ActionFailure = { reason: "failed", code: WorkbenchDoorErrorCode.ActionFailed }

/** The kind an entity engine failure travels by, or undefined for a failure that is not one of the engine. */
const engineKindOf = (cause: unknown): ErrorKind | undefined =>
    isDomainError(cause)
        ? Object.entries(ENTITY_ENGINE_ERROR_KINDS).find(([code]) => code === cause.code)?.[1]
        : undefined

/**
 * What a failure of a running action means to the screen, or null for a failure the door does not know (a bug: it propagates, and the
 * error filter logs it). An engine failure travels by its kind (invalid, forbidden, conflict; an unavailable one is `failed` with a
 * retry hint). A thrown SDK error never reaches here: `invokeAction` turns it into a `failed` result.
 */
export const actionFailureOf = (cause: unknown): ActionFailure | null => {
    const kind = engineKindOf(cause)
    return kind === undefined ? null : (FAILURES[kind] ?? FAILED)
}
