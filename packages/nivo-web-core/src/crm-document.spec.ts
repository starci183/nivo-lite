import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { TOOL, crmOpsOf } from "@nivo-lite/agent-sdk/names"
import { z } from "zod"
import { CRM_NIVOWEB } from "./crm/nivoweb/api.generated"
import { NIVOWEB_CRM } from "./crm/nivoweb/template"
import { crmTools } from "./vocabulary/crm-tools"

/*
 * The CRM tools agree with the CRM's pinned document: `src/crm/nivoweb/openapi.json` is the document the OpenAPI provider pins
 * (`nivo-web-lite` `be/contracts/api/openapi.json`, sha256 below, 43 CRM operations). Every declared tool names an operation of it
 * (its generated id, `CRM_NIVOWEB`: `nivo.api.crm.nivoweb.<method>.<path>`), every argument is a parameter or a body member of that
 * operation (and every required path or query parameter is declared; headers are the provider's: the workspace header and
 * `Idempotency-Key`), and every member the declared answer names is a member the operation answers (a page: its items' members).
 */

/** The sha256 of the document as pinned (the P3b note, the file on disk). */
const PINNED_SHA256 = "c088784438cc2e406655dc8c375658b819fe885111bbc423eaf57567c2a0b92c"

/** Tools the plugin declares that no operation of the document serves yet, each with why (no adapter runs them). */
const NOT_SERVED: Readonly<Record<string, string>> = {
    [TOOL.invoiceCreate]: "the MISA port: the CRM issues invoices only once its e-invoice adapter exists",
}

/** The operation of each generated tool id, as the document writes it (`GET /v1/prices`): the one derivation of the SDK. */
const reading = ((): ReadonlyMap<string, string> => {
    const ops = crmOpsOf(JSON.parse(readFileSync(path.join(__dirname, "crm", "nivoweb", "openapi.json"), "utf8")), NIVOWEB_CRM.id)
    return new Map(ops.ok ? ops.entries.map((entry) => [entry.op, entry.at]) : [])
})()

const text = readFileSync(path.join(__dirname, "crm", "nivoweb", "openapi.json"), "utf8")

type Json = Readonly<Record<string, unknown>>

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

const DOCUMENT: Json = z.record(z.string(), z.unknown()).parse(JSON.parse(text))

/** A schema with its `$ref` followed. */
const resolved = (schema: unknown): Json => {
    if (!isObject(schema)) return {}
    const ref = schema["$ref"]
    if (typeof ref !== "string") return schema
    const target = ref
        .replace(/^#\//u, "")
        .split("/")
        .reduce<unknown>((at, step) => (isObject(at) ? at[step] : undefined), DOCUMENT)
    return resolved(target)
}

/** The property names of an object schema. */
const membersOf = (schema: unknown): ReadonlyArray<string> => {
    const properties = resolved(schema)["properties"]
    return isObject(properties) ? Object.keys(properties) : []
}

interface Operation {
    readonly mark: string | null
    readonly parameters: ReadonlyArray<{ readonly name: string; readonly required: boolean }>
    readonly body: ReadonlyArray<string>
    readonly answer: Json
}

/** Every operation of the document by `METHOD path`. */
const OPERATIONS: ReadonlyMap<string, Operation> = new Map(
    Object.entries(isObject(DOCUMENT["paths"]) ? DOCUMENT["paths"] : {}).flatMap(([route, item]) =>
        Object.entries(isObject(item) ? item : {}).flatMap(([method, operation]): ReadonlyArray<readonly [string, Operation]> => {
            if (!isObject(operation) || typeof operation["operationId"] !== "string") return []
            const parameters = (Array.isArray(operation["parameters"]) ? operation["parameters"] : [])
                .map(resolved)
                .filter((parameter) => parameter["in"] !== "header")
                .map((parameter) => ({ name: String(parameter["name"]), required: parameter["required"] === true }))
            const body = resolved(resolved(operation["requestBody"])["content"])
            const json = isObject(body["application/json"]) ? body["application/json"]["schema"] : undefined
            const responses = isObject(operation["responses"]) ? operation["responses"] : {}
            const ok = Object.entries(responses).find(([status]) => status.startsWith("2"))?.[1]
            const content = resolved(ok)["content"]
            const answer = isObject(content) && isObject(content["application/json"]) ? content["application/json"]["schema"] : {}
            const mark = typeof operation["x-nivo-tool"] === "string" ? operation["x-nivo-tool"] : null
            return [[`${method.toUpperCase()} ${route}`, { mark, parameters, body: membersOf(json), answer: resolved(answer) }]]
        }),
    ),
)

/** The members of a zod object, or none. */
const shapeOf = (schema: unknown): Readonly<Record<string, unknown>> => (schema instanceof z.ZodObject ? schema.shape : {})

/** The declared body of a tool's answer: the `data` of the provider envelope's ok option. */
const declaredData = (result: unknown): unknown => {
    const ok = result instanceof z.ZodUnion ? result.options[0] : result
    return shapeOf(ok)["data"]
}

/** One way a declaration disagrees with the document. */
const mismatchesOf = (tool: (typeof crmTools)[number]): ReadonlyArray<string> => {
    const { id } = tool
    const at = reading.get(id)
    if (NOT_SERVED[id] !== undefined) return at === undefined ? [] : [`${id}: served now, drop it from NOT_SERVED`]
    const operation = at === undefined ? undefined : OPERATIONS.get(at)
    if (operation === undefined) return [`${id}: no such operation`]
    const accepted = new Set([...operation.parameters.map((parameter) => parameter.name), ...operation.body])
    const declared = Object.keys(shapeOf(tool.args))
    const args = declared.filter((name) => !accepted.has(name)).map((name) => `${id}: argument ${name} is no parameter or body member`)
    const required = operation.parameters
        .filter((parameter) => parameter.required && !declared.includes(parameter.name))
        .map((parameter) => `${id}: required parameter ${parameter.name} is not declared`)
    const data = shapeOf(declaredData(tool.result))
    const items = data["items"]
    const page = items instanceof z.ZodArray
    const answered = page ? membersOf(resolved(resolved(operation.answer["properties"])["items"])["items"]) : membersOf(operation.answer)
    const named = Object.keys(page ? shapeOf(items.element) : data)
    const answer = named.filter((name) => !answered.includes(name)).map((name) => `${id}: answer member ${name} is not answered`)
    const pageMembers = page && !membersOf(operation.answer).includes("nextCursor") ? [`${id}: answer is no page`] : []
    return [...args, ...required, ...answer, ...pageMembers]
}

describe("the CRM tools against the CRM's pinned document", () => {
    it("reads the pinned document", () => {
        expect(createHash("sha256").update(text).digest("hex")).toBe(PINNED_SHA256)
        expect(OPERATIONS.size).toBeGreaterThanOrEqual(43)
    })

    it("names, for every tool, an operation of the document, its parameters and its answer's members", () => {
        expect(crmTools.flatMap(mismatchesOf)).toEqual([])
    })

    it("serves every operation of the generated names: each one is an operation of the document", () => {
        expect(Object.values(CRM_NIVOWEB).filter((id) => !reading.has(id))).toEqual([])
        expect([...reading.values()].filter((at) => !OPERATIONS.has(at))).toEqual([])
    })
})
