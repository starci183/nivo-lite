import { z } from "zod"
import { defineRead } from "../block/block"
import type { ReadDefinition } from "../block/block.types"
import { allowedValuesOf, enumValuesOf, paramHandleOf, paramProblems } from "./spec-param"
import type { ParamSource } from "./spec-param"
import type { SpecParam } from "./spec.types"

const LEADS: ReadDefinition = defineRead({
    id: "sales.leads",
    dataKind: "lead",
    shape: "list",
    fields: ["id"],
    paths: {},
    variables: z.object({
        q: z.string().max(200).optional(),
        stage: z.enum(["new", "won", "all"]).optional(),
        sort: z.enum(["recent", "value"]),
    }),
    operation: "leads",
    permission: "sales.view",
})
const READS = [LEADS]

const STAGE: SpecParam = { type: "enum", of: "sales.leads.stage", url: "stage", default: "all" }

describe("enumValuesOf", () => {
    it("lists the values of an optional or a required enum variable", () => {
        expect(enumValuesOf(LEADS.variables, "stage")).toEqual(["new", "won", "all"])
        expect(enumValuesOf(LEADS.variables, "sort")).toEqual(["recent", "value"])
    })

    it("is undefined for a variable that is not an enum, or that the read does not have", () => {
        expect(enumValuesOf(LEADS.variables, "q")).toBeUndefined()
        expect(enumValuesOf(LEADS.variables, "nope")).toBeUndefined()
    })
})

describe("allowedValuesOf", () => {
    it("is null for a param that takes any string", () => {
        expect(allowedValuesOf({ type: "string", url: "q" }, READS)).toBeNull()
    })

    it("is the listed values of an of list", () => {
        expect(allowedValuesOf({ type: "enum", of: ["list", "detail"], url: "pane" }, undefined)).toEqual([
            "list",
            "detail",
        ])
    })

    it("is the values of the read variable an of reference names", () => {
        expect(allowedValuesOf(STAGE, READS)).toEqual(["new", "won", "all"])
    })

    it("is undefined for a reference to an unknown read or variable, and null when the reads are not known", () => {
        expect(allowedValuesOf({ type: "enum", of: "sales.nope.stage", url: "s" }, READS)).toBeUndefined()
        expect(allowedValuesOf({ type: "enum", of: "sales.leads.q", url: "s" }, READS)).toBeUndefined()
        expect(allowedValuesOf(STAGE, undefined)).toBeNull()
    })
})

describe("paramProblems", () => {
    it("accepts sound params", () => {
        const params = {
            q: { type: "string", url: "q" },
            stage: STAGE,
            sort: { type: "enum", of: "sales.leads.sort", url: "sort", default: "recent" },
            pane: { type: "enum", of: ["list", "detail"], url: "pane", default: "list" },
        } as const
        expect(paramProblems(params, READS)).toEqual([])
    })

    it("refuses an enum without values, a string with values, and empty values", () => {
        const problems = paramProblems(
            {
                a: { type: "enum", url: "a" },
                b: { type: "string", of: ["x"], url: "b" },
                c: { type: "enum", of: [], url: "c" },
            },
            READS,
        )
        expect(problems).toEqual([
            { code: "SPEC_PARAM_INVALID", at: "params.a" },
            { code: "SPEC_PARAM_INVALID", at: "params.b" },
            { code: "SPEC_PARAM_INVALID", at: "params.c" },
        ])
    })

    it("refuses a reference to an unknown read or filter, only when it knows the reads", () => {
        const params = { a: { type: "enum", of: "sales.leads.owner", url: "a" } } as const
        expect(paramProblems(params, READS)).toEqual([{ code: "SPEC_PARAM_INVALID", at: "params.a" }])
        expect(paramProblems(params, undefined)).toEqual([])
    })

    it("refuses a default outside the values", () => {
        const params = {
            a: { type: "enum", of: ["x", "y"], url: "a", default: "z" },
            b: { type: "enum", of: "sales.leads.stage", url: "b", default: "lost" },
        } as const
        expect(paramProblems(params, READS).map((problem) => problem.at)).toEqual(["params.a", "params.b"])
        expect(paramProblems({ a: { type: "string", url: "a", default: "anything" } }, READS)).toEqual([])
    })

    it("refuses a URL key two params share, or the workbench holds", () => {
        const problems = paramProblems(
            { a: { type: "string", url: "k" }, b: { type: "string", url: "k" }, c: { type: "string", url: "tab" } },
            READS,
        )
        expect(problems).toEqual([
            { code: "SPEC_PARAM_INVALID", at: "params.b" },
            { code: "SPEC_PARAM_INVALID", at: "params.c" },
        ])
    })

    it("refuses a name that is a time token without its dollar sign", () => {
        const problems = paramProblems(
            {
                today: { type: "string", url: "a" },
                thisWeek: { type: "string", url: "b" },
                week: { type: "string", url: "c" },
            },
            READS,
        )
        expect(problems.map((problem) => problem.at)).toEqual(["params.today", "params.thisWeek"])
    })

    it("refuses a name a $variable cannot spell, and the installation variable", () => {
        const problems = paramProblems(
            {
                "bad-name": { type: "string", url: "a" },
                "1st": { type: "string", url: "b" },
                installationId: { type: "string", url: "c" },
            },
            READS,
        )
        expect(problems.map((problem) => problem.at)).toEqual([
            "params.bad-name",
            "params.1st",
            "params.installationId",
        ])
    })
})

/** A param source over a mutable query, recording each batch of writes. */
const sourceOf = (
    params: Readonly<Record<string, SpecParam>>,
    query: Record<string, string> = {},
): ParamSource & { readonly writes: Array<Readonly<Record<string, string | null>>> } => {
    const writes: Array<Readonly<Record<string, string | null>>> = []
    return {
        params,
        reads: READS,
        queryValue: (key) => query[key] ?? null,
        setQueryValues: (entries) => {
            writes.push(entries)
        },
        writes,
    }
}

describe("paramHandleOf value", () => {
    const params = {
        q: { type: "string", url: "q" },
        stage: STAGE,
        sort: { type: "enum", of: "sales.leads.sort", url: "sort" },
    } as const

    it("is the URL value when the param allows it", () => {
        const handle = paramHandleOf(sourceOf(params, { q: "an", stage: "won" }))
        expect(handle.value("q")).toBe("an")
        expect(handle.value("stage")).toBe("won")
    })

    it("falls back to the default, else null, when the URL value is absent, empty or not allowed", () => {
        const handle = paramHandleOf(sourceOf(params, { q: "", stage: "lost", sort: "random" }))
        expect(handle.value("q")).toBeNull()
        expect(handle.value("stage")).toBe("all")
        expect(handle.value("sort")).toBeNull()
        expect(paramHandleOf(sourceOf(params)).value("stage")).toBe("all")
    })

    it("is null for a param the spec does not declare", () => {
        expect(paramHandleOf(sourceOf(params)).value("nope")).toBeNull()
    })

    it("takes the URL value of a param whose values cannot be resolved", () => {
        const broken = { a: { type: "enum", of: "sales.nope.x", url: "a" } } as const
        expect(paramHandleOf(sourceOf(broken, { a: "v" })).value("a")).toBe("v")
    })
})

describe("paramHandleOf set", () => {
    it("writes the URL key of the param, and removes it with null", () => {
        const source = sourceOf({ q: { type: "string", url: "search" } })
        const handle = paramHandleOf(source)
        handle.set("q", "an")
        handle.set("q", null)
        expect(source.writes).toEqual([{ search: "an" }, { search: null }])
    })

    it("resets the cursor param in the same write when the spec has one", () => {
        const source = sourceOf({ q: { type: "string", url: "q" }, cursor: { type: "string", url: "cursor" } })
        const handle = paramHandleOf(source)
        handle.set("q", "an")
        handle.set("cursor", "c2")
        expect(source.writes).toEqual([{ q: "an", cursor: null }, { cursor: "c2" }])
    })

    it("writes nothing for a param the spec does not declare", () => {
        const source = sourceOf({})
        paramHandleOf(source).set("nope", "x")
        expect(source.writes).toEqual([])
    })

    it("writes several params in one step, skipping those the spec does not declare", () => {
        const source = sourceOf({ entry: { type: "string", url: "entry" }, pane: { type: "string", url: "pane" } })
        paramHandleOf(source).setMany({ entry: "e1", pane: "detail", nope: "x" })
        expect(source.writes).toEqual([{ entry: "e1", pane: "detail" }])
    })
})

describe("paramHandleOf setMany", () => {
    const params = {
        status: { type: "string", url: "status" },
        moved: { type: "string", url: "moved" },
        cursor: { type: "string", url: "cursor" },
    } as const

    it("writes several params in one step and resets the cursor in it", () => {
        const source = sourceOf(params)
        paramHandleOf(source).setMany({ status: null, moved: "$today" })
        expect(source.writes).toEqual([{ status: null, moved: "$today", cursor: null }])
    })

    it("leaves a name the spec does not declare out, and writes nothing when none is declared", () => {
        const source = sourceOf(params)
        paramHandleOf(source).setMany({ status: "needs", nope: "x" })
        paramHandleOf(source).setMany({ nope: "x" })
        expect(source.writes).toEqual([{ status: "needs", cursor: null }])
    })

    it("does not reset the cursor it is told to write", () => {
        const source = sourceOf(params)
        paramHandleOf(source).setMany({ cursor: "c2" })
        expect(source.writes).toEqual([{ cursor: "c2" }])
    })
})
