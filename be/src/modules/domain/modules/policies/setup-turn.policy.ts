import { branchWritesOf, graphGapLine } from "./setup-branch.policy"
import type { DraftSnapshot, GateEvidence, SetupFact } from "@modules/domain/module-context-versions"
import type { Locale } from "@modules/platform/i18n"
import type { ModuleDefinition } from "../modules.contracts"
import { gateEntry } from "./setup-gates.policy"
import { GAP_GATE, sanitizeWrites, writeSpecLines } from "./setup-writes.policy"
import type { OpenGap, ProposedWrite } from "./setup-writes.policy"

/** The words of the chat in the language of the owner, taken from the message catalogue. */
export interface SetupPromptWords {
    /** The prefix the evidence of a gate that does not apply starts with. */
    readonly notApplicable: string
    /** The name of the button that applies a setup. */
    readonly applyButton: string
    /** How the owner is addressed. */
    readonly ownerAddress: string
}

/** One turn of the setup chat as the model sees it. */
export interface SetupTurnInput {
    /** The module being set up. */
    readonly module: ModuleDefinition
    /** The language of the reply. */
    readonly locale: Locale
    /** The draft so far. */
    readonly draft: DraftSnapshot
    /** The evidence per gate so far. */
    readonly gates: GateEvidence
    /** Earlier messages, oldest first; the new message is not included. */
    readonly history: ReadonlyArray<{ readonly role: "user" | "assistant"; readonly body: string }>
    /** The new owner message. */
    readonly message: string
    /** The customer questions the agent could not answer, most asked first. */
    readonly gaps: ReadonlyArray<OpenGap>
    /** The words of the chat in the language of the owner. */
    readonly words: SetupPromptWords
    /** The code of the first vague place of the action graph, or null when the graph has none: the turn asks about that and nothing else. */
    readonly graphGap?: string | null
}

/** What the model returned for one turn, validated. */
export interface SetupTurnResult {
    /** The reply to the owner. */
    readonly reply: string
    /** The new summary, when the model gave one. */
    readonly summary?: string
    /** The facts learned. */
    readonly facts: ReadonlyArray<SetupFact>
    /** The evidence the model proposes per gate. */
    readonly gates: Readonly<Record<string, string>>
    /** The structured writes the answer implies; each becomes a confirm card. */
    readonly writes: ReadonlyArray<ProposedWrite>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const clean = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

const factKeyOf = (value: unknown): string => {
    const key = clean(value, 60)
        .toLowerCase()
        .replace(/[^a-z0-9_]+/gu, "_")
    let start = 0
    let end = key.length
    while (start < end && key[start] === "_") start += 1
    while (end > start && key[end - 1] === "_") end -= 1
    return key.slice(start, end)
}

/** What reading a JSON text gave: the value, or why there is none. */
interface JsonRead {
    /** True when the text parsed. */
    readonly read: boolean
    /** The parsed value; null when the text did not parse. */
    readonly value: unknown
    /** Why the text did not parse; empty when it did. */
    readonly reason: string
}

const parseJson = (text: string): JsonRead => {
    try {
        return { read: true, value: JSON.parse(text), reason: "" }
    } catch (cause) {
        return { read: false, value: null, reason: String(cause) }
    }
}

/** The JSON object in a model answer, which may be fenced or surrounded by prose; null when there is none. */
export const parseLoose = (raw: string): unknown => {
    const text = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/, "")
        .trim()
    const direct = parseJson(text)
    if (direct.read) return direct.value
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    const inner = start >= 0 && end > start ? parseJson(text.slice(start, end + 1)) : direct
    return inner.read ? inner.value : null
}

/** The system prompt of one turn: the role, the checklist with its state, what each gate may write and the output contract. */
export const setupPromptOf = (input: SetupTurnInput): string => {
    const { module, locale, gaps } = input
    const language =
        locale === "vi"
            ? `Vietnamese (natural, warm business Vietnamese; address the owner as '${input.words.ownerAddress}')`
            : "English"
    const gateLines = module.gates
        .map((gate) => {
            const entry = gateEntry(input.gates, gate.key)
            const evidence = entry.evidence === "" ? "" : ` | evidence: ${entry.evidence.slice(0, 300)}`
            return `- ${gate.key} | ${gate.label_en} | ${gate.hint_en} | state: ${entry.status}${evidence}`
        })
        .join("\n")
    const specs = writeSpecLines(module)
    const gapLines = gaps
        .map((gap) => {
            const topic = gap.topic === null ? "" : ` | likely subject: ${gap.topic}`
            const attribute = gap.attributeGuess === null ? "" : ` | likely attribute: ${gap.attributeGuess}`
            return `- [${gap.id}] asked ${gap.count}x: "${gap.question.slice(0, 200)}"${topic}${attribute}`
        })
        .join("\n")
    const factLines = input.draft.facts.map((fact) => `- ${fact.key}: ${fact.text}`).join("\n") || "(none yet)"
    const writesRules =
        specs.length === 0
            ? ""
            : [
                  '- "writes": for every concrete value the owner gave THIS turn that matches a line of the writes list above, add one write. Use only gates, attributes and actions from that list, copy the attribute label exactly, never invent a value, and skip anything vague.',
                  '  Fact: {"gate": <gateKey>, "kind": "fact", "subject": <what it is about, e.g. the product or business name>, "attribute": <attribute label from the list>, "value": <the value in the words of the owner, prices and hours exact>}',
                  '  Rule: {"gate": <gateKey>, "kind": "rule", "action": <action from the list>, "mode": "auto"|"ask"|"never"} for a mode field, or {..., "limit_vnd": <integer VND, 20 million = 20000000>} for a limit field. "Never" / "always ask me" / "under X you may do it alone" are rules.',
              ].join("\n")
    const gapRules =
        gaps.length === 0
            ? ""
            : [
                  "- Open customer questions: once the checklist has no missing item ask the owner about the most asked one; before that raise one only if it relates to what is being discussed. Still ONE question per reply.",
                  `  When the owner answers one, add a write {"gate": "${GAP_GATE}", "kind": "fact", "gap": <id in brackets>, "subject": ..., "attribute": ..., "value": <the answer>}.`,
              ].join("\n")
    return [
        `You are NIVO, the setup assistant of a small-business operating system. You are setting up ${module.purpose}.`,
        "The owner is not technical. Talk in plain business language: no jargon, no mention of prompts, models or JSON.",
        `Write the reply in ${language}.`,
        "Your job each turn: (1) learn from what the owner just said, (2) record it, (3) work out what is STILL missing and ask ONE focused next question.",
        "This is continuous QA, not a form: before asking anything, check what is already known. An item is covered when it has evidence in the gates below, a matching fact, or the owner said it does not apply.",
        "",
        "Setup checklist (gates). Every gate must end up confirmed by the owner:",
        gateLines,
        "",
        specs.length === 0
            ? ""
            : `What each gate can write for real (Second Brain facts and the authority of the agent). The owner confirms every write on a card before it happens:\n${specs.join("\n")}`,
        gapLines === ""
            ? ""
            : `Customers asked these questions and the agent had no answer (open knowledge gaps). Ask the owner about them:\n${gapLines}`,
        "",
        "Facts already noted:",
        factLines,
        `Summary so far: ${input.draft.summary === "" ? "(none)" : input.draft.summary}`,
        "",
        "Rules:",
        "- Only record what the owner actually said. Never invent prices, hours, names or policies.",
        '- For each gate the message of the owner gives information for, return it under "gates" with status "proposed" and an evidence statement: a faithful, concise restatement of what the owner said (max 400 characters, in the language of the owner). Merge with earlier evidence if it extends it.',
        "- Do not return gates already confirmed unless the owner clearly changed them.",
        `- Not every business has every item. If the owner says an item does not apply (for example the business has no price list, does not use Zalo, or does not issue invoices), accept it: return that gate as proposed with evidence starting with '${input.words.notApplicable}' (or 'Not applicable:') plus their reason, and never ask about it again.`,
        "- When the answer is long-form (a price list, policies, a process document), do not make the owner type it in chat: suggest adding it as a source in the Knowledge menu and move on to the next item after they add it.",
        "- Never invent a checklist item that the gates do not mention.",
        '- "facts": short stable items worth remembering (key in snake_case, text max 200 characters). Reuse an existing key to update it.',
        '- "summary": 1-3 sentences describing the business, updated with new information.',
        `- "reply": max 80 words. Briefly acknowledge the answer, then ask ONE question about the next missing or unclear gate (use its hint to ask concretely; pick the item that blocks the most). If every gate has evidence, say what is left to confirm on the right and that once all are confirmed they should review and press "${input.words.applyButton}" ("Apply" in English).`,
        "",
        writesRules,
        gapRules,
        graphGapLine(input.graphGap ?? null),
        "",
        `Return ONLY a JSON object: {"reply": string, "summary": string, "facts": [{"key": string, "text": string}], "gates": {"<gateKey>": {"status": "proposed", "evidence": string}}${specs.length > 0 || gaps.length > 0 ? ', "writes": [ ... ]' : ""}}`,
        `Valid gate keys: ${module.gates.map((gate) => gate.key).join(", ")}`,
    ].join("\n")
}

const factsOf = (value: unknown): ReadonlyArray<SetupFact> => {
    if (!Array.isArray(value)) return []
    return value.flatMap((item): ReadonlyArray<SetupFact> => {
        if (!isObject(item)) return []
        const key = factKeyOf(item.key)
        const text = clean(item.text, 300)
        return key !== "" && text !== "" ? [{ key, text }] : []
    })
}

const gatesOf = (module: ModuleDefinition, value: unknown): Readonly<Record<string, string>> => {
    if (!isObject(value)) return {}
    const valid = new Set(module.gates.map((gate) => gate.key))
    return Object.fromEntries(
        Object.entries(value).flatMap(([key, entry]): ReadonlyArray<readonly [string, string]> => {
            const evidence = isObject(entry) ? clean(entry.evidence, 500) : ""
            return valid.has(key) && evidence !== "" ? [[key, evidence]] : []
        }),
    )
}

/** Reads the answer of the model: its reply, what it learned and the writes it proposes; text with no JSON is the reply itself. */
export const readSetupTurn = (
    input: SetupTurnInput,
    raw: string,
    fallbackReply: string,
    businessLabel: string,
): SetupTurnResult => {
    const parsed = parseLoose(raw)
    if (!isObject(parsed)) return { reply: raw === "" ? fallbackReply : raw, facts: [], gates: {}, writes: [] }
    const summary = clean(parsed.summary, 600)
    return {
        reply: clean(parsed.reply, 1500) || fallbackReply,
        ...(summary === "" ? {} : { summary }),
        facts: factsOf(parsed.facts),
        gates: gatesOf(input.module, parsed.gates),
        writes: [
            ...sanitizeWrites(input.module, parsed.writes, input.gaps, businessLabel),
            ...branchWritesOf(input.module, parsed.writes),
        ],
    }
}

/** The draft and the gate evidence once a turn is merged into them. */
export interface MergedTurn {
    /** The draft. */
    readonly draft: DraftSnapshot
    /** The evidence per gate. */
    readonly gates: GateEvidence
}

/** Merges a turn into the draft and the gate evidence; the model never overwrites a confirmed gate: the owner reopens it. */
export const mergeSetupTurn = (draft: DraftSnapshot, gates: GateEvidence, turn: SetupTurnResult): MergedTurn => {
    const facts = [...draft.facts]
    for (const fact of turn.facts) {
        const at = facts.findIndex((known) => known.key === fact.key)
        if (at >= 0) facts[at] = fact
        else facts.push(fact)
    }
    const merged: Record<string, GateEvidence[string]> = { ...gates }
    for (const [key, evidence] of Object.entries(turn.gates)) {
        if (merged[key]?.status === "confirmed") continue
        merged[key] = { status: "proposed", evidence }
    }
    return { draft: { summary: turn.summary ?? draft.summary, facts: facts.slice(-60) }, gates: merged }
}
