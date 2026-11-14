import type { Locale } from "@modules/platform/i18n"
import type { DecideAgentRunStepRequest } from "../../application/decide-agent-run-step.contracts"
import type { DecideAgentRunStepInput } from "./dto/decide-agent-run-step.input"

/** Maps the answer of the GraphQL input, with the workspace it names and the language of the caller, to the request that takes it. */
export const toDecideAgentRunStepRequest = (
    workspaceId: string,
    input: DecideAgentRunStepInput,
    locale: Locale,
): DecideAgentRunStepRequest => ({
    workspaceId,
    installationId: input.installationId,
    runId: input.runId,
    verdict: input.verdict,
    stepKey: input.stepKey,
    locale,
})
