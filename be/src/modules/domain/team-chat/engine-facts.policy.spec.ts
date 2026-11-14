import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { MessageFact } from "@nivo-lite/agent-sdk/team-chat"
import { bankDisplayNameOf } from "@modules/domain/channel-connections"
import type { MessageCatalog } from "@modules/platform/i18n"
import {
    channelFactOf,
    codeFactsOf,
    factWordsOf,
    LINE_FACT,
    LINE_NOT_TOLD,
    reasonWordsOf,
    STUCK_FACT,
    withLineFactsOf,
    wordedStopFactsOf,
} from "./engine-facts.policy"
import { TEAM_CHAT_MESSAGES } from "./messages/team-chat.messages"

/** The real team chat words in English, plus one module refusal and one refusal that waits for a fill-in. */
const WORDS: Readonly<Record<string, string>> = {
    ...TEAM_CHAT_MESSAGES.en,
    "errors.ENTITY_ENGINE_QUERY_INVALID": "The data read request is invalid.",
    "errors.GRAPH_NODES_TOOL_FAILED": "Tool {{tool}} failed: {{reason}}.",
}

/** A catalogue that answers the key itself for a missing key, as the real one does. */
const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => WORDS[key] ?? key) })

const words = factWordsOf({ catalog, locale: "en", bankName: bankDisplayNameOf })

const CONTEXT = {
    workflowTitle: "Reconcile incoming money",
    stepTitle: "Match the transaction",
    question: "Mark it paid or keep the order open?",
    locale: "en" as const,
}

const SUBJECT = Symbol("engine-facts.policy")

/** The policy as Nest provides it. */
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { channelFactOf, codeFactsOf, reasonWordsOf, withLineFactsOf, wordedStopFactsOf } }],
    }).compile()
    return moduleRef.get<{
        readonly channelFactOf: typeof channelFactOf
        readonly codeFactsOf: typeof codeFactsOf
        readonly reasonWordsOf: typeof reasonWordsOf
        readonly withLineFactsOf: typeof withLineFactsOf
        readonly wordedStopFactsOf: typeof wordedStopFactsOf
    }>(SUBJECT)
}

/** The policy, built once; each case awaits it. */
const subject = buildSubject()

/** Every value a person reads on a card: the worded facts only. */
const shownOf = (facts: ReadonlyArray<MessageFact>): string =>
    facts
        .filter((fact) => fact.technical !== true)
        .map((fact) => `${fact.name} ${fact.value}`)
        .join(" | ")

describe("reasonWordsOf: an error code in common words", () => {
    it("takes the engine's own words for its codes", async () => {
        const policy = await subject
        expect(policy.reasonWordsOf(words, "ai_confused")).toBe("The AI could not tell what to do at this step.")
        expect(policy.reasonWordsOf(words, "AI_TASKS_UNAVAILABLE")).toBe("The AI could not be reached after 3 tries.")
    })

    it("takes a module's refusal text when it needs no fill-in", async () => {
        const policy = await subject
        expect(policy.reasonWordsOf(words, "ENTITY_ENGINE_QUERY_INVALID")).toBe("The data read request is invalid.")
    })

    it("falls back to the common system error words for an unknown code or a text that waits for a fill-in, never the code", async () => {
        const policy = await subject
        expect(policy.reasonWordsOf(words, "NOPE_UNKNOWN")).toBe("A system error with no description yet.")
        expect(policy.reasonWordsOf(words, "GRAPH_NODES_TOOL_FAILED")).toBe("A system error with no description yet.")
    })
})

describe("codeFactsOf and channelFactOf", () => {
    it("gives the reason in words and the code as a technical fact", async () => {
        const policy = await subject
        expect(policy.codeFactsOf(words, "ENTITY_ENGINE_QUERY_INVALID")).toEqual([
            { name: "Reason", value: "The data read request is invalid.", technical: false },
            { name: "Error code", value: "ENTITY_ENGINE_QUERY_INVALID", technical: true },
        ])
    })

    it("names a known channel and keeps an unknown channel id technical", async () => {
        const policy = await subject
        expect(policy.channelFactOf(words, "zalo")).toEqual({ name: "Channel", value: "Zalo", technical: false })
        expect(policy.channelFactOf(words, "meta")).toEqual({ name: "Channel", value: "Facebook Messenger", technical: false })
        expect(policy.channelFactOf(words, "x-gw")).toEqual({ name: "Channel", value: "x-gw", technical: true })
    })
})

describe("wordedStopFactsOf: the facts of a stop card in words", () => {
    /** The facts as `stuckFactsOf` names them, then the trouble's data and the step's given values. */
    const RAW: ReadonlyArray<MessageFact> = [
        { name: STUCK_FACT.workflow, value: "accounting.reconcile" },
        { name: STUCK_FACT.step, value: "match (accounting.match-payment)" },
        { name: STUCK_FACT.code, value: "ai_confused" },
        { name: STUCK_FACT.error, value: "AgentConfused: amount differs" },
        { name: STUCK_FACT.subject, value: "bank-transaction:tx-9" },
        { name: STUCK_FACT.question, value: "Mark it paid or keep the order open?" },
        { name: "bankName", value: "MBBANK" },
        { name: "amountVnd", value: "500000" },
        { name: "orderNo", value: "DH-20261110-0003" },
        { name: "transactionId", value: "tx-9" },
        { name: STUCK_FACT.run, value: "run-1" },
    ]

    it("words the workflow, the step, the code, the bank and the amount; keeps every raw value only as technical, worded first", async () => {
        const policy = await subject
        expect(policy.wordedStopFactsOf(RAW, CONTEXT, words)).toEqual([
            { name: "Workflow", value: "Reconcile incoming money", technical: false },
            { name: "Step", value: "Match the transaction", technical: false },
            { name: "Reason", value: "The AI could not tell what to do at this step.", technical: false },
            { name: "Bank", value: "MB Bank", technical: false },
            { name: "Amount", value: "500,000 ₫", technical: false },
            { name: "Order number", value: "DH-20261110-0003", technical: false },
            { name: "Workflow key", value: "accounting.reconcile", technical: true },
            { name: "Step key", value: "match (accounting.match-payment)", technical: true },
            { name: "Error code", value: "ai_confused", technical: true },
            { name: "Raw error", value: "AgentConfused: amount differs", technical: true },
            { name: "Subject", value: "bank-transaction:tx-9", technical: true },
            { name: "transactionId", value: "tx-9", technical: true },
            { name: "Run id", value: "run-1", technical: true },
        ])
    })

    it("shows no raw code, key, id or raw error outside a technical fact", async () => {
        const policy = await subject
        const shown = shownOf(policy.wordedStopFactsOf(RAW, CONTEXT, words))
        for (const raw of ["ai_confused", "accounting.reconcile", "accounting.match-payment", "MBBANK", "run-1", "tx-9", "AgentConfused"]) {
            expect(shown).not.toContain(raw)
        }
    })

    it("formats an amount in dong the Vietnamese way for the Vietnamese team", async () => {
        const policy = await subject
        const vi = factWordsOf({ catalog, locale: "vi", bankName: bankDisplayNameOf })
        const [amount] = policy.wordedStopFactsOf([{ name: "paidVnd", value: "500000" }], { ...CONTEXT, locale: "vi" }, vi)
        expect(amount).toMatchObject({ value: "500.000 ₫", technical: false })
    })

    it("keeps an unlisted bank code, a non-numeric amount and a step with no title as technical facts", async () => {
        const policy = await subject
        const facts = policy.wordedStopFactsOf(
            [
                { name: "bankCode", value: "ZZBANK" },
                { name: "amountVnd", value: "about 5k" },
                { name: STUCK_FACT.step, value: "match (accounting.match-payment)" },
            ],
            { ...CONTEXT, stepTitle: "" },
            words,
        )
        expect(facts.every((fact) => fact.technical === true)).toBe(true)
    })

    it("drops the question fact when the card already asks it", async () => {
        const policy = await subject
        const facts = policy.wordedStopFactsOf([{ name: STUCK_FACT.question, value: CONTEXT.question }], CONTEXT, words)
        expect(facts).toEqual([])
    })

    it("never words a card twice: a fact that carries its technical mark is kept as it is", async () => {
        const policy = await subject
        const once = policy.wordedStopFactsOf(RAW, CONTEXT, words)
        expect(policy.wordedStopFactsOf(once, CONTEXT, words)).toEqual(once)
    })

    it("labels a fact by its key and states no empty reason when there is no catalogue at all", async () => {
        const policy = await subject
        const bare = { text: () => "", bankName: bankDisplayNameOf }
        expect(policy.wordedStopFactsOf([{ name: STUCK_FACT.code, value: "ai_confused" }], CONTEXT, bare)).toEqual([
            { name: "code", value: "ai_confused", technical: true },
        ])
    })
})

/** The raw line facts a stop record hands with a rewrite: not told, for this reason. */
const notToldFacts = (reason: string): ReadonlyArray<MessageFact> => [
    { name: LINE_FACT.told, value: LINE_NOT_TOLD },
    { name: LINE_FACT.reason, value: reason },
]

/** The English words of a catalogue key. */
/** The English words of a catalogue key; empty for a missing key, so an expectation on it can never pass by accident. */
const en = (key: string): string => TEAM_CHAT_MESSAGES.en[key] ?? ""

describe("withLineFactsOf: what a stop says NOW about its holding line, on the stored card", () => {
    const STORED: ReadonlyArray<MessageFact> = [
        { name: en("teamChat.fact.workflow"), value: CONTEXT.workflowTitle, technical: false },
        { name: en("teamChat.fact.stepKey"), value: "match", technical: true },
    ]

    it("words not-told and a known reason, and keeps the raw reason code as a technical fact; worded facts first", async () => {
        const policy = await subject
        const facts = policy.withLineFactsOf(STORED, notToldFacts("ability_off"), words)

        expect(facts).toEqual([
            STORED[0],
            { name: en("teamChat.fact.customerLine"), value: en("teamChat.customerLine.notTold"), technical: false },
            { name: en("teamChat.fact.customerLineReason"), value: en("teamChat.lineReason.ability_off"), technical: false },
            STORED[1],
            { name: en("teamChat.fact.customerLineCode"), value: "ability_off", technical: true },
        ])
        expect(shownOf(facts)).not.toContain("ability_off")
    })

    it("an unknown reason code: only the worded not-told and the technical code, no empty or raw reason in words", async () => {
        const policy = await subject
        const facts = policy.withLineFactsOf([], notToldFacts("channel_no_access"), words)

        expect(facts).toEqual([
            { name: en("teamChat.fact.customerLine"), value: en("teamChat.customerLine.notTold"), technical: false },
            { name: en("teamChat.fact.customerLineCode"), value: "channel_no_access", technical: true },
        ])
    })

    it("replaces the line facts the card showed before instead of repeating them", async () => {
        const policy = await subject
        const once = policy.withLineFactsOf(STORED, notToldFacts("ability_off"), words)
        const twice = policy.withLineFactsOf(once, notToldFacts("not_attached"), words)

        expect(twice).toHaveLength(once.length)
        expect(twice.filter((fact) => fact.name === en("teamChat.fact.customerLine"))).toHaveLength(1)
        expect(twice.filter((fact) => fact.name === en("teamChat.fact.customerLineCode"))).toEqual([
            { name: en("teamChat.fact.customerLineCode"), value: "not_attached", technical: true },
        ])
        expect(shownOf(twice)).toContain(en("teamChat.lineReason.not_attached"))
        expect(shownOf(twice)).not.toContain(en("teamChat.lineReason.ability_off"))
        expect(policy.withLineFactsOf(once, notToldFacts("ability_off"), words)).toEqual(once)
    })

    it("no line fact given (or only facts of another name): the very same stored array", async () => {
        const policy = await subject
        expect(policy.withLineFactsOf(STORED, [], words)).toBe(STORED)
        expect(policy.withLineFactsOf(STORED, [{ name: "amount", value: "1" }], words)).toBe(STORED)
    })

    it("never holds more than 40 facts, and the new line facts are always among them", async () => {
        const policy = await subject
        const full: ReadonlyArray<MessageFact> = Array.from({ length: 40 }, (_, index) => ({
            name: `raw-${String(index)}`,
            value: String(index),
            technical: true,
        }))

        const facts = policy.withLineFactsOf(full, notToldFacts("ability_off"), words)

        expect(facts).toHaveLength(40)
        const lineLabels = [en("teamChat.fact.customerLine"), en("teamChat.fact.customerLineReason"), en("teamChat.fact.customerLineCode")]
        expect(facts.filter((fact) => lineLabels.includes(fact.name))).toHaveLength(3)
        expect(facts).toContainEqual({ name: en("teamChat.fact.customerLineCode"), value: "ability_off", technical: true })
    })
})

describe("wordedStopFactsOf: the line facts of a card first posted with them", () => {
    it("words not-told and the reason, keeps the code technical, and shows no raw code", async () => {
        const policy = await subject
        const facts = policy.wordedStopFactsOf(notToldFacts("route_held"), CONTEXT, words)

        expect(facts).toEqual([
            { name: en("teamChat.fact.customerLine"), value: en("teamChat.customerLine.notTold"), technical: false },
            { name: en("teamChat.fact.customerLineReason"), value: en("teamChat.lineReason.route_held"), technical: false },
            { name: en("teamChat.fact.customerLineCode"), value: "route_held", technical: true },
        ])
        expect(shownOf(facts)).not.toContain("route_held")
        expect(shownOf(facts)).not.toContain(LINE_NOT_TOLD)
    })

    it("a line fact of another value stays raw (technical), and the same card worded twice is unchanged", async () => {
        const policy = await subject
        const facts = policy.wordedStopFactsOf([{ name: LINE_FACT.told, value: "told" }], CONTEXT, words)

        expect(facts).toEqual([{ name: en("teamChat.fact.customerLine"), value: "told", technical: true }])
        expect(policy.wordedStopFactsOf(facts, CONTEXT, words)).toEqual(facts)
    })
})
