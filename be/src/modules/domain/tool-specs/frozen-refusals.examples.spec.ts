import { INSTALLED } from "@modules/domain/installed-plugins"
import { FROZEN_RIGHT_REFUSALS, toolSpecOf } from "./tool-specs.policy"

// ADDENDUM 4.3: on the template road a refusal of the setup (`not_attached`, `node_mode_unknown`) freezes
// the step (the door throws `GRAPH_NODES_TOOL_NOT_GRANTED`); no node ever reads it as `{ ok: false, refusal }`. The registry lists none
// of them in any tool's set, closed or open (`tool-specs.policy.spec.ts`). An OPEN set lets a node example script any code, so the
// registry's proof alone does not keep a frozen code out of the examples: this walks every installed template node's scripted answers
// (its own calls and the calls of its agent turns) and finds each that answers a frozen code, or, for a CLOSED set, a code the tool
// cannot answer (its set, and `declined` for a tool that can ask).

/** One scripted answer of an example, as far as this proof reads it. */
interface ScriptedAnswer {
    readonly ok: boolean
    readonly refusal?: string
}

/** One scripted answer of an example, with the tool it answers. */
interface Scripted {
    readonly id: string
    readonly answer: ScriptedAnswer
}

/** Every scripted answer of every example of every installed template node: `<node> / <example> / <tool>` and the answer. */
const scriptedAnswers = (): ReadonlyArray<{ readonly at: string; readonly call: Scripted }> =>
    INSTALLED.templateNodes().flatMap((node) =>
        node.examples.flatMap((example) => {
            const own: ReadonlyArray<Scripted> = example.tools ?? []
            const turns: ReadonlyArray<Scripted> = (example.agent ?? []).flatMap((turn) => turn.calls ?? [])
            return [...own, ...turns].map((call) => ({ at: `${node.id} / ${example.name} / ${call.id}`, call }))
        }),
    )

/** The refused answers whose code the door freezes on the template road. */
const frozenScripts = (): ReadonlyArray<string> =>
    scriptedAnswers().flatMap(({ at, call }) => {
        const code = call.answer.ok ? undefined : call.answer.refusal
        return code !== undefined && FROZEN_RIGHT_REFUSALS.some((frozen) => frozen === code) ? [`${at}: ${code}`] : []
    })

/** The refused answers of a tool with a CLOSED set whose code is none it can answer (its set, `declined` when it can ask). */
const outsideClosedSets = (): ReadonlyArray<string> =>
    scriptedAnswers().flatMap(({ at, call }) => {
        const code = call.answer.ok ? undefined : call.answer.refusal
        const held = toolSpecOf(call.id)
        if (code === undefined || held?.refusals.closed !== true) return []
        const answerable = [...held.refusals.codes, ...(held.mutates ? ["declined"] : [])]
        return answerable.includes(code) ? [] : [`${at}: ${code}`]
    })

/**
 * The examples that still script a frozen code, as found on 2026-11-12 (NODES-LEAD's nodes, read only here): each is a FALSE example
 * (the step it shows answering freezes on the real road). The proof pins the list EXACTLY: a new one fails, and a fixed one must be
 * struck from here. Empty is the goal.
 */
const KNOWN_FALSE_EXAMPLES: ReadonlyArray<string> = [
]

describe("the scripted answers of the installed template nodes", () => {
    it("never answer a refusal of a right: the template road freezes on each (ADDENDUM 4.3)", () => {
        expect(frozenScripts()).toEqual(KNOWN_FALSE_EXAMPLES)
    })

    it("answer a tool of a closed set only a code it can answer (its set, and `declined` when it can ask)", () => {
        // The false examples above are struck from here as they are fixed; no other may appear.
        expect(outsideClosedSets().filter((found) => !KNOWN_FALSE_EXAMPLES.includes(found))).toEqual([])
    })

    it("read every installed template node's examples (the walk is not empty)", () => {
        expect(scriptedAnswers().length).toBeGreaterThan(100)
    })
})
