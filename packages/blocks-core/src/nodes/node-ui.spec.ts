import { z } from "zod"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import en from "../messages/en.json"
import vi from "../messages/vi.json"
import { messageNamed } from "../messages/catalog"
import { coreNodes } from "./core-nodes"
import { nodeCardOf, nodeCardsOf } from "./node-cards"
import { NODE_PARAMS_UI, paramFieldsOf } from "./node-params"
import type { ParamField } from "./node-params"
import {
    NODE_HEROICONS,
    NODE_ICONS,
    NODE_KINDS,
    NODE_UI,
    STOP_STEP_ID,
    TRIGGER_STEP,
    branchesOf,
    namePartOf,
} from "./node-ui"
import type { NodeLocale } from "./node-schema.types"

const LOCALES: ReadonlyArray<NodeLocale> = ["vi", "en"]
const WORDS_MAX = 5
const IDS: ReadonlyArray<string> = [...coreNodes.map((node) => node.id), TRIGGER_STEP, STOP_STEP_ID]
const conditions = coreNodes.filter((node) => node.role === "condition")

const wordsIn = (text: string): number => text.split(/\s+/u).filter((word) => word !== "").length

/** The core node of an id, as a list of one so a test loops over it instead of asserting it exists. */
const nodesOf = (id: string): ReadonlyArray<NodeDefinition> => coreNodes.filter((one) => one.id === id)

/** The JSON Schema of a node's params as the form reads it. */
const schemaOf = (node: NodeDefinition): Readonly<Record<string, unknown>> =>
    z.toJSONSchema(node.params, { io: "input", unrepresentable: "any" })

const schemaFieldsOf = (node: NodeDefinition): ReadonlyArray<string> => {
    const properties: unknown = schemaOf(node)["properties"]
    return typeof properties === "object" && properties !== null ? Object.keys(properties) : []
}

const schemaEnumOf = (node: NodeDefinition, field: string): ReadonlyArray<unknown> | undefined => {
    const properties: unknown = schemaOf(node)["properties"]
    const one: unknown = typeof properties === "object" && properties !== null ? Reflect.get(properties, field) : undefined
    const values: unknown = typeof one === "object" && one !== null ? Reflect.get(one, "enum") : undefined
    return Array.isArray(values) ? values : undefined
}

describe("the kind and icon of every step", () => {
    it("has an entry for every core node, the trigger and the end, and none for a node that does not exist", () => {
        expect(Object.keys(NODE_UI).sort()).toEqual([...IDS].sort())
    })

    it("gives each step a known kind and a known icon that stands for a Heroicons glyph", () => {
        for (const id of IDS) {
            const entry = NODE_UI[id]
            expect(NODE_KINDS).toContain(entry?.kind)
            expect(NODE_ICONS).toContain(entry?.icon)
        }
        expect(NODE_ICONS.map((icon) => NODE_HEROICONS[icon]).every((name) => /^[A-Za-z]+Icon$/u.test(name))).toBe(true)
    })

    it("makes a condition of every condition node and of nothing else, the end of `stop` and an event of the trigger", () => {
        for (const node of coreNodes) {
            expect(NODE_UI[node.id]?.kind === "condition").toBe(node.role === "condition")
        }
        expect(NODE_UI[STOP_STEP_ID]?.kind).toBe("end")
        expect(NODE_UI[TRIGGER_STEP]?.kind).toBe("event")
    })

    it("uses every kind at least once, so no kind is dead", () => {
        expect(new Set(IDS.map((id) => NODE_UI[id]?.kind))).toEqual(new Set(NODE_KINDS))
    })
})

describe.each(LOCALES)("the words of every step in %s", (locale) => {
    const cards = nodeCardsOf(locale)

    it.each(IDS)("%s has a title and a subtitle of at most five words that do not repeat the title", (id) => {
        const card = cards.get(id)
        expect(card?.title).toBeTruthy()
        expect(card?.subtitle).toBeTruthy()
        expect(wordsIn(card?.subtitle ?? "")).toBeLessThanOrEqual(WORDS_MAX)
        expect(card?.subtitle.toLowerCase()).not.toBe(card?.title.toLowerCase())
    })
})

describe("the two languages", () => {
    it("say different words for the title of every step", () => {
        const viCards = nodeCardsOf("vi")
        const enCards = nodeCardsOf("en")
        for (const id of IDS) expect(viCards.get(id)?.title).not.toBe(enCards.get(id)?.title)
    })

    it("hold the same keys in both catalogs, with no key empty", () => {
        expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort())
        expect(Object.values(vi).concat(Object.values(en)).every((text) => text !== "")).toBe(true)
    })
})

describe("the named outputs of a condition", () => {
    it.each(conditions.map((node) => node.id))("%s has a label in both languages for every branch it can answer", (id) => {
        expect(nodesOf(id)).toHaveLength(1)
        for (const node of nodesOf(id)) {
            const branches = branchesOf(node)
            expect(branches.length).toBeGreaterThan(0)
            for (const locale of LOCALES) {
                const card = nodeCardOf(node, locale)
                expect(card.outputs.map((output) => output.id)).toEqual(branches)
                for (const output of card.outputs) {
                    expect(messageNamed(locale, `node${namePartOf(id)}Output${namePartOf(output.id)}`)).toBe(output.label)
                }
            }
        }
    })

    it("is empty for a step whose output names no branch", () => {
        const cards = nodeCardsOf("vi")
        for (const node of coreNodes.filter((one) => branchesOf(one).length === 0)) {
            expect(cards.get(node.id)?.outputs).toEqual([])
        }
    })
})

describe("the form of every setting", () => {
    it("describes every field of every node's params, and no field a node does not have", () => {
        for (const node of coreNodes) {
            expect(Object.keys(NODE_PARAMS_UI[node.id] ?? {}).sort()).toEqual([...schemaFieldsOf(node)].sort())
        }
        expect(Object.keys(NODE_PARAMS_UI).every((id) => coreNodes.some((node) => node.id === id))).toBe(true)
    })

    const shown = (locale: NodeLocale): ReadonlyArray<ParamField & { readonly nodeId: string }> =>
        coreNodes.flatMap((node) =>
            paramFieldsOf(node, locale)
                .filter((field) => !field.hidden)
                .map((field) => ({ ...field, nodeId: node.id })),
        )

    it.each(LOCALES)("gives every shown field a label, a one-line help and an input in %s", (locale) => {
        const fields = shown(locale)
        expect(fields.length).toBeGreaterThan(0)
        for (const field of fields) {
            expect([field.nodeId, field.name, field.label === field.name]).toEqual([field.nodeId, field.name, false])
            expect([field.nodeId, field.name, field.help !== ""]).toEqual([field.nodeId, field.name, true])
            expect(field.help).not.toContain("\n")
        }
    })

    it("gives money its sign, a duration its unit and an enum its choices with words, in both languages", () => {
        for (const locale of LOCALES) {
            for (const field of shown(locale)) {
                if (field.input === "money") expect(field.unitLabel).toBe("₫")
                if (field.input === "duration") {
                    const unitKey = field.unit === "hours" ? "nodeUnitHours" : "nodeUnitMinutes"
                    expect(field.unitLabel).toBe(messageNamed(locale, unitKey))
                }
                if (field.input === "enum") {
                    expect((field.options ?? []).length).toBeGreaterThan(0)
                    for (const option of field.options ?? []) expect(option.label).not.toBe(option.value)
                }
            }
        }
    })

    it("lists the choices of an enum the schema itself lists, no more and no fewer", () => {
        for (const node of coreNodes) {
            for (const field of paramFieldsOf(node, "vi").filter((one) => !one.hidden)) {
                const declared = schemaEnumOf(node, field.name)
                if (declared !== undefined) expect((field.options ?? []).map((option) => option.value)).toEqual(declared)
            }
        }
    })

    it("hides the internal settings: the locale, the claim rules, the mindset and the action ids", () => {
        const hidden = coreNodes.flatMap((node) =>
            paramFieldsOf(node, "vi")
                .filter((field) => field.hidden)
                .map((field) => `${node.id}.${field.name}`),
        )

        expect(hidden.sort()).toEqual(
            [
                "core.outcome.outcome",
            ].sort(),
        )
    })

    it("takes the limits from the schema unless the form sets its own, and the value from the graph else the default", () => {
        const fieldsOf = (id: string, values: Readonly<Record<string, unknown>> = {}): ReadonlyArray<ParamField> =>
            nodesOf(id).flatMap((node) => paramFieldsOf(node, "vi", values))
        const cap = fieldsOf("core.for-each", { max: 7 }).find((field) => field.name === "max")
        const lead = fieldsOf("sales.care-occasion").find((field) => field.name === "occasionLeadDays")

        expect(cap).toMatchObject({ input: "number", min: 1, max: 50, value: 7 })
        expect(lead).toMatchObject({ input: "number", unit: "days" })
        expect(lead?.unitLabel).toBe(vi.nodeUnitDays)
    })
})
