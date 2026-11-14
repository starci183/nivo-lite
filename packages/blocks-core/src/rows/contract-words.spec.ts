import {
    AI_CALL_WORDS,
    CONDITION_WORDS,
    CONTRACT_PROBLEM_WORDS,
    CONTRACT_TYPE_WORDS,
    ENTRY_WORDS,
    PATH_SEPARATOR_WORDS,
    TRIGGER_SOURCE_WORDS,
    VERSION_LATEST_WORDS,
    VERSION_PINNED_WORDS,
    contractViewsOf,
    contractWordsOf,
    type ViewLocale,
} from "@nivo-lite/agent-sdk/graph"
import { corePlugin } from "../plugin"
import { bilingualOf, messageNamed, messageOf, type MessageKey } from "../messages/catalog"
import vi from "../messages/vi.json"
import { AGENT_LABELS, CONTRACT_TYPE_LABELS, ENTRY_LABELS, PARAM_LABELS, TRIGGER_SOURCE_LABELS } from "./workflow-contract-view"
import * as contract from "./workflow-contract-view"

const LOCALES: ReadonlyArray<ViewLocale> = ["vi", "en"]

const isMessageKey = (key: string): key is MessageKey => key in vi

/** The catalog key name of a contract problem code (`CALL_TARGET_UNKNOWN` is `contractProblemCallTargetUnknown`). */
const problemKeyOf = (code: string): string =>
    `contractProblem${code
        .toLowerCase()
        .split("_")
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join("")}`

describe("the contract's own words live in agent-sdk, the engine reads them there", () => {
    it("are the catalog's words, key by key, so the editor and the engine word a contract alike", () => {
        expect(TRIGGER_SOURCE_WORDS).toEqual(TRIGGER_SOURCE_LABELS)
        expect(ENTRY_WORDS).toEqual(ENTRY_LABELS)
        expect(CONTRACT_TYPE_WORDS).toEqual(CONTRACT_TYPE_LABELS)
        expect(PATH_SEPARATOR_WORDS).toEqual(bilingualOf("contractParamPathSeparator"))
        expect(VERSION_LATEST_WORDS).toEqual(bilingualOf("contractVersionLatest"))
        expect(VERSION_PINNED_WORDS).toEqual(bilingualOf("contractVersionPinned"))
        expect(CONDITION_WORDS).toEqual({
            equals: bilingualOf("contractConditionEquals"),
            "not-equals": bilingualOf("contractConditionNotEquals"),
            in: bilingualOf("contractConditionIn"),
            contains: bilingualOf("contractConditionContains"),
            present: bilingualOf("contractConditionPresent"),
        })
    })

    it("hold every contract problem the catalog words", () => {
        const catalogued = Object.keys(vi).filter((key) => key.startsWith("contractProblem"))
        expect(Object.keys(CONTRACT_PROBLEM_WORDS).map(problemKeyOf).sort()).toEqual(catalogued.sort())
        for (const [code, words] of Object.entries(CONTRACT_PROBLEM_WORDS)) {
            const key = problemKeyOf(code)
            expect(isMessageKey(key)).toBe(true)
            if (isMessageKey(key)) expect(words).toEqual(bilingualOf(key))
        }
    })

    it("hold the words of the engine's AI calls the catalog words", () => {
        for (const [part, words] of Object.entries(AI_CALL_WORDS)) {
            for (const locale of LOCALES) expect(words[locale]).toBe(messageNamed(locale, `aiCall${part}`))
        }
        expect(Object.keys(AI_CALL_WORDS)).toHaveLength(Object.keys(vi).filter((key) => key.startsWith("aiCall")).length)
    })
})

describe("what the plugin installs for the engine's contract views equals what the editor words", () => {
    const names = {
        agentLabel: (agent: string, locale: ViewLocale): string | undefined => {
            const label = corePlugin.templateAgents?.find((one) => one.key === agent)?.label
            return label !== undefined && "vi" in label ? label[locale] : undefined
        },
        paramLabel: (name: string, locale: ViewLocale): string | undefined =>
            corePlugin.messages?.contract?.[locale][`param.${name}`],
    }
    const installed = contractViewsOf(contractWordsOf(names))

    it("names every installed agent as the catalog's agent words do", () => {
        const agents = corePlugin.templateAgents ?? []
        expect(agents.length).toBeGreaterThan(0)
        for (const agent of agents) {
            for (const locale of LOCALES) {
                const own = names.agentLabel(agent.key, locale)
                expect(own).toBeDefined()
                if (Object.hasOwn(AGENT_LABELS, agent.key)) expect(own).toBe(AGENT_LABELS[agent.key]?.[locale])
            }
        }
        expect(Object.keys(AGENT_LABELS).filter((key) => key !== "accounting")).toEqual(
            expect.arrayContaining(["sales", "chatbot"]),
        )
        expect(names.agentLabel("sales", "vi")).toBe(messageOf("vi", "contractAgentSales"))
    })

    it("words every param the catalog words, in both languages", () => {
        expect(Object.keys(corePlugin.messages?.contract?.vi ?? {}).sort()).toEqual(
            Object.keys(PARAM_LABELS).map((name) => `param.${name}`).sort(),
        )
        for (const [name, words] of Object.entries(PARAM_LABELS)) {
            for (const locale of LOCALES) expect(names.paramLabel(name, locale)).toBe(words[locale])
        }
    })

    it("words a contract problem exactly as the editor's views do, params and dotted paths included", () => {
        const problems = [
            { code: "CALL_INPUT_MISSING", at: "hand.leadId" },
            { code: "OUTCOME_OUTPUT_TYPE", at: "outcomes.sell.amountVnd" },
            { code: "TRIGGER_INPUT_UNSUPPLIED", at: "triggers.zalo.paymentClaim.amountVnd" },
            { code: "CALL_TARGET_UNKNOWN", at: "hand" },
        ] as const
        for (const problem of problems) {
            for (const locale of LOCALES) {
                expect(installed.contractProblemText(problem, locale, { hand: "Hand off" })).toBe(
                    contract.contractProblemText(problem, locale, { hand: "Hand off" }),
                )
            }
        }
    })
})
