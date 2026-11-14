import type { ProviderBoard, TemplateCandidate, TemplateProposal } from "@modules/domain/tools"
import type {
    ProposedAttachmentType,
    ProviderRightsType,
    ProviderTemplateCandidateType,
} from "./dto/provider-rights.type"

/** The provider board as its GraphQL type; a provider's tools are the ones its abilities list (information, not a right). */
export const toProviderRightsType = (board: ProviderBoard): ProviderRightsType => ({
    providers: board.providers.map((provider) => ({
        provider: provider.provider,
        label: { ...provider.label },
        kind: provider.kind,
        kindLabel: { ...provider.kindLabel },
        connected: provider.connected,
        tools: [...new Set(provider.abilities.flatMap((ability) => ability.tools))],
        accounts: provider.accounts.map((account) => ({
            connectionId: account.connectionId,
            provider: account.provider,
            kind: provider.kind,
            accountLabel: account.label,
            connected: account.connected,
        })),
    })),
    attachments: board.attachments.map((attachment) => ({
        agentId: attachment.agentId,
        connectionId: attachment.connectionId,
        provider: attachment.provider,
        isDefault: attachment.isDefault === true,
    })),
})

/** The proposed attachments as GraphQL types. */
export const toProposedAttachmentTypes = (proposal: ReadonlyArray<TemplateProposal>): Array<ProposedAttachmentType> =>
    proposal.map((entry) => ({
        provider: entry.provider,
        connectionId: entry.connectionId,
        accountLabel: entry.accountLabel,
        connected: entry.connected,
    }))

/** The template candidates as GraphQL types. */
export const toProviderTemplateCandidateTypes = (
    candidates: ReadonlyArray<TemplateCandidate>,
): Array<ProviderTemplateCandidateType> =>
    candidates.map((entry) => ({ agentId: entry.agentId, agentName: entry.agentName, module: entry.module }))
