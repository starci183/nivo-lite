import { contractViewsOf, contractWordsOf, type ContractViews } from "@nivo-lite/agent-sdk/graph"
import { INSTALLED } from "@modules/domain/installed-plugins"

/** The message namespace the plugins put the words of the params their workflows name under (`param.<name>`). */
const PARAM_NAMESPACE = "contract"

/** The words of an agent (module key) a hand-off calls: the installed template agent's own label; undefined for a key no plugin installs. */
export const agentLabelOf = (agent: string, locale: "vi" | "en"): string | undefined => {
    const label = INSTALLED.templateAgentOf(agent)?.label
    return label !== undefined && "vi" in label ? label[locale] : undefined
}

/** The words of ONE param name a workflow names, from the installation; undefined for a name no plugin words. */
const paramLabelOf = (name: string, locale: "vi" | "en"): string | undefined =>
    INSTALLED.messageOf(PARAM_NAMESPACE, `param.${name}`, locale) ?? undefined

/**
 * The contract views of the workflows (triggers, outcomes, entry rule, hand-offs, problems) in the owner's words: the structure and the
 * words of the contract's own vocabulary are NIVO core (`@nivo-lite/agent-sdk/graph`), the words of the agents and params are the
 * installed plugins', read from the installation.
 */
export const CONTRACT_VIEWS: ContractViews = contractViewsOf(contractWordsOf({ agentLabel: agentLabelOf, paramLabel: paramLabelOf }))
