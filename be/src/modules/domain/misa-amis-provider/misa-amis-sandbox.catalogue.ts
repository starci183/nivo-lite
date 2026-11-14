import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { SandboxCatalogue } from "@modules/domain/provider-sandbox"

/** The word of the operation the live twin names in its refusal: AMIS's voucher creation, whose documentation could not be read. */
export const AMIS_SANDBOX_REFUSAL_OPERATION = "voucher.create"

/** The ledger port methods the cases below answer (the port's own method names). */
export const AMIS_SANDBOX_OPERATION = {
    ready: "ready",
    append: "append",
    void: "void",
} as const

/** The ids of the cases the implementation answers (it reads `state.nextCase` against them; the first of each operation is its default). */
export const AMIS_SANDBOX_CASE = {
    /** MISA-AMIS-1 (default of `ready`): a sandbox AMIS account is ready (the live twin is never ready while no operation is built). */
    ready: "MISA-AMIS-1",
    /** MISA-AMIS-2 (default of `append`): the entry is booked as a voucher. */
    appended: "MISA-AMIS-2",
    /** MISA-AMIS-3: AMIS refuses the voucher `not_available` (`voucher.create`, not sent): the live refusal shape. */
    appendRefused: "MISA-AMIS-3",
    /** MISA-AMIS-4: AMIS gives no answer to the voucher: the outcome is unknown. */
    appendNoAnswer: "MISA-AMIS-4",
    /** MISA-AMIS-5 (default of `void`): the void voucher is booked. */
    voided: "MISA-AMIS-5",
    /** MISA-AMIS-6: AMIS refuses the void voucher `not_available` (`voucher.create`, not sent): the live refusal shape. */
    voidRefused: "MISA-AMIS-6",
} as const

/**
 * The hardcoded outbound cases of the MISA AMIS ledger sandbox (R62): ids `MISA-AMIS-<n>`, identical on every machine. The account's
 * sticky NEXT CASE picks one per operation; the first of each operation answers while nothing is picked.
 */
export const AMIS_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: PROVIDER.misaAmis,
    cases: [
        {
            id: AMIS_SANDBOX_CASE.ready,
            label: "A sandbox AMIS account is ready: the ledger tool may pick it (the live twin is never ready while no operation is built)",
            operation: AMIS_SANDBOX_OPERATION.ready,
            default: true,
        },
        {
            id: AMIS_SANDBOX_CASE.appended,
            label: "An entry is appended as a voucher kept in state, answering the running reference SBX-AMIS-<n>",
            operation: AMIS_SANDBOX_OPERATION.append,
            default: true,
        },
        {
            id: AMIS_SANDBOX_CASE.appendRefused,
            label: "AMIS refuses the voucher not_available (voucher.create, not sent), the live refusal shape; nothing is kept",
            operation: AMIS_SANDBOX_OPERATION.append,
        },
        {
            id: AMIS_SANDBOX_CASE.appendNoAnswer,
            label: "AMIS gives no answer to the voucher: the outcome is unknown (proof unknown); nothing is kept",
            operation: AMIS_SANDBOX_OPERATION.append,
        },
        {
            id: AMIS_SANDBOX_CASE.voided,
            label: "The void of a transaction the account appended adds the void voucher, answering the running reference SBX-AMIS-VOID-<n>",
            operation: AMIS_SANDBOX_OPERATION.void,
            default: true,
        },
        {
            id: AMIS_SANDBOX_CASE.voidRefused,
            label: "AMIS refuses the void voucher not_available (voucher.create, not sent), the live refusal shape",
            operation: AMIS_SANDBOX_OPERATION.void,
        },
    ],
}
