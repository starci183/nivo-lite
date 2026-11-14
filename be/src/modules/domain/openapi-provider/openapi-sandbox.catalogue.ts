import type { SandboxCase, SandboxCatalogue } from "@modules/domain/provider-sandbox"
import { OPENAPI_PROVIDER } from "@modules/domain/openapi-tools"

/** The operation of an API call in the sandbox call log and in the account's next-case selector (one for every document operation). */
export const OPENAPI_CALL_OPERATION = "call"

/** The status the refusal case answers: the system understood the call and refused it (a 4xx: the connector reads it as the system's answer). */
export const OPENAPI_SANDBOX_REFUSAL_STATUS = 422

/** The status the failure case answers: the system failed (a 5xx: the effect of the call is unknown). */
export const OPENAPI_SANDBOX_FAILURE_STATUS = 503

/** The status the lost-answer case answers: the gateway timed out (the call may have been applied: the effect is unknown). */
export const OPENAPI_SANDBOX_TIMEOUT_STATUS = 504

/** The case ids, for the sandbox service and its specs. */
export const OPENAPI_SANDBOX_CASE = {
    answered: "OPENAPI-1",
    refused: "OPENAPI-2",
    failed: "OPENAPI-3",
    timedOut: "OPENAPI-4",
} as const

/**
 * The OpenAPI provider's hardcoded sandbox cases (R62): GENERIC over every operation of every pinned document (the engine knows no
 * system's noun, R75). The account's NEXT CASE of `call` picks the outcome, sticky; `OPENAPI-1` answers while nothing is picked, from
 * the fixtures the package that pins the document ships (`OpenApiSandboxFixtures`, keyed by operation id; stateful only where a write
 * must change later reads).
 */
export const OPENAPI_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: OPENAPI_PROVIDER,
    cases: [
        {
            id: OPENAPI_SANDBOX_CASE.answered,
            label: "The system answers the operation from the package's fixtures (a write kept is read back by later reads)",
            operation: OPENAPI_CALL_OPERATION,
            default: true,
        },
        {
            id: OPENAPI_SANDBOX_CASE.refused,
            label: "The system refuses the call: HTTP 422 (the connector's refusal of the system's answer; nothing applied)",
            operation: OPENAPI_CALL_OPERATION,
        },
        {
            id: OPENAPI_SANDBOX_CASE.failed,
            label: "The system fails: HTTP 503 (the effect is unknown; nothing kept)",
            operation: OPENAPI_CALL_OPERATION,
        },
        {
            id: OPENAPI_SANDBOX_CASE.timedOut,
            label: "The call is applied but its answer is lost: the write is kept, then HTTP 504 (the effect is unknown)",
            operation: OPENAPI_CALL_OPERATION,
        },
    ] satisfies ReadonlyArray<SandboxCase>,
}
