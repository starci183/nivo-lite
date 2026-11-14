/** The words of a node id as a name part: `payment.match-code` is `PaymentMatchCode`, `no_match` is `NoMatch`. */
export const namePartOf = (id: string): string =>
    id
        .split(/[.\-_]/u)
        .filter((part) => part !== "")
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join("")

/** The node id of an AI call kind (`<node id>:<tag>`), or the whole kind when it has no tag. */
const callNodeOf = (purpose: string): string => {
    const colon = purpose.lastIndexOf(":")
    return colon < 0 ? purpose : purpose.slice(0, colon)
}

/** Where the words of a key come from, in one language: the installation's or a package's own catalog; null when it has none. */
export type WordLookup = (key: string) => string | null

/**
 * The words of one kind of AI call of a run, for the run page's "AI calls" table: a node's call is named by its step's title
 * (`<Node>Title`), the engine's own calls and the app's fixed tasks by the words the source gives them (`aiCall<Kind>`: `engine:step-trouble`
 * -> `aiCallEngineStepTrouble`); null when the source has none, so the reader falls back on its own words and never shows the raw kind.
 * `lookup` answers a key in the reader's language.
 */
export const aiCallLabelOf = (purpose: string, lookup: WordLookup): string | null => {
    const node = callNodeOf(purpose)
    const title = node.includes(".") ? lookup(`node${namePartOf(node)}Title`) : null
    return title ?? lookup(`aiCall${namePartOf(purpose.replaceAll(":", "."))}`)
}

/** A text in both product languages. */
interface AiCallText {
    /** The Vietnamese words. */
    readonly vi: string
    /** The English words. */
    readonly en: string
}

/**
 * The words of the engine's own AI calls and the app's fixed tasks, by the name part of the call kind (`engine:step-trouble` is
 * `EngineStepTrouble`): these kinds are NIVO core's, not a plugin's, so the words are core's.
 */
export const AI_CALL_WORDS: Readonly<Record<string, AiCallText>> = {
    EngineStepTrouble: { vi: "X\u1eed l\u00fd b\u01b0\u1edbc g\u1eb7p s\u1ef1 c\u1ed1", en: "Handling a stuck step" },
    Engine: { vi: "L\u01b0\u1ee3t x\u1eed l\u00fd", en: "Engine work" },
    Embedding: { vi: "T\u00ecm theo ngh\u0129a", en: "Meaning search" },
    Brain: { vi: "\u0110\u1ecdc t\u00e0i li\u1ec7u", en: "Reading documents" },
    Guide: { vi: "H\u01b0\u1edbng d\u1eabn", en: "Guide" },
    Setup: { vi: "C\u00e0i \u0111\u1eb7t agent", en: "Agent setup" },
}

/**
 * The words of one kind of AI call of a run, like `aiCallLabelOf`, with the node's words read from where the node is DECLARED: `titleOf`
 * gives the title of a node id in a language (the installed step's title), null for an id no node has. The engine's own calls and the
 * app's fixed tasks take `AI_CALL_WORDS`; null when neither has words.
 */
export const aiCallLabelWith = (
    purpose: string,
    locale: "vi" | "en",
    titleOf: (nodeId: string, locale: "vi" | "en") => string | null,
): string | null => {
    const node = callNodeOf(purpose)
    const title = node.includes(".") ? titleOf(node, locale) : null
    if (title !== null) return title
    const part = namePartOf(purpose.replaceAll(":", "."))
    return Object.hasOwn(AI_CALL_WORDS, part) ? (AI_CALL_WORDS[part]?.[locale] ?? null) : null
}
