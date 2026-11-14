import type { ContractProblem, ContractType, EntryOpenTo, TriggerCondition, TriggerSourceKind } from "../workflow-contract"
import type { ContractWords, ViewLocale } from "./contract-view"

/*
 * The words of the workflow contract's own vocabulary, in both product languages: the trigger source kinds, entry rules, contract types,
 * condition operators and contract problems are NIVO core (the engine defines them), so their words are core's too. What a plugin owns is
 * the words of ITS names: its agents and the params its workflows name (`ContractNames`). `contractWordsOf` joins the two.
 */

/** A text in both product languages. */
export interface ContractText {
    /** The Vietnamese words. */
    readonly vi: string
    /** The English words. */
    readonly en: string
}

/** The words of each trigger source kind. */
export const TRIGGER_SOURCE_WORDS: Readonly<Record<TriggerSourceKind, ContractText>> = {
    zalo: { vi: "Zalo", en: "Zalo" },
    telegram: { vi: "Telegram", en: "Telegram" },
    facebook: { vi: "Facebook", en: "Facebook" },
    instagram: { vi: "Instagram", en: "Instagram" },
    website: { vi: "Trang web", en: "Website" },
    sepay: { vi: "SePay", en: "SePay" },
    timer: { vi: "H\u1eb9n gi\u1edd ch\u0103m s\u00f3c", en: "Care timer" },
    schedule: { vi: "L\u1ecbch", en: "Schedule" },
    "chats-group": { vi: "Nh\u00f3m chat", en: "Group chat" },
    workflow: { vi: "\u0110\u01b0\u1ee3c quy tr\u00ecnh kh\u00e1c g\u1ecdi", en: "Called by another workflow" },
    provider: { vi: "S\u1ef1 ki\u1ec7n t\u1eeb k\u1ebft n\u1ed1i", en: "An event of a connected account" },
}

/** The words of each entry rule. */
export const ENTRY_WORDS: Readonly<Record<EntryOpenTo, ContractText>> = {
    any: { vi: "M\u1ecdi quy tr\u00ecnh \u0111\u01b0\u1ee3c g\u1ecdi", en: "Any workflow may call" },
    agent: { vi: "Ch\u1ec9 quy tr\u00ecnh c\u1ee7a agent n\u00e0y", en: "Only this agent's workflows" },
}

/** The words of each contract type. */
export const CONTRACT_TYPE_WORDS: Readonly<Record<ContractType, ContractText>> = {
    string: { vi: "ch\u1eef", en: "text" },
    number: { vi: "s\u1ed1", en: "number" },
    integer: { vi: "s\u1ed1 nguy\u00ean", en: "whole number" },
    boolean: { vi: "c\u00f3/kh\u00f4ng", en: "yes/no" },
    object: { vi: "\u0111\u1ed1i t\u01b0\u1ee3ng", en: "object" },
    array: { vi: "danh s\u00e1ch", en: "list" },
}

/** The words of each trigger condition operator. */
export const CONDITION_WORDS: Readonly<Record<TriggerCondition["op"], ContractText>> = {
    equals: { vi: "l\u00e0", en: "is" },
    "not-equals": { vi: "kh\u00e1c", en: "is not" },
    in: { vi: "l\u00e0 m\u1ed9t trong", en: "is one of" },
    contains: { vi: "c\u00f3 ch\u1ee9a", en: "contains" },
    present: { vi: "c\u00f3 gi\u00e1 tr\u1ecb", en: "is set" },
}

/** The words of each contract problem, filled with where it is (`{where}`) and which param (`{name}`). */
export const CONTRACT_PROBLEM_WORDS: Readonly<Record<ContractProblem["code"], ContractText>> = {
    "TRIGGER_INPUT_UNSUPPLIED": { vi: "Ngu\u1ed3n c\u1ee7a \u0111\u1ea7u v\u00e0o {where} kh\u00f4ng cung c\u1ea5p tham s\u1ed1 b\u1eaft bu\u1ed9c {name}.", en: "The source of input {where} does not supply the required param {name}." },
    "TRIGGER_INPUT_TYPE": { vi: "Ngu\u1ed3n c\u1ee7a \u0111\u1ea7u v\u00e0o {where} cung c\u1ea5p {name} sai ki\u1ec3u.", en: "The source of input {where} supplies {name} with the wrong type." },
    "TRIGGER_CONNECTION_INVALID": { vi: "Ngu\u1ed3n c\u1ee7a \u0111\u1ea7u v\u00e0o {where} kh\u00f4ng d\u00f9ng t\u00e0i kho\u1ea3n k\u1ebft n\u1ed1i.", en: "The source of input {where} takes no connection." },
    "TRIGGER_CONDITION_UNKNOWN": { vi: "\u0110i\u1ec1u ki\u1ec7n c\u1ee7a \u0111\u1ea7u v\u00e0o {where} \u0111\u1ecdc {name}, ngu\u1ed3n n\u00e0y kh\u00f4ng c\u00f3.", en: "A condition of input {where} reads {name}, which the source does not supply." },
    "TRIGGER_PROVIDER_UNNAMED": { vi: "Ngu\u1ed3n c\u1ee7a \u0111\u1ea7u v\u00e0o {where} ph\u1ea3i ghi r\u00f5 nh\u00e0 cung c\u1ea5p v\u00e0 s\u1ef1 ki\u1ec7n (ch\u1ec9 ngu\u1ed3n s\u1ef1 ki\u1ec7n t\u1eeb k\u1ebft n\u1ed1i m\u1edbi ghi).", en: "The source of input {where} must name its provider and trigger (and only a connected-account event source names them)." },
    "TRIGGER_PROVIDER_UNKNOWN": { vi: "Ngu\u1ed3n c\u1ee7a \u0111\u1ea7u v\u00e0o {where} \u0111\u0103ng k\u00fd m\u1ed9t s\u1ef1 ki\u1ec7n m\u00e0 kh\u00f4ng nh\u00e0 cung c\u1ea5p n\u00e0o khai b\u00e1o.", en: "The source of input {where} registers on a trigger no provider declares." },
    "TRIGGER_FILTER_INVALID": { vi: "B\u1ed9 l\u1ecdc c\u1ee7a \u0111\u1ea7u v\u00e0o {where} so s\u00e1nh {name}, tr\u01b0\u1eddng n\u00e0y kh\u00f4ng \u0111\u01b0\u1ee3c l\u1ecdc (ch\u1ec9 l\u1ecdc theo l\u1ef1a ch\u1ecdn c\u00f3 s\u1eb5n, b\u1eb1ng ho\u1eb7c c\u00f3 m\u1eb7t).", en: "The filter of input {where} compares {name}, which cannot be filtered on (closed choices only, by equality or presence)." },
    "TRIGGER_KEY_DUPLICATE": { vi: "Hai \u0111\u1ea7u v\u00e0o c\u00f9ng t\u00ean {where}.", en: "Two inputs share the name {where}." },
    "CONTRACT_INPUT_DUPLICATE": { vi: "Hai tham s\u1ed1 \u0111\u1ea7u v\u00e0o c\u00f9ng t\u00ean {name}.", en: "Two inputs share the name {name}." },
    "CALL_TARGET_UNKNOWN": { vi: "B\u01b0\u1edbc {where} g\u1ecdi m\u1ed9t quy tr\u00ecnh kh\u00f4ng c\u00f3 trong c\u1eeda h\u00e0ng.", en: "Step {where} calls a workflow the shop does not have." },
    "CALL_VERSION_UNKNOWN": { vi: "B\u01b0\u1edbc {where} ghim m\u1ed9t phi\u00ean b\u1ea3n kh\u00f4ng c\u00f3 c\u1ee7a quy tr\u00ecnh \u0111\u01b0\u1ee3c g\u1ecdi.", en: "Step {where} pins a version the called workflow does not have." },
    "CALL_INPUT_MISSING": { vi: "B\u01b0\u1edbc {where} ch\u01b0a truy\u1ec1n tham s\u1ed1 b\u1eaft bu\u1ed9c {name} c\u1ee7a quy tr\u00ecnh \u0111\u01b0\u1ee3c g\u1ecdi.", en: "Step {where} does not pass the required param {name} of the called workflow." },
    "CALL_INPUT_UNKNOWN": { vi: "B\u01b0\u1edbc {where} truy\u1ec1n {name}, quy tr\u00ecnh \u0111\u01b0\u1ee3c g\u1ecdi kh\u00f4ng nh\u1eadn tham s\u1ed1 n\u00e0y.", en: "Step {where} passes {name}, which the called workflow does not take." },
    "CALL_INPUT_TYPE": { vi: "B\u01b0\u1edbc {where} truy\u1ec1n {name} sai ki\u1ec3u so v\u1edbi quy tr\u00ecnh \u0111\u01b0\u1ee3c g\u1ecdi.", en: "Step {where} passes {name} with a type the called workflow does not take." },
    "CALL_ENTRY_CLOSED": { vi: "B\u01b0\u1edbc {where} g\u1ecdi m\u1ed9t quy tr\u00ecnh ch\u1ec9 m\u1edf cho ch\u00ednh agent c\u1ee7a n\u00f3.", en: "Step {where} calls a workflow open only to its own agent." },
    "OUTCOME_DUPLICATE": { vi: "Hai k\u1ebft qu\u1ea3 ho\u1eb7c hai tr\u01b0\u1eddng c\u00f9ng t\u00ean {where}.", en: "Two outcomes or fields share {where}." },
    "OUTCOME_UNKNOWN": { vi: "B\u01b0\u1edbc {where} k\u1ebft th\u00fac \u1edf m\u1ed9t k\u1ebft qu\u1ea3 quy tr\u00ecnh kh\u00f4ng khai b\u00e1o.", en: "Step {where} ends on an outcome the workflow does not declare." },
    "OUTCOME_OUTPUT_MISSING": { vi: "B\u01b0\u1edbc {where} ch\u01b0a \u0111i\u1ec1n tr\u01b0\u1eddng {name} c\u1ee7a k\u1ebft qu\u1ea3.", en: "Step {where} does not fill the outcome field {name}." },
    "OUTCOME_OUTPUT_UNKNOWN": { vi: "B\u01b0\u1edbc {where} \u0111i\u1ec1n {name}, k\u1ebft qu\u1ea3 kh\u00f4ng c\u00f3 tr\u01b0\u1eddng n\u00e0y.", en: "Step {where} fills {name}, which the outcome does not have." },
    "OUTCOME_OUTPUT_TYPE": { vi: "B\u01b0\u1edbc {where} \u0111i\u1ec1n {name} sai ki\u1ec3u.", en: "Step {where} fills {name} with the wrong type." },
}

/** The separator of a dotted param path worded member by member. */
export const PATH_SEPARATOR_WORDS: ContractText = { vi: " \u00b7 ", en: " \u00b7 " }

/** The words of the latest version of a called workflow. */
export const VERSION_LATEST_WORDS: ContractText = { vi: "B\u1ea3n m\u1edbi nh\u1ea5t", en: "Latest version" }

/** The words of a pinned version, with `{version}` where the number goes. */
export const VERSION_PINNED_WORDS: ContractText = { vi: "B\u1ea3n {version}", en: "Version {version}" }

/** The words a plugin owns: of its agents (by module key) and of the params its workflows name; undefined for a name it has none for. */
export interface ContractNames {
    /** The words of the agent (module key) a hand-off calls. */
    readonly agentLabel: (agent: string, locale: ViewLocale) => string | undefined
    /** The words of ONE param name (never a dotted path). */
    readonly paramLabel: (name: string, locale: ViewLocale) => string | undefined
}

/** The words of the contract views: NIVO core's own vocabulary, with the plugin's names handed in. */
export const contractWordsOf = (names: ContractNames): ContractWords => ({
    sourceLabel: (kind, locale) => TRIGGER_SOURCE_WORDS[kind][locale],
    entryLabel: (openTo, locale) => ENTRY_WORDS[openTo][locale],
    typeLabel: (type, locale) => CONTRACT_TYPE_WORDS[type][locale],
    conditionWord: (op, locale) => CONDITION_WORDS[op][locale],
    paramLabel: names.paramLabel,
    pathSeparator: (locale) => PATH_SEPARATOR_WORDS[locale],
    versionLatest: (locale) => VERSION_LATEST_WORDS[locale],
    versionPinned: (locale) => VERSION_PINNED_WORDS[locale],
    problem: (code, locale) => CONTRACT_PROBLEM_WORDS[code][locale],
    agentLabel: names.agentLabel,
})
