import type { ProviderBoard, TemplateCandidate, TemplateProposal } from "@modules/domain/mcp-gateway"
import type { AbilityWishInput } from "./dto/ability-wish.input"
import type {
    AbilityTickType,
    ProposedAttachmentType,
    ProviderRightsType,
    ProviderTemplateCandidateType,
} from "./dto/provider-rights.type"

/** The ticks of an attachment as a list, in the order they are stored. */
const toTicks = (abilities: Readonly<Record<string, string>>): Array<AbilityTickType> =>
    Object.entries(abilities).map(([id, mode]) => ({ id, mode }))

/** The rights board as its GraphQL type. */
export const toProviderRightsType = (board: ProviderBoard): ProviderRightsType => ({
    providers: board.providers.map((provider) => ({
        ...provider,
        label: { ...provider.label },
        kindLabel: { ...provider.kindLabel },
        abilities: provider.abilities.map((ability) => ({
            ...ability,
            label: { ...ability.label },
            tools: [...ability.tools],
        })),
        accounts: provider.accounts.map((account) => ({
            connectionId: account.connectionId,
            provider: account.provider,
            kind: provider.kind,
            accountLabel: account.label,
            connected: account.connected,
            isDefaultReceiving: account.isDefault,
        })),
    })),
    attachments: board.attachments.map((attachment) => ({
        agentId: attachment.agentId,
        connectionId: attachment.connectionId,
        provider: attachment.provider,
        abilities: toTicks(attachment.abilities),
    })),
})

/** The proposed attachments as GraphQL types. */
export const toProposedAttachmentTypes = (proposal: ReadonlyArray<TemplateProposal>): Array<ProposedAttachmentType> =>
    proposal.map((entry) => ({ ...entry, abilities: toTicks(entry.abilities) }))

/** The template candidates as GraphQL types. */
export const toProviderTemplateCandidateTypes = (
    candidates: ReadonlyArray<TemplateCandidate>,
): Array<ProviderTemplateCandidateType> =>
    candidates.map((entry) => ({ ...entry, abilities: toTicks(entry.abilities) }))

/** The abilities a person wants, by id; the last entry of an id wins. */
export const toAbilityWishes = (abilities: ReadonlyArray<AbilityWishInput>): Readonly<Record<string, string>> =>
    Object.fromEntries(abilities.map((ability) => [ability.id, ability.mode]))
