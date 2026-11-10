import { graphRefProblems, graphSpecProblems, specRefContextOf } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "../index"
import { TOOL } from "../vocabulary/tool-ids"
import { accountingModule } from "./accounting/declaration"
import { chatbotModule } from "./chatbot/declaration"
import { salesModule } from "./sales/declaration"
import {
    WORKFLOW_TEMPLATES,
    latestTemplateVersion,
    templateVersionOf,
    templateVersionsAfter,
    workflowTemplateOf,
    workflowTemplatesOf,
} from "./workflow-templates"

const index = nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })

describe("WORKFLOW_TEMPLATES", () => {
    it("names each template once", () => {
        const ids = WORKFLOW_TEMPLATES.map((template) => template.id)

        expect(new Set(ids).size).toBe(ids.length)
    })

    it.each(WORKFLOW_TEMPLATES.map((template) => [template.id, template] as const))(
        "%s: numbers its versions ascending and once each, each graph of its own module",
        (_id, template) => {
            const numbers = template.versions.map((version) => version.version)
            expect(numbers).toEqual([...new Set(numbers)].toSorted((left, right) => left - right))
            expect(template.versions.every((version) => version.graph.moduleKey === template.moduleKey)).toBe(true)
            expect(template.id.startsWith(`${template.moduleKey}.`)).toBe(true)
        },
    )

    it.each(
        WORKFLOW_TEMPLATES.flatMap((template) =>
            template.versions.map((version) => [`${template.id}@${version.version}`, version.graph] as const),
        ),
    )("%s: is a sound graph whose grant is the minimum its nodes need", (_at, graph) => {
        expect(graphSpecProblems(graph, index)).toEqual([])
        expect(graphRefProblems(graph, specRefContextOf(graph, index)).map((problem) => problem.messageKey)).toEqual([])
    })

    it("gives every module that has templates exactly one primary template", () => {
        const modules = [...new Set(WORKFLOW_TEMPLATES.map((template) => template.moduleKey))]

        expect(
            modules.map((module) => workflowTemplatesOf(module).filter((template) => template.primary).length),
        ).toEqual(modules.map(() => 1))
    })
})

describe("the agent of each module", () => {
    const AGENTS = new Map([accountingModule, chatbotModule, salesModule].map((module) => [module.key, module.agent]))

    it.each(WORKFLOW_TEMPLATES.map((template) => [template.id, template] as const))(
        "%s: every step uses only tools its module's agent holds",
        (_id, template) => {
            const held = new Set(AGENTS.get(template.moduleKey)?.tools ?? [])
            const used = latestTemplateVersion(template).graph.nodes.flatMap((step) => {
                const node = coreNodes.find((one) => one.id === step.step)
                return [...(node?.effects ?? []), ...(node?.tools ?? [])]
            })
            expect(used.filter((tool) => !held.has(tool))).toEqual([])
        },
    )

    it("holds no tool a step of its module does not use, and says its policy in both languages", () => {
        for (const module of [accountingModule, chatbotModule, salesModule]) {
            const used = new Set<string>(
                WORKFLOW_TEMPLATES.filter((template) => template.moduleKey === module.key).flatMap((template) =>
                    latestTemplateVersion(template).graph.nodes.flatMap((step) => {
                        const node = coreNodes.find((one) => one.id === step.step)
                        return [...(node?.effects ?? []), ...(node?.tools ?? [])]
                    }),
                ),
            )
            expect([module.key, (module.agent?.tools ?? []).filter((tool) => !used.has(tool))]).toEqual([module.key, []])
            expect(module.agent?.policy.guidance.vi).toBeTruthy()
            expect(module.agent?.policy.guidance.en).toBeTruthy()
        }
        expect(salesModule.agent?.policy.limits).toEqual({
            approvalThresholdVnd: 5_000_000,
            paymentReminderHours: 2,
            paymentStaleHours: 24,
            autoWon: true,
        })
        expect(salesModule.agent?.policy.guidance.vi).toContain("5.000.000đ")
        expect(salesModule.agent?.policy.guidance.en).toContain("5,000,000 VND")
        for (const module of [accountingModule, chatbotModule, salesModule]) {
            expect(module.agent?.policy.guidance.vi).toContain("/chat")
        }
        expect(accountingModule.agent?.policy.limits).toEqual({ overpayment: "settle", underpayment: "ask", refund: "never" })
    })
})

describe("the bridge rule: a tool from another group takes ids and words, never free provider arguments", () => {
    /** The members a bridge tool may take besides record ids: the words of a message and how it is filed. */
    const WORDS = new Set(["text", "title", "summary", "intent", "kind", "audience", "channel"])
    const BRIDGES: ReadonlyArray<readonly [string, string]> = [
        ["sales", TOOL.paymentQrCreate],
        ["accounting", TOOL.customerMessageSend],
        ["chatbot", TOOL.teamMessagePost],
        ["sales", TOOL.teamMessagePost],
        ["accounting", TOOL.teamMessagePost],
    ]

    /** Every member of a payload's JSON Schema with its schema, across the variants of a union. */
    const membersOf = (schema: Readonly<Record<string, unknown>>): ReadonlyArray<readonly [string, Readonly<Record<string, unknown>>]> => {
        const variants = [schema, ...((schema["oneOf"] ?? schema["anyOf"] ?? []) as ReadonlyArray<Readonly<Record<string, unknown>>>)]
        return variants.flatMap((variant) =>
            Object.entries((variant["properties"] ?? {}) as Readonly<Record<string, Readonly<Record<string, unknown>>>>),
        )
    }
    const isIds = (name: string, member: Readonly<Record<string, unknown>>): boolean =>
        (/Id$/u.test(name) && member["type"] === "string") ||
        (/Ids$/u.test(name) && member["type"] === "array" && (member["items"] as Readonly<Record<string, unknown>> | undefined)?.["type"] === "string")

    it.each(BRIDGES)("%s holds %s, whose payload is ids and words only", (moduleKey, id) => {
        const held = [accountingModule, chatbotModule, salesModule].find((module) => module.key === moduleKey)?.agent?.tools ?? []
        const effect = coreEffects.find((one) => one.id === id)
        expect([moduleKey, id, held.includes(id), effect !== undefined]).toEqual([moduleKey, id, true, true])
        const schema = z.toJSONSchema(effect?.payload ?? z.object({}), { io: "input", unrepresentable: "any" })
        const free = membersOf(schema).filter(([name, member]) => !isIds(name, member) && !(WORDS.has(name) && member["type"] === "string"))
        expect(free.map(([name]) => name)).toEqual([])
    })
})

describe("policy is soft: no tool an agent calls takes a policy number", () => {
    /** Every member name of a JSON Schema, at any depth. */
    const namesOf = (schema: unknown): ReadonlyArray<string> => {
        if (typeof schema !== "object" || schema === null) return []
        const own = Object.entries(schema).flatMap(([key, value]) =>
            key === "properties" && typeof value === "object" && value !== null
                ? [...Object.keys(value), ...Object.values(value).flatMap(namesOf)]
                : namesOf(value),
        )
        return own
    }
    const POLICY = /threshold|tolerance|limitvnd|approval|overpay|underpay|refund/iu

    it.each([...coreEffects.map((effect) => [effect.id, effect.payload] as const), ...coreTools.map((tool) => [tool.id, tool.args] as const)])(
        "%s takes no policy threshold",
        (_id, schema) => {
            const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" })
            expect(namesOf(json).filter((name) => POLICY.test(name))).toEqual([])
        },
    )
})

describe("the three main workflows are pure business steps (owner, 2026-11-10)", () => {
    const stepsOf = (id: string): ReadonlyArray<string> => {
        const template = workflowTemplateOf(id)
        if (template === null) throw new Error(`no template ${id}`)
        return latestTemplateVersion(template).graph.nodes.map((node) => `${node.key}:${node.step}`)
    }

    it("front desk: understand the customer, then buy, paid, complaint (then to the owner) or question", () => {
        expect(stepsOf("chatbot.front-desk")).toEqual([
            "understand:chatbot.understand",
            "to-consult:core.call-workflow",
            "to-reconcile:core.call-workflow",
            "complaint:chatbot.complaint",
            "to-owner:core.outcome",
            "answer:chatbot.answer",
        ])
    })

    it("consult: consult, create the order, send the QR, tell the team, won", () => {
        expect(stepsOf("sales.consult")).toEqual([
            "consult:sales.consult-turn",
            "create-order:sales.create-order",
            "send-qr:payment.request",
            "notify-order:sales.order-notice",
            "won:core.outcome",
        ])
    })

    it("reconcile: one workflow for money that arrives and a customer's word, no payment-claim template", () => {
        expect(stepsOf("accounting.reconcile")).toEqual([
            "match:accounting.match-payment",
            "mark-paid:payment.settle",
            "ledger:accounting.post-payment",
            "notify-paid:payment.received-notice",
            "to-after-sale:core.call-workflow",
        ])
        expect(workflowTemplateOf("accounting.payment-claim")).toBeNull()
    })
})

describe("template lookups", () => {
    const reconcile = workflowTemplateOf("accounting.reconcile")

    it("finds a template by id and answers null for an unknown one", () => {
        expect(reconcile?.moduleKey).toBe("accounting")
        expect(workflowTemplateOf("accounting.unknown")).toBeNull()
    })

    it("reads the newest version, one version and the versions after one", () => {
        if (reconcile === null) throw new Error("the reconcile template is missing")

        expect(latestTemplateVersion(reconcile).version).toBe(5)
        expect(templateVersionOf(reconcile, 5)?.version).toBe(5)
        expect(templateVersionOf(reconcile, 4)).toBeNull()
        expect(templateVersionsAfter(reconcile, 1).map((version) => version.version)).toEqual([5])
        expect(templateVersionsAfter(reconcile, 5)).toEqual([])
    })
})
