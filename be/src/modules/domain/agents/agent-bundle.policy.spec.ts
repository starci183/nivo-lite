import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { AgentPersona, AgentsMdInput, TextOf } from "./agents.contracts"
import type { ContextVersion } from "./agents.port"
import {
    INLINE_KNOWLEDGE_MAX,
    RULES_BUDGET,
    agentsMdOf,
    appliedContextOf,
    budgetRules,
    contextTextOf,
    personaTextOf,
    soulMdOf,
    stripMarkdown,
    toolsSectionOf,
    trimTo,
    withoutSetupBlock,
} from "./agent-bundle.policy"

type Subject = {
    stripMarkdown: typeof stripMarkdown
    trimTo: typeof trimTo
    withoutSetupBlock: typeof withoutSetupBlock
    budgetRules: typeof budgetRules
    personaTextOf: typeof personaTextOf
    contextTextOf: typeof contextTextOf
    appliedContextOf: typeof appliedContextOf
    agentsMdOf: typeof agentsMdOf
    soulMdOf: typeof soulMdOf
    toolsSectionOf: typeof toolsSectionOf
}

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

const SUBJECT = Symbol("agent-bundle.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    stripMarkdown,
                    trimTo,
                    withoutSetupBlock,
                    budgetRules,
                    personaTextOf,
                    contextTextOf,
                    appliedContextOf,
                    agentsMdOf,
                    soulMdOf,
                    toolsSectionOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("agent bundle policy", () => {
    describe("text helpers", () => {
        it("strips markdown headings and bold marks", async () => {
            const subject = await buildSubject()

            expect(subject.stripMarkdown("## Title\n**bold** text")).toBe("Title\nbold text")
        })

        it("cuts at a word boundary and marks the cut", async () => {
            const subject = await buildSubject()

            expect(subject.trimTo("short", 10)).toBe("short")
            expect(subject.trimTo("one two three", 8)).toBe("one two ...")
            expect(subject.trimTo("one two three", 10)).toBe("one two ...")
        })

        it("removes the block the setup chat appended", async () => {
            const subject = await buildSubject()

            expect(subject.withoutSetupBlock("Keep\n\n### NIVO setup\nold\n### end NIVO setup\n")).toBe("Keep")
        })

        it("keeps word-boundary cuts for Unicode whitespace, whole words and unbroken text", async () => {
            const subject = await buildSubject()

            expect(subject.trimTo("one\u00a0two three", 8)).toBe("one\u00a0two ...")
            expect(subject.trimTo("one   two three", 7)).toBe("one ...")
            expect(subject.trimTo("one\n\tthree", 6)).toBe("one ...")
            expect(subject.trimTo("abcdefgh", 4)).toBe("abcd ...")
            expect(subject.trimTo("   text", 3)).toBe(" ...")
        })

        it("removes complete setup blocks while preserving unmatched markers and surrounding content", async () => {
            const subject = await buildSubject()

            expect(
                subject.withoutSetupBlock(
                    "Before\n\n### NIVO setup\nold\n### end NIVO setup \t\nBetween\n### NIVO setup\nnew\n### end NIVO setup\nAfter",
                ),
            ).toBe("BeforeBetweenAfter")
            expect(
                subject.withoutSetupBlock(
                    "Keep\n### NIVO setup\nouter\n### NIVO setup\ninner\n### end NIVO setup\nTail",
                ),
            ).toBe("KeepTail")
            expect(subject.withoutSetupBlock("Keep\n### NIVO setup\nunfinished")).toBe(
                "Keep\n### NIVO setup\nunfinished",
            )
            const unfinished = `Keep${"\n".repeat(2000)}### NIVO setup${"pending".repeat(2000)}`
            expect(subject.withoutSetupBlock(unfinished)).toBe(unfinished)
        })
    })
})

describe("agent bundle rule budgets", () => {
    describe("budgetRules", () => {
        it("trims each rule and stops when the budget is spent", async () => {
            const subject = await buildSubject()

            const long = "word ".repeat(400)
            const rules = Array.from({ length: 10 }, (_, index) => ({
                title: `R${index}`,
                body: long,
                kind: "authority",
            }))

            const budgeted = subject.budgetRules(rules)

            expect(budgeted.length).toBeLessThan(10)
            expect(budgeted.reduce((sum, rule) => sum + rule.text.length, 0)).toBeLessThanOrEqual(RULES_BUDGET + 10)
            expect(budgeted[0]?.title).toBe("R0")
        })

        it("keeps a short rule whole", async () => {
            const subject = await buildSubject()

            expect(subject.budgetRules([{ title: "A", body: "## Do **this**", kind: "authority" }])).toEqual([
                { title: "A", text: "Do this" },
            ])
        })
    })
})

describe("agent bundle policy", () => {
    describe("persona and context", () => {
        it("writes the persona with the owner's texts and rule", async () => {
            const subject = await buildSubject()

            expect(subject.personaTextOf(personaOf(), t)).toBe(
                [
                    "bundle.personaName(name=Bot; handle=bot)",
                    "bundle.personaRole(role=Front desk)",
                    "bundle.personaInstructions(text=Be kind)",
                    "bundle.personaNotes(text=Open 9-5)",
                    "bundle.personaApproval(rule=Ask first)",
                ].join("\n"),
            )
        })

        it("leaves out empty texts and defaults the approval rule", async () => {
            const subject = await buildSubject()

            expect(subject.personaTextOf(personaOf({ instructions: "", knowledge: null, approvalRule: null }), t)).toBe(
                [
                    "bundle.personaName(name=Bot; handle=bot)",
                    "bundle.personaRole(role=Front desk)",
                    "bundle.personaApproval(rule=bundle.approvalDefault)",
                ].join("\n"),
            )
        })

        it("writes the context version with its gates and facts", async () => {
            const subject = await buildSubject()

            expect(subject.contextTextOf(versionOf(), t)).toBe(
                "A spa in Hanoi\n\n- Tone: polite\n\nbundle.contextFacts(facts=- Closed Monday)",
            )
            expect(subject.contextTextOf(versionOf({ gates: [], facts: [] }), t)).toBe("A spa in Hanoi")
        })

        it("applies no context for no version", async () => {
            const subject = await buildSubject()

            expect(subject.appliedContextOf(null, t)).toBeNull()
            expect(subject.appliedContextOf(versionOf({ gates: [], facts: [] }), t)).toEqual({
                version: 3,
                text: "A spa in Hanoi",
            })
        })
    })
})

describe("agent bundle policy", () => {
    describe("agentsMdOf", () => {
        it("joins the sections in the order the model must weigh them", async () => {
            const subject = await buildSubject()

            const md = subject.agentsMdOf(
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

        it("states what is missing instead of leaving a gap", async () => {
            const subject = await buildSubject()

            const md = subject.agentsMdOf(inputOf(), t)

            expect(md).toBe(
                "bundle.title(name=Bot; module=chatbot)\n\nbundle.syncNote\n\nbundle." +
                    "contextNone\n\nbundle.knowledgeNone\n",
            )
        })

        it("lists only the titles once the knowledge is too big to inline", async () => {
            const subject = await buildSubject()

            const md = subject.agentsMdOf(
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
})

describe("agent bundle policy", () => {
    describe("soulMdOf", () => {
        it("writes the confirmed tone and the NIVO guidance", async () => {
            const subject = await buildSubject()

            expect(subject.soulMdOf("Bot", "chi", [{ title: "Tone", body: "## Warm", kind: "tone" }], t)).toBe(
                "bundle.soulTitle(name=Bot)\n\nbundle.soulConfirmed(text=chi)\n\nbund" +
                    "le.soulGuidance(text=### Tone\nWarm)\n",
            )
        })

        it("defaults an unconfirmed tone and skips an empty guidance", async () => {
            const subject = await buildSubject()

            expect(subject.soulMdOf("Bot", "", [], t)).toBe("bundle.soulTitle(name=Bot)\n\nbundle.soulDefault\n")
        })
    })
})

describe("agent bundle policy", () => {
    describe("toolsSectionOf", () => {
        it("lists each tool with its arguments", async () => {
            const subject = await buildSubject()

            const text = subject.toolsSectionOf(
                [{ name: "knowledge.search", description: "Search.", args: { query: "string" } }],
                t,
            )

            expect(text).toBe(
                "bundle.toolsTitle\nbundle.toolsIntro\nbundle.toolLine(name=knowled" +
                    'ge.search; description=Search.; args={"query":"string"})',
            )
        })
    })
})
