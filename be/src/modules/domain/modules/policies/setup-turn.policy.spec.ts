import { Test } from "@nestjs/testing"
import type { DraftSnapshot, GateEvidence } from "@modules/domain/module-context-versions"
import { ACCOUNTING_MODULE } from "../accounting.contracts"
import type { ModuleDefinition } from "../modules.contracts"
import {
    mergeSetupTurn as realMergeSetupTurn,
    parseLoose as realParseLoose,
    readSetupTurn as realReadSetupTurn,
    setupPromptOf as realSetupPromptOf,
} from "./setup-turn.policy"
import type { SetupTurnInput } from "./setup-turn.policy"

const SUBJECT = Symbol("setup-turn.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    mergeSetupTurn: realMergeSetupTurn,
                    parseLoose: realParseLoose,
                    readSetupTurn: realReadSetupTurn,
                    setupPromptOf: realSetupPromptOf,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<{
        mergeSetupTurn: typeof realMergeSetupTurn
        parseLoose: typeof realParseLoose
        readSetupTurn: typeof realReadSetupTurn
        setupPromptOf: typeof realSetupPromptOf
    }>(SUBJECT)
    return { subject }
}

const MODULE: ModuleDefinition = {
    ...ACCOUNTING_MODULE,
    purpose: "answer questions about the shop",
    gates: [
        {
            key: "hours",
            label_vi: "Gi\u1edd",
            label_en: "Hours",
            hint_vi: "Khi n\u00e0o?",
            hint_en: "When do you open?",
            writes: [{ kind: "fact", subjectType: "business", attributeLabel: "Hours", scope: "public" }],
        },
        {
            key: "tone",
            label_vi: "Gi\u1ecdng",
            label_en: "Tone",
            hint_vi: "Th\u1ebf n\u00e0o?",
            hint_en: "How to speak?",
        },
    ],
    authorityActions: [],
}

const inputOf = (changes: Partial<SetupTurnInput> = {}): SetupTurnInput => ({
    module: MODULE,
    locale: "en",
    draft: { summary: "", facts: [] },
    gates: {},
    history: [],
    message: "We open at 8",
    gaps: [],
    words: {
        notApplicable: "Kh\u00f4ng \u00e1p d\u1ee5ng:",
        applyButton: "\u00c1p d\u1ee5ng",
        ownerAddress: "anh/ch\u1ecb",
    },
    ...changes,
})

describe("parseLoose", () => {
    it.each([
        ['{"answer":1}', { answer: 1 }],
        ['```JSON\n{"answer":2}\n```', { answer: 2 }],
        ['Here is the answer: {"answer":3}. Thanks.', { answer: 3 }],
        ["null", null],
        ["[1,2]", [1, 2]],
        ["plain text", null],
        ["prefix {broken} suffix", null],
        ["} before {", null],
        ["{", null],
    ])("reads the model response %s", async (raw, expected) => {
        const { subject } = await buildSubject()

        expect(subject.parseLoose(raw)).toEqual(expected)
    })
})

describe("setupPromptOf", () => {
    it("describes English setup, the missing checklist, declared writes and an empty draft", async () => {
        const { subject } = await buildSubject()

        const prompt = subject.setupPromptOf(inputOf())

        expect(prompt.split("\n").filter((line) => line.startsWith("- hours") || line.startsWith("- tone"))).toEqual([
            "- hours | Hours | When do you open? | state: missing",
            "- tone | Tone | How to speak? | state: missing",
        ])
        expect(prompt).toContain("Write the reply in English.")
        expect(prompt).toContain(
            "What each gate can write for real (Second Brain facts and the authority of the agent). The owner " +
                "confirms every write on a card before it happens:\n- gate hours: fact | subjectType business | " +
                'attribute "Hours" | audience public',
        )
        expect(prompt).toContain("Facts already noted:\n(none yet)\nSummary so far: (none)")
        expect(prompt).toContain('- "writes": for every concrete value the owner gave THIS turn')
        expect(prompt.split("\n").slice(-2)).toEqual([
            'Return ONLY a JSON object: {"reply": string, "summary": string, "facts": [{"key": string, ' +
                '"text": string}], "gates": {"<gateKey>": {"status": "proposed", "evidence": string}}, ' +
                '"writes": [ ... ]}',
            "Valid gate keys: hours, tone",
        ])
    })

    it("addresses the owner in Vietnamese and supplies known evidence, facts and gap guesses", async () => {
        const { subject } = await buildSubject()

        const evidence = "e".repeat(305)
        const question = "q".repeat(205)
        const prompt = subject.setupPromptOf(
            inputOf({
                locale: "vi",
                draft: { summary: "A tea shop", facts: [{ key: "city", text: "Hue" }] },
                gates: { hours: { status: "proposed", evidence } },
                gaps: [
                    { id: "g1", question, count: 4, topic: "Tea", attributeGuess: "Price" },
                    { id: "g2", question: "Delivery?", count: 2, topic: null, attributeGuess: null },
                ],
            }),
        )

        expect(prompt).toContain(
            "Write the reply in Vietnamese (natural, warm business Vietnamese; address the owner as 'anh/ch\u1ecb').",
        )
        expect(prompt.split("\n").filter((line) => line.startsWith("- hours") || line.startsWith("- ["))).toEqual([
            `- hours | Hours | When do you open? | state: proposed | evidence: ${"e".repeat(300)}`,
            `- [g1] asked 4x: "${"q".repeat(200)}" | likely subject: Tea | likely attribute: Price`,
            '- [g2] asked 2x: "Delivery?"',
        ])
        expect(prompt).toContain("Facts already noted:\n- city: Hue\nSummary so far: A tea shop")
        expect(prompt).toContain(
            'When the owner answers one, add a write {"gate": "gap", "kind": "fact", "gap": <id in ' +
                'brackets>, "subject": ..., "attribute": ..., "value": <the answer>}.',
        )
    })
})

describe("setupPromptOf", () => {
    it("omits write instructions and the writes field when the checklist declares none and there are no gaps", async () => {
        const { subject } = await buildSubject()

        const prompt = subject.setupPromptOf(inputOf({ module: { ...MODULE, gates: [] } }))

        expect(prompt.split("\n").slice(-2)).toEqual([
            'Return ONLY a JSON object: {"reply": string, "summary": string, "facts": [{"key": string, ' +
                '"text": string}], "gates": {"<gateKey>": {"status": "proposed", "evidence": string}}}',
            "Valid gate keys: ",
        ])
        expect(prompt).not.toContain("What each gate can write for real")
        expect(prompt).not.toContain('- "writes":')
        expect(prompt).not.toContain("Open customer questions:")
    })

    it("asks for writes when only an open question can be answered", async () => {
        const { subject } = await buildSubject()

        const prompt = subject.setupPromptOf(
            inputOf({
                module: { ...MODULE, gates: [] },
                gaps: [{ id: "g1", question: "Hours?", topic: null, attributeGuess: null, count: 1 }],
            }),
        )

        expect(prompt.split("\n").slice(-2)).toEqual([
            'Return ONLY a JSON object: {"reply": string, "summary": string, "facts": [{"key": string, ' +
                '"text": string}], "gates": {"<gateKey>": {"status": "proposed", "evidence": string}}, ' +
                '"writes": [ ... ]}',
            "Valid gate keys: ",
        ])
        expect(prompt).not.toContain('- "writes":')
    })
})

describe("readSetupTurn", () => {
    it.each(["A plain answer", "", "null", "[]", "1"])("uses raw non-object response %s", async (raw) => {
        const { subject } = await buildSubject()

        expect(subject.readSetupTurn(inputOf(), raw, "Try again", "Shop")).toEqual({
            reply: raw === "" ? "Try again" : raw,
            facts: [],
            gates: {},
            writes: [],
        })
    })

    it("trims the response, sanitizes remembered facts and gate evidence, and retains declared writes", async () => {
        const { subject } = await buildSubject()

        const raw = JSON.stringify({
            reply: ` ${"r".repeat(1505)} `,
            summary: ` ${"s".repeat(605)} `,
            facts: [
                null,
                ["bad"],
                { key: " __SHOP City!!__ ", text: " Hue " },
                { key: "", text: "missing key" },
                { key: "empty", text: " " },
                { key: 1, text: "bad key" },
                { key: "number", text: 2 },
                { key: "K".repeat(65), text: "t".repeat(305) },
            ],
            gates: {
                hours: { status: "confirmed", evidence: ` ${"e".repeat(505)} ` },
                tone: "not an entry",
                unknown: { evidence: "drop" },
            },
            writes: [{ gate: "hours", kind: "fact", value: "8 to 5" }],
        })

        expect(subject.readSetupTurn(inputOf(), raw, "Fallback", "Shop")).toEqual({
            reply: "r".repeat(1500),
            summary: "s".repeat(600),
            facts: [
                { key: "shop_city", text: "Hue" },
                { key: "k".repeat(60), text: "t".repeat(300) },
            ],
            gates: { hours: "e".repeat(500) },
            writes: [
                {
                    gateKey: "hours",
                    kind: "fact",
                    payload: {
                        subjectType: "business",
                        subjectLabel: "Shop",
                        attributeLabel: "Hours",
                        value: "8 to 5",
                        scope: "public",
                    },
                },
            ],
        })
    })

    it.each([
        { reply: " ", summary: " ", facts: {}, gates: [] },
        { reply: 3, summary: null, facts: null, gates: null },
        { gates: { hours: { evidence: " " }, tone: { evidence: 1 } } },
    ])("supplies fallback text and omits empty information", async (parsed) => {
        const { subject } = await buildSubject()

        expect(subject.readSetupTurn(inputOf(), JSON.stringify(parsed), "Fallback", "Shop")).toEqual({
            reply: "Fallback",
            facts: [],
            gates: {},
            writes: [],
        })
    })
})

describe("mergeSetupTurn", () => {
    it("updates existing facts, adds new facts, retains confirmed gates and proposes other gates", async () => {
        const { subject } = await buildSubject()

        const draft: DraftSnapshot = { summary: "Old", facts: [{ key: "city", text: "Hue" }] }
        const gates: GateEvidence = {
            hours: { status: "confirmed", evidence: "8 to 5", confirmed_by: "Lan" },
            tone: { status: "missing", evidence: "" },
        }

        expect(
            subject.mergeSetupTurn(draft, gates, {
                reply: "Thanks",
                summary: "New",
                facts: [
                    { key: "city", text: "Da Nang" },
                    { key: "name", text: "Shop" },
                ],
                gates: { hours: "9 to 6", tone: "Warm", delivery: "Free" },
                writes: [],
            }),
        ).toEqual({
            draft: {
                summary: "New",
                facts: [
                    { key: "city", text: "Da Nang" },
                    { key: "name", text: "Shop" },
                ],
            },
            gates: {
                hours: { status: "confirmed", evidence: "8 to 5", confirmed_by: "Lan" },
                tone: { status: "proposed", evidence: "Warm" },
                delivery: { status: "proposed", evidence: "Free" },
            },
        })
        expect(draft).toEqual({ summary: "Old", facts: [{ key: "city", text: "Hue" }] })
        expect(gates.tone).toEqual({ status: "missing", evidence: "" })
    })

    it("keeps the prior summary when omitted and retains only the most recent sixty facts", async () => {
        const { subject } = await buildSubject()

        const facts = Array.from({ length: 61 }, (_, at) => ({ key: `fact_${at}`, text: `${at}` }))

        expect(
            subject.mergeSetupTurn({ summary: "Prior", facts }, {}, { reply: "", facts: [], gates: {}, writes: [] }),
        ).toEqual({
            draft: { summary: "Prior", facts: facts.slice(1) },
            gates: {},
        })
    })
})
