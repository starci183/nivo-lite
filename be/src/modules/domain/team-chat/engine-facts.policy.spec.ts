import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { MessageFact } from "@nivo-lite/blocks-core"
import { bankDisplayNameOf } from "@modules/domain/channel-connections"
import type { MessageCatalog } from "@modules/platform/i18n"
import {
    channelFactOf,
    codeFactsOf,
    factWordsOf,
    reasonWordsOf,
    STUCK_FACT,
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
        providers: [{ provide: SUBJECT, useValue: { channelFactOf, codeFactsOf, reasonWordsOf, wordedStopFactsOf } }],
    }).compile()
    return moduleRef.get<{
        readonly channelFactOf: typeof channelFactOf
        readonly codeFactsOf: typeof codeFactsOf
        readonly reasonWordsOf: typeof reasonWordsOf
        readonly wordedStopFactsOf: typeof wordedStopFactsOf
    }>(SUBJECT)
}

let policy: Awaited<ReturnType<typeof buildSubject>>

beforeAll(async () => {
    policy = await buildSubject()
})

/** Every value a person reads on a card: the worded facts only. */
const shownOf = (facts: ReadonlyArray<MessageFact>): string =>
    facts
        .filter((fact) => fact.technical !== true)
        .map((fact) => `${fact.name} ${fact.value}`)
        .join(" | ")

describe("reasonWordsOf: an error code in common words", () => {
    it("takes the engine's own words for its codes", () => {
        expect(policy.reasonWordsOf(words, "ai_confused")).toBe("The AI could not tell what to do at this step.")
        expect(policy.reasonWordsOf(words, "AI_TASKS_UNAVAILABLE")).toBe("The AI could not be reached after 3 tries.")
    })

    it("takes a module's refusal text when it needs no fill-in", () => {
        expect(policy.reasonWordsOf(words, "ENTITY_ENGINE_QUERY_INVALID")).toBe("The data read request is invalid.")
    })

    it("falls back to the common system error words for an unknown code or a text that waits for a fill-in, never the code", () => {
        expect(policy.reasonWordsOf(words, "NOPE_UNKNOWN")).toBe("A system error with no description yet.")
        expect(policy.reasonWordsOf(words, "GRAPH_NODES_TOOL_FAILED")).toBe("A system error with no description yet.")
    })
})

describe("codeFactsOf and channelFactOf", () => {
    it("gives the reason in words and the code as a technical fact", () => {
        expect(policy.codeFactsOf(words, "ENTITY_ENGINE_QUERY_INVALID")).toEqual([
            { name: "Reason", value: "The data read request is invalid.", technical: false },
            { name: "Error code", value: "ENTITY_ENGINE_QUERY_INVALID", technical: true },
        ])
    })

    it("names a known channel and keeps an unknown channel id technical", () => {
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

    it("words the workflow, the step, the code, the bank and the amount; keeps every raw value only as technical, worded first", () => {
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

    it("shows no raw code, key, id or raw error outside a technical fact", () => {
        const shown = shownOf(policy.wordedStopFactsOf(RAW, CONTEXT, words))
        for (const raw of ["ai_confused", "accounting.reconcile", "accounting.match-payment", "MBBANK", "run-1", "tx-9", "AgentConfused"]) {
            expect(shown).not.toContain(raw)
        }
    })

    it("formats an amount in dong the Vietnamese way for the Vietnamese team", () => {
        const vi = factWordsOf({ catalog, locale: "vi", bankName: bankDisplayNameOf })
        const [amount] = policy.wordedStopFactsOf([{ name: "paidVnd", value: "500000" }], { ...CONTEXT, locale: "vi" }, vi)
        expect(amount).toMatchObject({ value: "500.000 ₫", technical: false })
    })

    it("keeps an unlisted bank code, a non-numeric amount and a step with no title as technical facts", () => {
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

    it("drops the question fact when the card already asks it", () => {
        const facts = policy.wordedStopFactsOf([{ name: STUCK_FACT.question, value: CONTEXT.question }], CONTEXT, words)
        expect(facts).toEqual([])
    })

    it("never words a card twice: a fact that carries its technical mark is kept as it is", () => {
        const once = policy.wordedStopFactsOf(RAW, CONTEXT, words)
        expect(policy.wordedStopFactsOf(once, CONTEXT, words)).toEqual(once)
    })

    it("labels a fact by its key and states no empty reason when there is no catalogue at all", () => {
        const bare = { text: () => "", bankName: bankDisplayNameOf }
        expect(policy.wordedStopFactsOf([{ name: STUCK_FACT.code, value: "ai_confused" }], CONTEXT, bare)).toEqual([
            { name: "code", value: "ai_confused", technical: true },
        ])
    })
})
