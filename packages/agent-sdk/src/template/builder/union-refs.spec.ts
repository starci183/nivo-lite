import { z } from "zod"
import { graphSpecV2Schema } from "../../graph/graph-spec-v2.schema"
import { TRIGGER } from "../../names"
import {
    absent,
    and,
    endItem,
    endRound,
    equals,
    gt,
    ifNode,
    item,
    loop,
    not,
    notEquals,
    or,
    node,
    outcome,
    present,
    ref,
    trigger,
} from "./graph-builder"
import type { GraphStep, RefOrValue, TemplateGraphConfig } from "./graph-builder.types"
import { compileTemplateGraph } from "./graph-compile"
import { templateGraphProblems } from "./graph-problems"
import { parseJson } from "./template.fixture"
import { defineTemplateNode, templateNodeProblems } from "./template-node"
import type { TemplateNodeShape } from "./template-node"
import type { TemplateProblem } from "./template-problems"

const codesOf = (problems: ReadonlyArray<TemplateProblem>): ReadonlyArray<string> =>
    problems.map((problem) => `${problem.code}@${problem.at}`)

/** Opens a purchase, or answers `declined: true` with every member null (and no `only`): a discriminated union, no routes. */
const openOutput = z.discriminatedUnion("declined", [
    z.object({
        declined: z.literal(false),
        purchaseId: z.string().max(200),
        count: z.number(),
        held: z.object({ need: z.string().max(200) }),
        only: z.string().max(200),
    }),
    z.object({ declined: z.literal(true), purchaseId: z.null(), count: z.null(), held: z.null() }),
])
const openNode = () =>
    defineTemplateNode({
        id: "test.union-open",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [],
        mode: "auto",
        accounts: [],
        input: z.object({}),
        output: openOutput,
        run: () => Promise.resolve({ declined: true as const, purchaseId: null, count: null, held: null }),
        examples: [
            {
                name: "declined",
                params: {},
                input: {},
                output: { declined: true, purchaseId: null, count: null, held: null },
            },
        ],
    })

/** Routes by `verdict`; each variant fixes it: `go` carries `orderId`, `stop` carries `reason`. */
const routedOutput = z.discriminatedUnion("verdict", [
    z.object({ verdict: z.literal("go"), orderId: z.string().max(200) }),
    z.object({ verdict: z.literal("stop"), reason: z.string().max(200) }),
])
const routedNode = () =>
    defineTemplateNode({
        id: "test.union-routed",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [],
        mode: "auto",
        accounts: [],
        input: z.object({}),
        output: routedOutput,
        routes: { by: "verdict", names: ["go", "stop"] },
        run: () => Promise.resolve({ verdict: "go" as const, orderId: "o1" }),
        examples: [{ name: "go", params: {}, input: {}, output: { verdict: "go", orderId: "o1" } }],
    })

/** Routes by `verdict`, but the `stop` variant says only "a text": no discriminant relation is provable. */
const looseRoutedNode = () =>
    defineTemplateNode({
        id: "test.union-loose-routed",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [],
        mode: "auto",
        accounts: [],
        input: z.object({}),
        output: z.union([
            z.object({ verdict: z.literal("go"), orderId: z.string().max(200) }),
            z.object({ verdict: z.string().max(200), reason: z.string().max(200) }),
        ]),
        routes: { by: "verdict", names: ["go", "stop"] },
        run: () => Promise.resolve({ verdict: "go" as const, orderId: "o1" }),
        examples: [{ name: "go", params: {}, input: {}, output: { verdict: "go", orderId: "o1" } }],
    })

/** A plain union: `a` is a text in one variant and a number in the other, `b` only in the second. */
const plainNode = () =>
    defineTemplateNode({
        id: "test.union-plain",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [],
        mode: "auto",
        accounts: [],
        input: z.object({}),
        output: z.union([z.object({ a: z.string().max(200) }), z.object({ a: z.number(), b: z.string().max(200) })]),
        run: () => Promise.resolve({ a: "x" }),
        examples: [{ name: "a", params: {}, input: {}, output: { a: "x" } }],
    })

/** Takes a required text, an optional number and an optional text. */
const take = defineTemplateNode({
    id: "test.union-take",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({ text: z.string().max(200), count: z.number().optional(), soft: z.string().max(200).optional() }),
    output: z.object({}),
    run: () => Promise.resolve({}),
    examples: [{ name: "x", params: {}, input: { text: "t" }, output: {} }],
})

/** A step that takes `text` (and whatever else is given). */
const takes = (input: Readonly<Record<string, RefOrValue>>, next?: string): GraphStep =>
    node(take, { input: { text: "fixed", ...input }, ...(next === undefined ? {} : { next }) })

const graph = (start: string, nodes: Readonly<Record<string, GraphStep>>): TemplateGraphConfig => ({
    key: "test.union",
    title: { key: "g" },
    input: z.object({ leadId: z.string().max(200).nullish(), orderId: z.string().max(200) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    start,
    nodes,
})

const strict = (config: TemplateGraphConfig): ReadonlyArray<string> =>
    codesOf(compileTemplateGraph(config, { nullability: "strict" }).problems)

const lenient = (config: TemplateGraphConfig): ReadonlyArray<string> => codesOf(compileTemplateGraph(config).problems)

describe("a union output's members are typed", () => {
    /** `a` opens, `b` reads it. */
    const reads = (input: Readonly<Record<string, RefOrValue>>): TemplateGraphConfig =>
        graph("a", { a: node(openNode(), { next: "b" }), b: takes(input) })

    it.each<readonly [string, Readonly<Record<string, RefOrValue>>, ReadonlyArray<string>]>([
        [
            "a member typed text|null into a number: refused (the type of each variant)",
            { count: ref("steps.a.output.purchaseId", { default: 1 }) },
            ["GRAPH_REF_TYPE@nodes.b.params.count<-steps.a.output.purchaseId"],
        ],
        [
            "a member no variant has: refused",
            { soft: ref("steps.a.output.nowhere") },
            ["GRAPH_REF_TYPE@nodes.b.params.soft<-steps.a.output.nowhere"],
        ],
        [
            "a member one variant lacks into a required text, no default: refused (it may read nothing)",
            { text: ref("steps.a.output.only") },
            ["GRAPH_REF_TYPE@nodes.b.params.text<-steps.a.output.only"],
        ],
        ["the same with a fitting default: accepted", { text: ref("steps.a.output.only", { default: "none" }) }, []],
        [
            "a member null in one variant into a required text, no default: refused",
            { text: ref("steps.a.output.purchaseId") },
            ["GRAPH_REF_TYPE@nodes.b.params.text<-steps.a.output.purchaseId"],
        ],
        ["the same into an optional text: accepted (left out)", { soft: ref("steps.a.output.purchaseId") }, []],
        [
            "a nested member under a variant's null: refused without default",
            { text: ref("steps.a.output.held.need") },
            ["GRAPH_REF_TYPE@nodes.b.params.text<-steps.a.output.held.need"],
        ],
        [
            "a nested member's type: a text into a number refused",
            { count: ref("steps.a.output.held.need", { default: 1 }) },
            ["GRAPH_REF_TYPE@nodes.b.params.count<-steps.a.output.held.need"],
        ],
        ["the discriminant itself is typed: a boolean into a text refused", { soft: ref("steps.a.output.declined") }, [
            "GRAPH_REF_TYPE@nodes.b.params.soft<-steps.a.output.declined",
        ]],
    ])("%s", (_label, input, codes) => {
        expect(strict(reads(input))).toEqual(codes)
    })

    it("lenient still types the members (a wrong type, a member no variant has), never their nullability", () => {
        expect(lenient(reads({ count: ref("steps.a.output.purchaseId") }))).toEqual([
            "GRAPH_REF_TYPE@nodes.b.params.count<-steps.a.output.purchaseId",
        ])
        expect(lenient(reads({ text: ref("steps.a.output.only") }))).toEqual([])
        expect(lenient(reads({ soft: ref("steps.a.output.nowhere") }))).toEqual([
            "GRAPH_REF_TYPE@nodes.b.params.soft<-steps.a.output.nowhere",
        ])
    })

    it("a plain (non-discriminated) union: a member of mixed types is untyped, one only some variants hold may read nothing", () => {
        const config = (input: Readonly<Record<string, RefOrValue>>): TemplateGraphConfig =>
            graph("a", { a: node(plainNode(), { next: "b" }), b: takes(input) })
        expect(strict(config({ count: ref("steps.a.output.a") }))).toEqual([])
        expect(strict(config({ text: ref("steps.a.output.b") }))).toEqual([
            "GRAPH_REF_TYPE@nodes.b.params.text<-steps.a.output.b",
        ])
        expect(strict(config({ count: ref("steps.a.output.b", { default: 1 }) }))).toEqual([
            "GRAPH_REF_TYPE@nodes.b.params.count<-steps.a.output.b",
        ])
    })
})

describe("narrowing by the routed branch", () => {
    it("a routing node may answer a union of objects that each hold `by`; a variant without it, or other names, are refused", () => {
        const shape: TemplateNodeShape = {
            id: "test.union-routed",
            description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
            tools: [],
            mode: "auto",
            accounts: [],
            input: z.object({}),
            output: routedOutput,
            routes: { by: "verdict", names: ["go", "stop"] },
            examples: [{ name: "go" }],
        }
        expect(codesOf(templateNodeProblems(shape))).toEqual([])
        const lacking = { ...shape, output: z.union([z.object({ verdict: z.literal("go") }), z.object({ reason: z.string().max(200) })]) }
        expect(codesOf(templateNodeProblems(lacking))).toEqual(["NODE_ROUTES_BY_UNKNOWN@test.union-routed.routes.by"])
        const named = { ...shape, routes: { by: "verdict", names: ["go", "later"] } }
        expect(codesOf(templateNodeProblems(named))).toEqual(["NODE_ROUTE_NAMES_INVALID@test.union-routed.routes.names"])
    })

    const routed = (go: GraphStep, stop: GraphStep, routes: { readonly go: string; readonly stop: string } = { go: "b", stop: "c" }) =>
        graph("r", { r: node(routedNode(), { routes }), b: go, c: stop })

    it.each<readonly [string, TemplateGraphConfig, ReadonlyArray<string>]>([
        [
            "the `go` branch reads its variant's member, no default: accepted",
            routed(takes({ text: ref("steps.r.output.orderId") }), takes({ text: ref("steps.r.output.reason") })),
            [],
        ],
        [
            "a member of the OTHER variant on a branch: refused (absent there)",
            routed(takes({ soft: ref("steps.r.output.reason", { default: "x" }) }), takes({})),
            ["GRAPH_REF_TYPE@nodes.b.params.soft<-steps.r.output.reason"],
        ],
        [
            "a step reached from both routes: not narrowed, refused without default",
            routed(takes({ text: ref("steps.r.output.orderId") }), takes({}), { go: "b", stop: "b" }),
            ["GRAPH_NODE_UNREACHABLE@nodes.c", "GRAPH_REF_TYPE@nodes.b.params.text<-steps.r.output.orderId"],
        ],
        [
            "a join of the two branches: not narrowed, refused without default",
            graph("r", {
                r: node(routedNode(), { routes: { go: "b", stop: "c" } }),
                b: takes({}, "d"),
                c: takes({}, "d"),
                d: takes({ text: ref("steps.r.output.orderId") }),
            }),
            ["GRAPH_REF_TYPE@nodes.d.params.text<-steps.r.output.orderId"],
        ],
        [
            "no discriminant relation (a variant's `by` is any text): not narrowed, refused without default",
            graph("r", {
                r: node(looseRoutedNode(), { routes: { go: "b", stop: "c" } }),
                b: takes({ text: ref("steps.r.output.orderId") }),
                c: takes({}),
            }),
            ["GRAPH_REF_TYPE@nodes.b.params.text<-steps.r.output.orderId"],
        ],
    ])("%s", (_label, config, codes) => {
        expect(strict(config)).toEqual(codes)
    })
})

/** The input bindings of the `b`, `c` and `d` steps of a tested `if`, each optional. */
interface BranchBindings {
    readonly b?: Readonly<Record<string, RefOrValue>>
    readonly c?: Readonly<Record<string, RefOrValue>>
    readonly d?: Readonly<Record<string, RefOrValue>>
}

describe("narrowing after an ifNode", () => {
    /** `a` opens; the `if` tests it; `b` is its `yes`, `c` its `no`, both ending at `d` when `joined`. */
    const tested = (
        when: Parameters<typeof ifNode>[0]["when"],
        steps: BranchBindings,
    ): TemplateGraphConfig =>
        graph("a", {
            a: node(openNode(), { next: "test" }),
            test: ifNode({ when, yes: "b", no: "c" }),
            b: takes(steps.b ?? {}, steps.d === undefined ? undefined : "d"),
            c: takes(steps.c ?? {}, steps.d === undefined ? undefined : "d"),
            ...(steps.d === undefined ? {} : { d: takes(steps.d) }),
        })
    const purchase = { text: ref("steps.a.output.purchaseId") }
    const declined = ref("steps.a.output.declined")
    const id = ref("steps.a.output.purchaseId")

    it.each<readonly [string, TemplateGraphConfig, ReadonlyArray<string>]>([
        ["equals(discriminant, false): the then side reads the opened variant", tested(equals(declined, false), { b: purchase }), []],
        [
            "equals(discriminant, false): the else side is the declined variant, refused",
            tested(equals(declined, false), { c: purchase }),
            ["GRAPH_REF_TYPE@nodes.c.params.text<-steps.a.output.purchaseId"],
        ],
        [
            "equals(discriminant, false): the join after the if is not narrowed, refused",
            tested(equals(declined, false), { d: purchase }),
            ["GRAPH_REF_TYPE@nodes.d.params.text<-steps.a.output.purchaseId"],
        ],
        [
            "equals(discriminant, true) (the Sales `declined` check): its else side reads the opened variant",
            tested(equals(declined, true), { c: purchase }),
            [],
        ],
        [
            "equals(discriminant, true): its then side is the declined variant, refused",
            tested(equals(declined, true), { b: purchase }),
            ["GRAPH_REF_TYPE@nodes.b.params.text<-steps.a.output.purchaseId"],
        ],
        [
            "equals narrows the variant: a member only the opened variant has reads on its side",
            tested(equals(declined, false), { b: { text: ref("steps.a.output.only") } }),
            [],
        ],
        ["notEquals(discriminant, true): its then side reads the opened variant", tested(notEquals(declined, true), { b: purchase }), []],
        ["present(member): the then side reads it non-null", tested(present(id), { b: purchase }), []],
        [
            "present(member) also drops the variant it is null in: another member reads",
            tested(present(id), { b: { text: ref("steps.a.output.held.need") } }),
            [],
        ],
        [
            "present(member): the else side is not narrowed, refused",
            tested(present(id), { c: purchase }),
            ["GRAPH_REF_TYPE@nodes.c.params.text<-steps.a.output.purchaseId"],
        ],
        ["absent(member): the else side reads it non-null", tested(absent(id), { c: purchase }), []],
        [
            "absent(member): the then side refused",
            tested(absent(id), { b: purchase }),
            ["GRAPH_REF_TYPE@nodes.b.params.text<-steps.a.output.purchaseId"],
        ],
        [
            "and(...) on the then side: each part narrows",
            tested(and(equals(declined, false), present(ref("trigger.leadId"))), {
                b: { text: ref("steps.a.output.purchaseId"), soft: ref("trigger.leadId") },
            }),
            [],
        ],
        [
            "or(...) on the then side: nothing narrows",
            tested(or(present(id), present(ref("trigger.leadId"))), { b: purchase }),
            ["GRAPH_REF_TYPE@nodes.b.params.text<-steps.a.output.purchaseId"],
        ],
        ["or(...) on the else side: each part is false", tested(or(absent(id), equals(declined, true)), { c: purchase }), []],
        ["not(equals(discriminant, true)) on the then side", tested(not(equals(declined, true)), { b: purchase }), []],
        [
            "a test ref with a non-null default proves nothing (it reads the default when the source holds nothing)",
            tested(present(ref("steps.a.output.purchaseId", { default: "x" })), { b: purchase }),
            ["GRAPH_REF_TYPE@nodes.b.params.text<-steps.a.output.purchaseId"],
        ],
        [
            "an order comparison makes the else side unknown-able: nothing narrows there",
            tested(or(absent(id), equals(declined, true), gt(ref("steps.a.output.count"), 3)), {
                c: purchase,
            }),
            ["GRAPH_REF_TYPE@nodes.c.params.text<-steps.a.output.purchaseId"],
        ],
        [
            "present(trigger input): an optional input reads non-null on the then side",
            tested(present(ref("trigger.leadId")), { b: { text: ref("trigger.leadId") } }),
            [],
        ],
        [
            "present(trigger input): refused on the else side",
            tested(present(ref("trigger.leadId")), { c: { text: ref("trigger.leadId") } }),
            ["GRAPH_REF_TYPE@nodes.c.params.text<-trigger.leadId"],
        ],
    ])("%s", (_label, config, codes) => {
        expect(strict(config)).toEqual(codes)
    })

    it("a plain union's member compared with a literal does not narrow (no discriminant)", () => {
        const config = graph("a", {
            a: node(plainNode(), { next: "test" }),
            test: ifNode({ when: equals(ref("steps.a.output.a"), "x"), yes: "b", no: "c" }),
            b: takes({ text: ref("steps.a.output.b") }),
            c: takes({}),
        })
        expect(strict(config)).toEqual(["GRAPH_REF_TYPE@nodes.b.params.text<-steps.a.output.b"])
    })

    it("the STORED document narrows as the builder does (routes, routeBy, when), after a JSON round trip", () => {
        const accepted = tested(equals(declined, true), { c: purchase })
        const refused = tested(equals(declined, true), { b: purchase })
        for (const [config, codes] of [
            [accepted, []],
            [refused, ["GRAPH_REF_TYPE@nodes.b.params.text<-steps.a.output.purchaseId"]],
        ] as const) {
            const compiled = compileTemplateGraph(config, { nullability: "strict" })
            const stored = graphSpecV2Schema.parse(parseJson(JSON.stringify(compiled.graph.spec)))
            expect(codesOf(templateGraphProblems(stored, { nodes: compiled.graph.nodes, nullability: "strict" }))).toEqual(codes)
        }
        const routedConfig = graph("r", {
            r: node(routedNode(), { routes: { go: "b", stop: "c" } }),
            b: takes({ text: ref("steps.r.output.orderId") }),
            c: takes({ text: ref("steps.r.output.orderId") }),
        })
        const compiled = compileTemplateGraph(routedConfig, { nullability: "strict" })
        const stored = graphSpecV2Schema.parse(parseJson(JSON.stringify(compiled.graph.spec)))
        expect(codesOf(templateGraphProblems(stored, { nodes: compiled.graph.nodes, nullability: "strict" }))).toEqual([
            "GRAPH_REF_TYPE@nodes.c.params.text<-steps.r.output.orderId",
        ])
    })
})

describe("narrowing and loops", () => {
    const list = defineTemplateNode({
        id: "test.union-list",
        title: { key: "t" },
        description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
        tools: [],
        mode: "auto",
        accounts: [],
        input: z.object({}),
        output: z.object({ ids: z.array(z.string().max(200)).max(50) }),
        run: () => Promise.resolve({ ids: [] }),
        examples: [{ name: "x", params: {}, input: {}, output: { ids: [] } }],
    })

    it("an over body: a step on a route of a body routing node reads its variant", () => {
        const config = graph("l", {
            l: node(list, { next: "each" }),
            each: loop({
                over: ref("steps.l.output.ids"),
                body: {
                    start: "r",
                    nodes: {
                        r: node(routedNode(), { routes: { go: "b", stop: endItem } }),
                        b: takes({ text: ref("steps.r.output.orderId"), soft: item() }),
                    },
                },
                next: "end",
            }),
            end: outcome({ name: "done" }),
        })
        expect(strict(config)).toEqual([])
    })

    it("an until body: the round's routing node narrows the step on its route", () => {
        const config = graph("chase", {
            chase: loop({
                until: { route: "r", stop: "stop" },
                max: 3,
                body: {
                    start: "r",
                    nodes: {
                        r: node(routedNode(), { routes: { go: "b", stop: endRound } }),
                        b: takes({ text: ref("steps.r.output.orderId") }),
                    },
                },
                next: "end",
                exhausted: "end",
            }),
            end: outcome({ name: "done" }),
        })
        expect(strict(config)).toEqual([])
    })

    it("nothing proven inside a body holds after the loop; a test before the loop holds inside its body", () => {
        const config = (after: Readonly<Record<string, RefOrValue>>, inBody: Readonly<Record<string, RefOrValue>>) =>
            graph("a", {
                a: node(openNode(), { next: "l" }),
                l: node(list, { next: "each" }),
                each: loop({
                    over: ref("steps.l.output.ids"),
                    body: {
                        start: "test",
                        nodes: {
                            test: ifNode({ when: equals(ref("steps.a.output.declined"), false), yes: "b", no: endItem }),
                            b: takes(inBody),
                        },
                    },
                    next: "after",
                }),
                after: takes(after),
            })
        expect(strict(config({}, { text: ref("steps.a.output.purchaseId") }))).toEqual([])
        expect(strict(config({ text: ref("steps.a.output.purchaseId") }, {}))).toEqual([
            "GRAPH_REF_TYPE@nodes.after.params.text<-steps.a.output.purchaseId",
        ])
        const before = graph("a", {
            a: node(openNode(), { next: "test" }),
            test: ifNode({ when: equals(ref("steps.a.output.declined"), false), yes: "l", no: "no" }),
            no: outcome({ name: "declined" }),
            l: node(list, { next: "each" }),
            each: loop({
                over: ref("steps.l.output.ids"),
                body: { start: "b", nodes: { b: takes({ text: ref("steps.a.output.purchaseId") }) } },
                next: "end",
            }),
            end: outcome({ name: "done" }),
        })
        expect(strict(before)).toEqual([])
    })
})
