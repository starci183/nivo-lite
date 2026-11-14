import type { RightsTranslate } from "@/components/composites/ProviderRightsCard"
import { accountTitleOf, pickLabel, providerLogoOf, type HeldAccount } from "@/hooks/providerRights"
import type { AgentNodeRightsView } from "@/modules/types"
import type { AccountRowView, AgentConnectionsBaseProps, RightsPageView } from "./types"

type Props = AgentConnectionsBaseProps["props"]

/** "<provider> · <account>" of one held or attachable account. */
export const accountNameOf = (one: HeldAccount, locale: string): string =>
    accountTitleOf(pickLabel(one.provider.label, locale), one.account.accountLabel)

/** The confirm of removing an account from the agent. */
export const detachOf = (t: RightsTranslate, account: string | null, agentName: string): Props["detach"] => ({
    isOpen: account !== null,
    title: t("detachTitle", { provider: account ?? "", agent: agentName }),
    description: t("detachDescription", { agent: agentName }),
    confirm: t("detach"),
    cancel: t("cancel"),
})

/** The geometry of the node-model card while it loads: three accounts. */
export const RIGHTS_PAGE_PLACEHOLDER: RightsPageView = {
    attachedCount: 0,
    accounts: ["a", "b", "c"].map((id): AccountRowView => ({ id, name: "-", line: "-", logo: undefined, isAttached: true })),
}

/** The accounts board of the model switch: the attached accounts and the ones it could still hold. */
interface RightsBoard {
    readonly attached: ReadonlyArray<HeldAccount>
    readonly attachable: ReadonlyArray<HeldAccount>
}

/**
 * What the model switch reads, joined to the accounts board: the accounts the API says the agent is attached to (each with its
 * steps in use line), then the connected ones it could still hold (not attached), the provider named and marked from the board.
 */
export const rightsPageOf = (
    answer: AgentNodeRightsView,
    board: RightsBoard,
    locale: string,
    notAttached: string,
): RightsPageView => {
    const attachedRows = answer.accounts.map((account): AccountRowView => {
        const held = board.attached.find((one) => one.account.connectionId === account.connectionId)
        const provider = held === undefined ? account.providerName : pickLabel(held.provider.label, locale)
        return {
            id: account.connectionId,
            name: account.name,
            line: `${provider} · ${account.stepsLine}`,
            logo: providerLogoOf(held?.provider.provider ?? account.provider),
            isAttached: true,
        }
    })
    const waitingRows = board.attachable.map((one): AccountRowView => {
        const provider = pickLabel(one.provider.label, locale)
        return {
            id: one.account.connectionId,
            name: one.account.accountLabel ?? provider,
            line: `${provider} · ${notAttached}`,
            logo: providerLogoOf(one.provider.provider),
            isAttached: false,
        }
    })
    return { attachedCount: attachedRows.length, accounts: [...attachedRows, ...waitingRows] }
}
