/** What removing an agent erases, as the back end counts it: its records (per type, most first) and the files those records hold. */
export interface AgentRemovalImpact {
    readonly records: number
    readonly files: number
    readonly types: ReadonlyArray<{ readonly type: string; readonly title: string; readonly count: number }>
    /**
     * The channels (connections) whose front door this agent is: customers writing there get no answer once it is gone. Absent while the back end
     * does not say (nothing is claimed then); an empty list says the agent is the front door of none.
     */
    readonly channels?: ReadonlyArray<{ readonly provider: string; readonly account: string }>
}

/** The sentences of the removal confirmation. */
export interface AgentRemovalWords {
    /** The agent stops now and cannot start again. */
    readonly stops: string
    /** History, conversations and knowledge stay (an agent that wrote no record). */
    readonly kept: string
    /** The same, said for an agent whose records are erased: the records below are the exception. */
    readonly keptWithErase: string
    /** The line that introduces the list of what is erased. */
    readonly erased: string
    /** One record type with how many records of it are erased. */
    readonly erasedType: (title: string, count: number) => string
    /** The files those records hold that leave the store with them. */
    readonly files: (count: number) => string
    /** It cannot be undone. */
    readonly undone: string
    /** The line that introduces the channels that lose their front door. */
    readonly channelsIntro: string
    /** One channel: the provider's name and the account's name. */
    readonly channelLine: (provider: string, account: string) => string
    /** What the customers of those channels meet: no answer until another agent takes the channel. */
    readonly channelsNote: string
    /** The permissions given to the agent are turned off. */
    readonly accounts: string
    /** The product's own words for a record type id, or null when the catalogue has none (the back end's English fallback title is then said). */
    readonly typeLabel: (type: string) => string | null
}

/** The message key of the product's words for one record type id (`blocks-core.chatbot.message` is `removeType_blocks_core_chatbot_message`). */
export const removeTypeKeyOf = (type: string): string => `removeType_${type.replaceAll(/[^a-zA-Z0-9]/g, "_")}`

/** The channels that lose their front door, neutrally, under what stops: the intro, one line each, what the customers meet; nothing when none is held or known. */
const channelLinesOf = (impact: AgentRemovalImpact, words: AgentRemovalWords): ReadonlyArray<string> => {
    const channels = impact.channels ?? []
    if (channels.length === 0) return []
    return [words.channelsIntro, ...channels.map((entry) => words.channelLine(entry.provider, entry.account)), words.channelsNote]
}

/**
 * The lines the removal dialog says, top to bottom. An agent that holds no record asks the plain confirmation; one that does names each
 * record type with its count, the files that go with them and that it cannot be undone, neutrally, before the one confirm.
 */
export const removalLinesOf = (impact: AgentRemovalImpact, words: AgentRemovalWords): ReadonlyArray<string> => {
    const channels = channelLinesOf(impact, words)
    if (impact.records === 0) return [words.stops, ...channels, words.kept, words.accounts]
    return [
        words.stops,
        ...channels,
        words.erased,
        ...impact.types.map((entry) => words.erasedType(words.typeLabel(entry.type) ?? entry.title, entry.count)),
        ...(impact.files > 0 ? [words.files(impact.files)] : []),
        words.undone,
        words.keptWithErase,
        words.accounts,
    ]
}
