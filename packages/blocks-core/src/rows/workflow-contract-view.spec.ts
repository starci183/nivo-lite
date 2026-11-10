import { CONTRACT_TYPES, TRIGGER_SOURCE_KINDS } from "@nivo-lite/agent-sdk/graph"
import type { ContractProblem, GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion, workflowTemplateOf } from "../modules/workflow-templates"
import {
    AGENT_LABELS,
    CONTRACT_TYPE_LABELS,
    ENTRY_LABELS,
    PARAM_LABELS,
    TRIGGER_SOURCE_LABELS,
    bindingViewOf,
    bindingViewsOf,
    callEdgesOf,
    callViewOf,
    contractProblemText,
    entryViewOf,
    outcomeEndViewOf,
    outcomeViewsOf,
    paramLabelOf,
    triggerViewsOf,
} from "./workflow-contract-view"

/** The graph a template ships now. */
const graphOf = (id: string): GraphSpec => {
    const template = workflowTemplateOf(id)
    if (template === null) throw new Error(`no template ${id}`)
    return latestTemplateVersion(template).graph
}

const chatbotSpec: GraphSpec = graphOf("chatbot.front-desk")
const accountingSpec: GraphSpec = graphOf("accounting.reconcile")
const salesSpec: GraphSpec = graphOf("sales.consult")

const nodeOf = (spec: GraphSpec, key: string): GraphSpecNode => {
    const [found] = spec.nodes.filter((node) => node.key === key)
    return found ?? { key, kind: "execute", step: "missing" }
}

describe("the words", () => {
    it("have a Vietnamese and an English text for every source kind, entry rule and contract type", () => {
        for (const kind of TRIGGER_SOURCE_KINDS) {
            expect(TRIGGER_SOURCE_LABELS[kind].vi).not.toBe("")
            expect(TRIGGER_SOURCE_LABELS[kind].en).not.toBe("")
        }
        for (const type of CONTRACT_TYPES) {
            expect(CONTRACT_TYPE_LABELS[type].vi).not.toBe("")
            expect(CONTRACT_TYPE_LABELS[type].en).not.toBe("")
        }
        expect(ENTRY_LABELS.any).toEqual({ vi: "M\u1ecdi quy tr\u00ecnh \u0111\u01b0\u1ee3c g\u1ecdi", en: "Any workflow may call" })
        expect(ENTRY_LABELS.agent.en).toBe("Only this agent's workflows")
        expect(AGENT_LABELS.sales).toEqual({ vi: "B\u00e1n h\u00e0ng", en: "Sales" })
        expect(AGENT_LABELS.accounting).toEqual({ vi: "K\u1ebf to\u00e1n", en: "Accounting" })
    })

    it("name every param in both languages", () => {
        for (const [name, words] of Object.entries(PARAM_LABELS)) {
            expect([name, words.vi === ""]).toEqual([name, false])
            expect([name, words.en === ""]).toEqual([name, false])
        }
    })

    it("show the name of a param that has no words", () => {
        expect(paramLabelOf("leadId", "vi")).toBe("Kh\u00e1ch")
        expect(paramLabelOf("leadId", "en")).toBe("Customer")
        expect(paramLabelOf("somethingNew", "vi")).toBe("somethingNew")
    })
})

describe("bindingViewOf and bindingViewsOf", () => {
    it("draws a ref as a chip with its path and no fallback when it has none", () => {
        expect(bindingViewOf("leadId", { $ref: "trigger.leadId" })).toEqual({
            name: "leadId",
            label: "Kh\u00e1ch",
            kind: "ref",
            text: "= trigger.leadId",
            ref: "trigger.leadId",
            fallback: null,
        })
    })

    it("writes out the default of a ref, null included", () => {
        expect(bindingViewOf("address", { $ref: "lead.address", default: null }, "en")).toMatchObject({
            label: "Address",
            fallback: "null",
        })
        expect(bindingViewOf("text", { $ref: "trigger.text", default: "Xin ch\u00e0o" }).fallback).toBe("Xin ch\u00e0o")
        expect(bindingViewOf("items", { $ref: "trigger.items", default: [] }).fallback).toBe("[]")
    })

    it("draws anything else as a fixed value: words as they are, other values as JSON", () => {
        expect(bindingViewOf("text", "Em \u0111\u00e3 nh\u1eadn \u1ea3nh")).toMatchObject({ kind: "fixed", text: "Em \u0111\u00e3 nh\u1eadn \u1ea3nh", ref: null, fallback: null })
        expect(bindingViewOf("max", 5).text).toBe("5")
        expect(bindingViewOf("flag", false).text).toBe("false")
        expect(bindingViewOf("items", [1, "a"]).text).toBe('[1,"a"]')
        expect(bindingViewOf("nothing", null).text).toBe("null")
        expect(bindingViewOf("nothing", undefined).text).toBe("null")
    })

    it("does not take an object without a string $ref for a ref", () => {
        expect(bindingViewOf("x", { $ref: 3 }).kind).toBe("fixed")
        expect(bindingViewOf("x", { other: 1 })).toMatchObject({ kind: "fixed", text: '{"other":1}' })
    })

    it("lists every binding of a record in its order, and none for anything that is not a record", () => {
        expect(bindingViewsOf({ b: 1, a: { $ref: "out.a" } }).map((one) => [one.name, one.kind])).toEqual([
            ["b", "fixed"],
            ["a", "ref"],
        ])
        expect(bindingViewsOf(undefined)).toEqual([])
        expect(bindingViewsOf(null)).toEqual([])
        expect(bindingViewsOf([{ $ref: "out.a" }])).toEqual([])
        expect(bindingViewsOf("text")).toEqual([])
    })
})

describe("triggerViewsOf", () => {
    it("draws each trigger with its source in both languages and the chips of the params the contract takes from it", () => {
        const vi = triggerViewsOf(chatbotSpec, "vi")
        const en = triggerViewsOf(salesSpec, "en")

        expect(vi.map((one) => [one.key, one.sourceKind, one.sourceLabel, one.hasConnection, one.connectionId])).toEqual([
            ["zalo", "zalo", "Zalo", true, null],
            ["telegram", "telegram", "Telegram", true, null],
        ])
        // The channel supplies messageIds too, but the contract does not take it, so it is no chip.
        expect(vi[0]?.params.map((one) => one.name)).toEqual(["conversationId", "leadId", "channel", "text", "messages"])
        expect(vi[0]?.params[0]).toEqual({ name: "conversationId", label: "Cu\u1ed9c tr\u00f2 chuy\u1ec7n", type: "string", typeLabel: "ch\u1eef" })
        expect(vi[0]?.params[4]).toMatchObject({ type: "array", typeLabel: "danh s\u00e1ch" })
        expect(en[0]).toMatchObject({ key: "call", sourceKind: "workflow", sourceLabel: "Called by another workflow", hasConnection: false })
        expect(en[0]?.params.map((one) => one.name)).toEqual(["conversationId", "text", "channel", "leadId"])
        expect(en[0]?.params[3]).toMatchObject({ label: "Customer", type: "string" })
    })

    it("words every kind of condition in both languages", () => {
        const spec: GraphSpec = {
            ...salesSpec,
            contract: { inputs: [{ name: "careKind", type: "string", required: true }] },
            triggers: [
                {
                    key: "care",
                    source: { kind: "timer", connectionId: null },
                    conditions: [
                        { param: "careKind", op: "equals", value: "payment" },
                        { param: "careKind", op: "not-equals", value: "report" },
                        { param: "careKind", op: "contains", value: "pay" },
                        { param: "careKind", op: "present" },
                    ],
                },
            ],
        }

        expect(triggerViewsOf(spec, "vi")[0]?.conditions.map((one) => one.label)).toEqual([
            "Lo\u1ea1i ch\u0103m s\u00f3c l\u00e0 payment",
            "Lo\u1ea1i ch\u0103m s\u00f3c kh\u00e1c report",
            "Lo\u1ea1i ch\u0103m s\u00f3c c\u00f3 ch\u1ee9a pay",
            "Lo\u1ea1i ch\u0103m s\u00f3c c\u00f3 gi\u00e1 tr\u1ecb",
        ])
        expect(triggerViewsOf(spec, "en")[0]?.conditions.map((one) => one.label)).toEqual([
            "Care kind is payment",
            "Care kind is not report",
            "Care kind contains pay",
            "Care kind is set",
        ])
        expect(triggerViewsOf(spec, "en")[0]).toMatchObject({ sourceLabel: "Care timer", hasConnection: false })
    })

    it("keeps the connection a trigger names, and is empty for a graph without triggers", () => {
        const spec: GraphSpec = { ...accountingSpec, triggers: [{ key: "bank", source: { kind: "sepay", connectionId: "c9" } }] }
        const { triggers: _triggers, ...old } = accountingSpec

        expect(triggerViewsOf(spec, "vi")[0]).toMatchObject({ connectionId: "c9", sourceLabel: "SePay", conditions: [] })
        expect(triggerViewsOf(old, "vi")).toEqual([])
    })

    it("shows every param a source supplies when the graph has no contract", () => {
        const { contract: _contract, ...bare } = accountingSpec

        expect(triggerViewsOf(bare, "vi")[0]?.params.map((one) => one.name)).toEqual(["transactionId"])
    })
})

describe("outcomeViewsOf", () => {
    it("lists each outcome with its label and the typed chips of its outputs", () => {
        const views = outcomeViewsOf(chatbotSpec, "vi")

        expect(views.map((one) => one.key)).toEqual(["owner"])
        expect(views[0]?.label).toBe("Chuy\u1ec3n ch\u1ee7 ti\u1ec7m")
        expect(views[0]?.outputs.map((one) => [one.name, one.type])).toEqual([["summary", "string"]])
        expect(outcomeViewsOf(salesSpec, "en")[0]).toMatchObject({ key: "won" })
        expect(outcomeViewsOf(salesSpec, "en")[0]?.outputs.map((one) => one.name)).toEqual(["orderId"])
        expect(outcomeViewsOf(accountingSpec, "vi")).toEqual([])
    })

    it("is empty for a graph without outcomes", () => {
        const { outcomes: _outcomes, ...old } = chatbotSpec

        expect(outcomeViewsOf(old, "vi")).toEqual([])
    })
})

describe("entryViewOf", () => {
    it("words the entry rule of the graph in both languages", () => {
        expect(entryViewOf(chatbotSpec, "vi")).toEqual({ openTo: "any", holdsConversation: false, label: "M\u1ecdi quy tr\u00ecnh \u0111\u01b0\u1ee3c g\u1ecdi" })
        const closed: GraphSpec = { ...accountingSpec, entry: { openTo: "agent" } }
        expect(entryViewOf(accountingSpec, "en")).toEqual({ openTo: "any", holdsConversation: false, label: "Any workflow may call" })
        expect(entryViewOf(closed, "vi")).toEqual({ openTo: "agent", holdsConversation: false, label: "Ch\u1ec9 quy tr\u00ecnh c\u1ee7a agent n\u00e0y" })
        expect(entryViewOf(closed, "en")).toEqual({ openTo: "agent", holdsConversation: false, label: "Only this agent's workflows" })
    })

    it("tells whether the workflow holds the conversation of its customer", () => {
        const holding: GraphSpec = { ...salesSpec, entry: { openTo: "any", holdsConversation: true } }

        expect(entryViewOf(holding, "en")).toEqual({ openTo: "any", holdsConversation: true, label: "Any workflow may call" })
        expect(entryViewOf({ ...holding, entry: { openTo: "any", holdsConversation: false } }, "en").holdsConversation).toBe(false)
    })

    it("opens the workflow to any caller when the graph names no rule", () => {
        const { entry: _entry, ...none } = accountingSpec

        expect(entryViewOf(none, "en")).toEqual({ openTo: "any", holdsConversation: false, label: "Any workflow may call" })
    })
})

describe("callViewOf", () => {
    const toAfterSale = nodeOf(accountingSpec, "to-after-sale")

    it("draws the exact target of a hand-off with the words of its agent and a latest version", () => {
        expect(callViewOf(toAfterSale, "vi")).toEqual({
            agent: "sales",
            agentLabel: "B\u00e1n h\u00e0ng",
            workflow: "after-sale",
            workflowLabel: "after-sale",
            version: "latest",
            versionLabel: "B\u1ea3n m\u1edbi nh\u1ea5t",
            params: [
                bindingViewOf("orderId", { $ref: "steps.mark-paid.output.orderId" }, "vi"),
                bindingViewOf("leadId", { $ref: "steps.mark-paid.output.leadId" }, "vi"),
            ],
        })
        expect(callViewOf(toAfterSale, "en")).toMatchObject({ agentLabel: "Sales", versionLabel: "Latest version" })
    })

    it("names the target by the workspace's workflow names when given", () => {
        expect(callViewOf(toAfterSale, "vi", { "sales.after-sale": "Ch\u0103m s\u00f3c sau b\u00e1n" })?.workflowLabel).toBe("Ch\u0103m s\u00f3c sau b\u00e1n")
        expect(callViewOf(toAfterSale, "vi", { "sales.other": "Kh\u00e1c" })?.workflowLabel).toBe("after-sale")
    })

    it("words a pinned version, and shows the key of an agent it has no words for", () => {
        const pinned: GraphSpecNode = {
            ...toAfterSale,
            params: { agent: "inventory", workflow: "check", version: 3, inputs: {} },
        }

        expect(callViewOf(pinned, "vi")).toMatchObject({ agentLabel: "inventory", version: "3", versionLabel: "B\u1ea3n 3", params: [] })
        expect(callViewOf(pinned, "en")?.versionLabel).toBe("Version 3")
    })

    it("is null for any node that is not a hand-off, or whose params are not a record", () => {
        expect(callViewOf(nodeOf(accountingSpec, "match"), "vi")).toBeNull()
        expect(callViewOf({ ...toAfterSale, params: undefined }, "vi")).toBeNull()
    })
})

describe("outcomeEndViewOf", () => {
    it("draws the outcome an end reaches with the label the workflow declares and the outputs it fills", () => {
        const view = outcomeEndViewOf(nodeOf(chatbotSpec, "to-owner"), chatbotSpec, "vi")

        expect(view).toMatchObject({ key: "owner", label: "Chuy\u1ec3n ch\u1ee7 ti\u1ec7m" })
        expect(view?.bindings.map((one) => [one.name, one.ref])).toEqual([["summary", "steps.complaint.output.summary"]])
    })

    it("shows the key when the workflow does not declare the outcome", () => {
        const node: GraphSpecNode = { ...nodeOf(chatbotSpec, "to-owner"), params: { outcome: "ghost", outputs: {} } }

        expect(outcomeEndViewOf(node, chatbotSpec, "vi")).toEqual({ key: "ghost", label: "ghost", bindings: [] })
    })

    it("is null for any node that is not an outcome end", () => {
        expect(outcomeEndViewOf(nodeOf(chatbotSpec, "understand"), chatbotSpec, "vi")).toBeNull()
        expect(outcomeEndViewOf({ ...nodeOf(chatbotSpec, "to-owner"), params: undefined }, chatbotSpec, "vi")).toBeNull()
    })
})

describe("callEdgesOf", () => {
    it("pairs each hand-off with the outcome it follows, none when it follows a step", () => {
        expect(callEdgesOf(chatbotSpec)).toEqual(
            expect.arrayContaining([
                { nodeKey: "to-consult", outcome: null, agent: "sales", workflow: "consult", version: "latest" },
                { nodeKey: "to-reconcile", outcome: null, agent: "accounting", workflow: "reconcile", version: "latest" },
            ]),
        )
        expect(callEdgesOf(chatbotSpec)).toHaveLength(2)
        expect(callEdgesOf(accountingSpec)).toEqual([
            { nodeKey: "to-after-sale", outcome: null, agent: "sales", workflow: "after-sale", version: "latest" },
        ])
    })

    it("is empty for a graph with no hand-off", () => {
        expect(callEdgesOf(salesSpec)).toEqual([])
    })

    it("reaches the outcome through other hand-offs, and gives null to a hand-off after a plain step", () => {
        const call = (key: string, next?: string): GraphSpecNode => ({
            key,
            kind: "output",
            step: "core.call-workflow",
            params: { agent: "sales", workflow: key, version: 2, inputs: {} },
            ...(next === undefined ? {} : { next }),
        })
        const spec: GraphSpec = {
            ...salesSpec,
            nodes: [
                { key: "start", kind: "execute", step: "sales.consult-turn", next: "lone" },
                call("lone"),
                { key: "won", kind: "output", step: "core.outcome", params: { outcome: "won", outputs: {} }, next: "first" },
                call("first", "second"),
                call("second"),
            ],
        }

        expect(callEdgesOf(spec)).toEqual([
            { nodeKey: "lone", outcome: null, agent: "sales", workflow: "lone", version: "2" },
            { nodeKey: "first", outcome: "won", agent: "sales", workflow: "first", version: "2" },
            { nodeKey: "second", outcome: "won", agent: "sales", workflow: "second", version: "2" },
        ])
    })

    it("does not loop forever on a graph that returns onto itself", () => {
        const spec: GraphSpec = {
            ...salesSpec,
            nodes: [
                { key: "a", kind: "output", step: "core.call-workflow", params: { agent: "sales", workflow: "x", inputs: {} }, next: "b" },
                { key: "b", kind: "output", step: "core.call-workflow", params: { agent: "sales", workflow: "y", inputs: {} }, next: "a" },
            ],
        }

        expect(callEdgesOf(spec).map((one) => [one.nodeKey, one.outcome])).toEqual([
            ["a", null],
            ["b", null],
        ])
    })
})

describe("contractProblemText", () => {
    const CODES: ReadonlyArray<ContractProblem["code"]> = [
        "TRIGGER_INPUT_UNSUPPLIED",
        "TRIGGER_INPUT_TYPE",
        "TRIGGER_CONNECTION_INVALID",
        "TRIGGER_CONDITION_UNKNOWN",
        "TRIGGER_SOURCES_MISMATCH",
        "TRIGGER_KEY_DUPLICATE",
        "CONTRACT_INPUT_DUPLICATE",
        "CALL_TARGET_UNKNOWN",
        "CALL_VERSION_UNKNOWN",
        "CALL_INPUT_MISSING",
        "CALL_INPUT_UNKNOWN",
        "CALL_INPUT_TYPE",
        "CALL_ENTRY_CLOSED",
        "OUTCOME_DUPLICATE",
        "OUTCOME_UNKNOWN",
        "OUTCOME_OUTPUT_MISSING",
        "OUTCOME_OUTPUT_UNKNOWN",
        "OUTCOME_OUTPUT_TYPE",
        "ENTRY_HOLD_WITHOUT_CONVERSATION",
    ]

    it.each(CODES)("words %s in both languages and leaves no placeholder behind", (code) => {
        for (const locale of ["vi", "en"] as const) {
            const text = contractProblemText({ code, at: "to-sales.leadId" }, locale)
            expect(text).not.toBe("")
            expect(text).not.toMatch(/[{}]/)
        }
    })

    it("fills in the trigger and the param of a trigger problem, the param in the owner's words", () => {
        const problem: ContractProblem = { code: "TRIGGER_INPUT_UNSUPPLIED", at: "triggers.zalo.leadId" }

        expect(contractProblemText(problem, "vi")).toBe("Ngu\u1ed3n c\u1ee7a \u0111\u1ea7u v\u00e0o zalo kh\u00f4ng cung c\u1ea5p tham s\u1ed1 b\u1eaft bu\u1ed9c Kh\u00e1ch.")
        expect(contractProblemText(problem, "en")).toBe("The source of input zalo does not supply the required param Customer.")
    })

    it("fills in the step and the param of a hand-off problem, and the step's title when the reader gives one", () => {
        const problem: ContractProblem = { code: "CALL_INPUT_MISSING", at: "to-consult.orderId" }

        expect(contractProblemText(problem, "vi")).toBe("B\u01b0\u1edbc to-consult ch\u01b0a truy\u1ec1n tham s\u1ed1 b\u1eaft bu\u1ed9c \u0110\u01a1n h\u00e0ng c\u1ee7a quy tr\u00ecnh \u0111\u01b0\u1ee3c g\u1ecdi.")
        expect(contractProblemText(problem, "en", { "to-consult": "Call Sales" })).toBe(
            "Step Call Sales does not pass the required param Order of the called workflow.",
        )
    })

    it("reads the place of a contract or outcome problem as one name", () => {
        expect(contractProblemText({ code: "CONTRACT_INPUT_DUPLICATE", at: "contract.leadId" }, "vi")).toBe(
            "Hai tham s\u1ed1 \u0111\u1ea7u v\u00e0o c\u00f9ng t\u00ean Kh\u00e1ch.",
        )
        expect(contractProblemText({ code: "OUTCOME_DUPLICATE", at: "outcomes.won" }, "en")).toBe("Two outcomes or fields share won.")
    })

    it("words a hold without the conversation input, in both languages", () => {
        const problem: ContractProblem = { code: "ENTRY_HOLD_WITHOUT_CONVERSATION", at: "entry.holdsConversation" }

        expect(contractProblemText(problem, "en")).toBe("A workflow that holds the conversation must require the conversation as an input.")
        expect(contractProblemText(problem, "vi")).toMatch(/^Quy tr/)
    })

    it("leaves the param out when the problem names none", () => {
        expect(contractProblemText({ code: "TRIGGER_SOURCES_MISMATCH", at: "triggers" }, "en")).toBe(
            "The wake sources do not match the workflow's inputs.",
        )
        expect(contractProblemText({ code: "CALL_TARGET_UNKNOWN", at: "to-sales" }, "vi")).toBe(
            "B\u01b0\u1edbc to-sales g\u1ecdi m\u1ed9t quy tr\u00ecnh kh\u00f4ng c\u00f3 trong c\u1eeda h\u00e0ng.",
        )
    })
})
