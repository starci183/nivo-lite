import { z } from "zod"
import type { ParamHandle, ReadDefinition } from "../block/block.types"
import type { PropsSchema } from "../schema/schema.types"
import type { SpecParam, SpecProblem } from "./spec.types"

/** The name of the param a spec uses to page a list: writing any other param resets it. */
export const CURSOR_PARAM = "cursor"

/** The name the route's installation variable takes; a param may not. */
const INSTALLATION_NAME = "installationId"

/** The URL query keys the workbench owns; a param may not take them. `tab` selects the view. */
const RESERVED_URL_KEYS: ReadonlyArray<string> = ["tab"]

/** A param name is what follows the `$` of a variable: letters and digits, starting with a letter. */
const PARAM_NAME = /^[a-zA-Z][a-zA-Z0-9]*$/

/** The values a read's enum variable takes (`"all"` included for a filter); undefined when the read has no such enum variable. */
export const enumValuesOf = (variables: PropsSchema, name: string): ReadonlyArray<string> | undefined => {
    const member = variables.shape[name]
    const inner = member instanceof z.ZodOptional ? member.unwrap() : member
    return inner instanceof z.ZodEnum
        ? inner.options.filter((option): option is string => typeof option === "string")
        : undefined
}

/** The values `<read id>.<variable>` names; undefined when the read is not installed or has no such enum variable. */
const referencedValues = (
    reference: string,
    reads: ReadonlyArray<ReadDefinition>,
): ReadonlyArray<string> | undefined => {
    const dot = reference.lastIndexOf(".")
    const read = reads.find((candidate) => candidate.id === reference.slice(0, dot))
    return read === undefined ? undefined : enumValuesOf(read.variables, reference.slice(dot + 1))
}

/**
 * The values a param may take: null when any string does (or when the reads that would say are not known), the listed values of
 * an `of` list, or the values of the read variable an `of` reference names; undefined for a reference that names nothing.
 */
export const allowedValuesOf = (
    param: SpecParam,
    reads: ReadonlyArray<ReadDefinition> | undefined,
): ReadonlyArray<string> | null | undefined => {
    if (param.of === undefined) return null
    if (typeof param.of !== "string") return param.of
    return reads === undefined ? null : referencedValues(param.of, reads)
}

/** Whether a param is unsound: a bad name, `of` that does not fit the type, an `of` that names nothing, or a default outside it. */
const isUnsound = (name: string, param: SpecParam, reads: ReadonlyArray<ReadDefinition> | undefined): boolean => {
    if (!PARAM_NAME.test(name) || name === INSTALLATION_NAME) return true
    if ((param.type === "enum") !== (param.of !== undefined)) return true
    const allowed = allowedValuesOf(param, reads)
    if (allowed === undefined) return true
    if (allowed === null) return false
    return allowed.length === 0 || (param.default !== undefined && !allowed.includes(param.default))
}

/** The problems of a document's params: each unsound param, and each param whose URL key another param or the workbench holds. */
export const paramProblems = (
    params: Readonly<Record<string, SpecParam>>,
    reads: ReadonlyArray<ReadDefinition> | undefined,
): ReadonlyArray<SpecProblem> => {
    const urls = new Set(RESERVED_URL_KEYS)
    const problems: Array<SpecProblem> = []
    for (const [name, param] of Object.entries(params)) {
        const taken = urls.has(param.url)
        urls.add(param.url)
        if (taken || isUnsound(name, param, reads)) problems.push({ code: "SPEC_PARAM_INVALID", at: `params.${name}` })
    }
    return problems
}

/** What a param handle reads and writes: the document's params, the reads that resolve `of` references, and the route's query. */
export interface ParamSource {
    /** The params of the drawn spec. */
    readonly params: Readonly<Record<string, SpecParam>>
    /** The installed reads. */
    readonly reads: ReadonlyArray<ReadDefinition>
    /** The value of a key of the route's query; null when absent. */
    readonly queryValue: (key: string) => string | null
    /** Sets keys of the route's query in one step, or removes a key with null. */
    readonly setQueryValues: (entries: Readonly<Record<string, string | null>>) => void
}

/**
 * The handle blocks reach the spec params by: a value is the URL value of the param's key when the param allows it, else its
 * default, else null (an empty URL value counts as absent). Writing a param writes its URL key and, in the same step, drops the
 * `cursor` param when the spec has one, so a new search, filter or sort never keeps the page of the old one.
 */
export const paramHandleOf = (source: ParamSource): ParamHandle => {
    const handle: ParamHandle = {
        value: (name) => {
            const param = source.params[name]
            if (param === undefined) return null
            const raw = source.queryValue(param.url)
            const allowed = allowedValuesOf(param, source.reads)
            const usable =
                raw !== null && raw !== "" && (allowed === null || allowed === undefined || allowed.includes(raw))
            return usable ? raw : (param.default ?? null)
        },
        set: (name, value) => handle.setMany({ [name]: value }),
        setMany: (entries) => {
            const written = Object.entries(entries).flatMap(
                ([name, value]): Array<readonly [string, string | null]> => {
                    const param = source.params[name]
                    return param === undefined ? [] : [[param.url, value]]
                },
            )
            if (written.length === 0) return
            const cursor = Object.keys(entries).includes(CURSOR_PARAM) ? undefined : source.params[CURSOR_PARAM]
            source.setQueryValues({
                ...Object.fromEntries(written),
                ...(cursor === undefined ? {} : { [cursor.url]: null }),
            })
        },
    }
    return handle
}
