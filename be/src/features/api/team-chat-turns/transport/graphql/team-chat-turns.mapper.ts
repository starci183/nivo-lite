import type { CaptureChatTruthRequest } from "../../application/capture-chat-truth.contracts"
import type { CaptureChatTruthInput } from "./dto/capture-chat-truth.input"

/** The capture request of the GraphQL input: absent members are null. */
export const toCaptureChatTruthRequest = (workspaceId: string, input: CaptureChatTruthInput): CaptureChatTruthRequest => ({
    workspaceId,
    messageId: input.messageId,
    agentId: input.agentId ?? null,
    fact:
        input.fact === undefined
            ? null
            : {
                  subjectLabel: input.fact.subjectLabel,
                  attributeLabel: input.fact.attributeLabel,
                  value: input.fact.value ?? null,
                  unit: input.fact.unit ?? null,
                  validFrom: input.fact.validFrom ?? null,
                  validTo: input.fact.validTo ?? null,
              },
})
