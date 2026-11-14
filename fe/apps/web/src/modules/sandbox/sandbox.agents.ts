import type { ProviderRightsQuery, SandboxAccountsQuery } from "@/modules/api"
import type { SandboxAgentsData } from "@/modules/types"

/** One sandbox account as the back end answers it. */
type SandboxAccountWire = SandboxAccountsQuery["sandboxAccounts"][number]

/** What is attached to which agent, as the provider rights read answers it. */
type AttachmentWire = ProviderRightsQuery["providerRights"]["attachments"][number]

/**
 * The agents the account is attached to. Where an agent holds several accounts of the account's provider, the one it uses by default
 * wears the mark and the others may be made default; an agent with one account of the provider has no default to speak of. While the
 * attachments are not read (`undefined`) no default is shown.
 */
export const agentsDataOf = (
    account: SandboxAccountWire,
    attachments: ReadonlyArray<AttachmentWire> | undefined,
): SandboxAgentsData => ({
    rows: account.agents.map((agent) => {
        const held = (attachments ?? []).filter(
            (attachment) => attachment.agentId === agent.id && attachment.provider === account.provider,
        )
        const isSeveral = held.length > 1
        const isDefault = isSeveral && held.some((one) => one.connectionId === account.id && one.isDefault)
        return { id: agent.id, name: agent.label, isDefault, canSetDefault: isSeveral && !isDefault }
    }),
})
