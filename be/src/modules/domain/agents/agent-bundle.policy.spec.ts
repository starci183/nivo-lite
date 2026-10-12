import { builder } from "@starci/jest-preset"
import type { AgentPersona, AgentsMdInput, TextOf } from "./agents.contracts"
import type { ContextVersion, KnowledgeDocument } from "./agents.port"
import {
    INLINE_KNOWLEDGE_MAX,
    RULES_BUDGET,
    agentsMdOf,
    appliedContextOf,
    budgetRules,
    contextTextOf,
    knowledgeFileOf,
    personaTextOf,
    slugOf,
    soulMdOf,
    stripMarkdown,
    toolsSectionOf,
    trimTo,
    withoutSetupBlock,
} from "./agent-bundle.policy"

/** Echoes the key and its params so a spec reads the structure of the output. */
const t: TextOf = (key, params = {}) => {
    const entries = Object.entries(params).map(([name, value]) => `${name}=${String(value)}`)
    return entries.length === 0 ? key : `${key}(${entries.join("; ")})`
}

const personaOf = builder<AgentPersona>({
    name: "Bot",
    handle: "bot",
    role: "Front desk",
    instructions: "Be kind",
    knowledge: "Open 9-5",
    approvalRule: "Ask first",
})

const versionOf = builder<ContextVersion>({
    version: 3,
    summary: "  A spa in Hanoi ",
    gates: [{ label: "Tone", evidence: "polite" }],
    facts: ["Closed Monday"],
    toneEvidence: "call the customer chi",
})

const documentOf = builder<KnowledgeDocument>({
    title: "Service price",
    topic: "Price",
    kind: "document",
    visibility: "public",
    updatedAt: "2026-10-11T08:00:00.000Z",
    content: "  Massage 300k\n",
})

const inputOf = builder<AgentsMdInput>({
    name: "Bot",
    module: "chatbot",
    audience: "customer",
    persona: null,
    rules: [],
    version: null,
    memory: "",
    sources: [],
    contract: null,
    tools: "",
})

describe("agent bundle policy", () => {
    describe("text helpers", () => {
        it("makes an ASCII slug of a Vietnamese title and falls back to source", () => {
            expect(slugOf(`Cafe${String.fromCodePoint(0xe9)} ${String.fromCodePoint(0x110, 0x111)}!`)).toBe("cafee-dd")
            expect(slugOf("***")).toBe("source")
            expect(slugOf("a".repeat(80))).toHaveLength(48)
        })

        it("strips markdown headings and bold marks", () => {
            expect(stripMarkdown("## Title\n**bold** text")).toBe("Title\nbold text")
        })

        it("cuts at a word boundary and marks the cut", () => {
            expect(trimTo("short", 10)).toBe("short")
            expect(trimTo("one two three", 8)).toBe("one two ...")
            expect(trimTo("one two three", 10)).toBe("one two ...")
        })

        it("removes the block the setup chat appended", () => {
            expect(withoutSetupBlock("Keep\n\n### NIVO setup\nold\n### end NIVO setup\n")).toBe("Keep")
        })
    })

    describe("budgetRules", () => {
        it("trims each rule and stops when the budget is spent", () => {
            const long = "word ".repeat(400)
            const rules = Array.from({ length: 10 }, (_, index) => ({
                title: `R${index}`,
                body: long,
                kind: "authority",
            }))

            const budgeted = budgetRules(rules)

            expect(budgeted.length).toBeLessThan(10)
            expect(budgeted.reduce((sum, rule) => sum + rule.text.length, 0)).toBeLessThanOrEqual(RULES_BUDGET + 10)
            expect(budgeted[0]?.title).toBe("R0")
        })

        it("keeps a short rule whole", () => {
            expect(budgetRules([{ title: "A", body: "## Do **this**", kind: "authority" }])).toEqual([
                { title: "A", text: "Do this" },
            ])
        })
    })

    describe("persona and context", () => {
        it("writes the persona with the owner's texts and rule", () => {
            expect(personaTextOf(personaOf(), t)).toBe(
                [
                    "bundle.personaName(name=Bot; handle=bot)",
                    "bundle.personaRole(role=Front desk)",
                    "bundle.personaInstructions(text=Be kind)",
                    "bundle.personaNotes(text=Open 9-5)",
                    "bundle.personaApproval(rule=Ask first)",
                ].join("\n"),
            )
        })

        it("leaves out empty texts and defaults the approval rule", () => {
            expect(personaTextOf(personaOf({ instructions: "", knowledge: null, approvalRule: null }), t)).toBe(
                [
                    "bundle.personaName(name=Bot; handle=bot)",
                    "bundle.personaRole(role=Front desk)",
                    "bundle.personaApproval(rule=bundle.approvalDefault)",
                ].join("\n"),
            )
        })

        it("writes the context version with its gates and facts", () => {
            expect(contextTextOf(versionOf(), t)).toBe(
                "A spa in Hanoi\n\n- Tone: polite\n\nbundle.contextFacts(facts=- Closed Monday)",
            )
            expect(contextTextOf(versionOf({ gates: [], facts: [] }), t)).toBe("A spa in Hanoi")
        })

        it("applies no context for no version", () => {
            expect(appliedContextOf(null, t)).toBeNull()
            expect(appliedContextOf(versionOf({ gates: [], facts: [] }), t)).toEqual({
                version: 3,
                text: "A spa in Hanoi",
            })
        })
    })

    describe("knowledgeFileOf", () => {
        it("writes a numbered file with the topic, the meta line and the text", () => {
            const file = knowledgeFileOf(0, documentOf(), t)

            expect(file.path).toBe("knowledge/01-service-price.md")
            expect(file.content).toBe(
                "# Service price\n\nbundle.fileTopic(topic=Price)bundle.fileMeta(kind=document; visibility=bundle.visibilityPublic; date=2026-10-11)\n\nMassage 300k\n",
            )
        })

        it("leaves out a missing topic and marks internal documents", () => {
            const file = knowledgeFileOf(11, documentOf({ topic: null, visibility: "internal" }), t)

            expect(file.path).toBe("knowledge/12-service-price.md")
            expect(file.content).toContain("bundle.fileMeta(kind=document; visibility=bundle.visibilityInternal")
            expect(file.content).not.toContain("fileTopic")
        })
    })

    describe("agentsMdOf", () => {
        it("joins the sections in the order the model must weigh them", () => {
            const md = agentsMdOf(
                inputOf({
                    persona: personaOf(),
                    rules: [{ title: "Limit", text: "No discounts" }],
                    version: { version: 2, text: "ctx" },
                    memory: "## Memory",
                    sources: [{ title: "Price", content: "Massage 300k" }],
                    contract: "CONTRACT",
                    tools: "TOOLS",
                }),
                t,
            )

            expect(md.split("\n\n")).toEqual([
                "bundle.title(name=Bot; module=chatbot)",
                "bundle.syncNote",
                expect.stringContaining("bundle.roleSection"),
                "bundle.rulesSection(rules=### Limit\nNo discounts)",
                "bundle.contextSection(version=2; text=ctx)",
                "## Memory",
                "bundle.knowledgeSection(audience=bundle.audienceCustomer; body=### Price\nMassage 300k)",
                "bundle.contractSection(contract=CONTRACT)",
                "TOOLS\n",
            ])
        })

        it("states what is missing instead of leaving a gap", () => {
            const md = agentsMdOf(inputOf(), t)

            expect(md).toBe(
                "bundle.title(name=Bot; module=chatbot)\n\nbundle.syncNote\n\nbundle.contextNone\n\nbundle.knowledgeNone\n",
            )
        })

        it("lists only the titles once the knowledge is too big to inline", () => {
            const md = agentsMdOf(
                inputOf({
                    audience: "internal",
                    sources: [
                        { title: "A", content: "x".repeat(INLINE_KNOWLEDGE_MAX) },
                        { title: "B", content: "y" },
                    ],
                }),
                t,
            )

            expect(md).toContain(
                "bundle.knowledgeSection(audience=bundle.audienceInternal; body=bundle.knowledgeIndex(titles=A; B))",
            )
        })
    })

    describe("soulMdOf", () => {
        it("writes the confirmed tone and the NIVO guidance", () => {
            expect(soulMdOf("Bot", "chi", [{ title: "Tone", body: "## Warm", kind: "tone" }], t)).toBe(
                "bundle.soulTitle(name=Bot)\n\nbundle.soulConfirmed(text=chi)\n\nbundle.soulGuidance(text=### Tone\nWarm)\n",
            )
        })

        it("defaults an unconfirmed tone and skips an empty guidance", () => {
            expect(soulMdOf("Bot", "", [], t)).toBe("bundle.soulTitle(name=Bot)\n\nbundle.soulDefault\n")
        })
    })

    describe("toolsSectionOf", () => {
        it("lists each tool with its arguments", () => {
            const text = toolsSectionOf(
                [{ name: "knowledge.search", description: "Search.", args: { query: "string" } }],
                t,
            )

            expect(text).toBe(
                'bundle.toolsTitle\nbundle.toolsIntro\nbundle.toolLine(name=knowledge.search; description=Search.; args={"query":"string"})',
            )
        })
    })
})
