import { aiCallLabelWith } from "@nivo-lite/agent-sdk/graph"
import { INSTALLED } from "@modules/domain/installed-plugins"

/** The namespace the plugins put the words of a step whose title is written as a catalog key under (the step id is the key). */
const TITLE_NAMESPACE = "node-title"

/** The title of an installed step in a language: its declaration's own words, else the plugin's words for a title written as a key; null for an id no plugin installs. */
const titleOf = (nodeId: string, locale: "vi" | "en"): string | null => {
    const title = INSTALLED.stepOf(nodeId)?.title
    if (title === undefined) return null
    return "vi" in title ? title[locale] : INSTALLED.messageOf(TITLE_NAMESPACE, nodeId, locale)
}

/**
 * The words of one kind of AI call of a run, for the run page's "AI calls" table: a node's call is named by its installed step's title, the
 * engine's own calls and the app's fixed tasks by the core words (`@nivo-lite/agent-sdk/graph`); null when neither has words, so the page
 * falls back on its own and never shows the raw kind.
 */
export const aiCallLabelOf = (purpose: string, locale: "vi" | "en"): string | null => aiCallLabelWith(purpose, locale, titleOf)
