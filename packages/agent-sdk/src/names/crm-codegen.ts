import { isCrmOp } from "../schema/namespaced"
import { crmOpPrefixOf, crmProviderKeyOf, isCrmId } from "./crm"

/*
 * The ONE derivation of a CRM operation's name from an OpenAPI document (owner's decision 2026-11-13), shared by the engine (its pin, its
 * calls), a package's codegen (`api.generated.ts`) and the ext check: `nivo.api.crm.<crmId>.<method>.<path segments>`, the base path
 * dropped. Structural only: methods and paths, never a summary or a meaning.
 */

/** The HTTP methods read from a path item, as the document writes their members. */
export const CRM_METHODS: ReadonlyArray<string> = ["get", "post", "put", "patch", "delete"]

/** A base path: empty, or slash-led path segments without a trailing slash and without a template (`/v1`, `/api/v2`). */
const BASE_PATH = /^(\/[A-Za-z0-9._~-]+)*$/u

/** A path parameter segment: `{name}`. */
const PATH_PARAMETER = /^\{([^{}]+)\}$/u

/** A lowercase letter or digit followed by an uppercase letter: where a camelCase name is split with a dash. */
const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/gu

/** A name a TypeScript constant or an unquoted member may have. */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/u

/** A JSON object, loosely. */
type Json = Readonly<Record<string, unknown>>

const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

const recordOf = (value: unknown): Json => (isJson(value) ? value : {})

/** The origin a relative server URL is resolved against; only the path of the result is read. */
const RESOLVE_ORIGIN = "https://base.invalid"

/** A path without the slashes it ends with. */
const withoutTrailingSlashes = (path: string): string => {
    let end = path.length
    while (end > 0 && path[end - 1] === "/") end -= 1
    return path.slice(0, end)
}

/**
 * The base path of a document, dropped from its operations' names: the path of its first server (`servers[0].url`: `https://x/v1` and
 * `/v1` give `/v1`), else the base path an older NIVO Web document states (`info["x-nivo-source"].basePath`), else the root (`""`); null
 * when what it states is no base path (slash-led segments without a template).
 */
export const crmBasePathOf = (document: unknown): string | null => {
    const doc = recordOf(document)
    const servers: ReadonlyArray<unknown> = Array.isArray(doc.servers) ? doc.servers : []
    const url = recordOf(servers[0]).url
    const fromServer =
        typeof url === "string" && URL.canParse(url, RESOLVE_ORIGIN)
            ? withoutTrailingSlashes(new URL(url, RESOLVE_ORIGIN).pathname)
            : null
    const stated = recordOf(recordOf(doc.info)["x-nivo-source"]).basePath
    const basePath = fromServer ?? (typeof stated === "string" ? stated : "")
    return BASE_PATH.test(basePath) ? basePath : null
}

/** One path segment as a part of a name: a parameter by its name without braces, a camelCase name split with dashes, lower case. */
const segmentNameOf = (segment: string): string =>
    (PATH_PARAMETER.exec(segment)?.[1] ?? segment).replaceAll(CAMEL_BOUNDARY, "$1-$2").toLowerCase()

/**
 * The name of one operation (`PATCH /v1/orders/{code}/status` of `nivoweb`, base path `/v1`, gives
 * `nivo.api.crm.nivoweb.patch.orders.code.status`), or null for a path outside the base path. The name may still break the law
 * (`isCrmOp`): a segment led by a digit, an underscore in a segment.
 */
export const crmOpNameOf = (crmId: string, basePath: string, method: string, path: string): string | null => {
    if (path !== basePath && !path.startsWith(`${basePath}/`)) return null
    const segments = path
        .slice(basePath.length)
        .split("/")
        .filter((segment) => segment !== "")
        .map((segment) => segmentNameOf(segment))
    return ["nivo.api", crmProviderKeyOf(crmId), method.toLowerCase(), ...segments].join(".")
}

/** One operation of a CRM as its generated names give it. */
export interface CrmOpEntry {
    /** The member it is read by: its name below `nivo.api.crm.<crmId>.`, dots and dashes as underscores (`get_prices`). */
    readonly member: string
    /** Its ONE name. */
    readonly op: string
    /** True when a call writes (the method is not `GET`): typed `Asking`, a read `ToolSignature`. */
    readonly writes: boolean
    /** `METHOD path`, as the document writes it. */
    readonly at: string
}

/** The operations of a CRM document, or why it gives none. */
export type CrmOpsReading =
    | { readonly ok: true; readonly basePath: string; readonly entries: ReadonlyArray<CrmOpEntry> }
    | {
          readonly ok: false
          readonly problem: "crm_id_invalid" | "no_paths" | "base_path_invalid" | "member_duplicate"
          readonly at: string | null
      }

/** The order of two texts by code point. */
const byCodePoint = (a: string, b: string): number => {
    if (a === b) return 0
    return a < b ? -1 : 1
}

/**
 * Every lawful operation of a CRM's document under its base path, by member in code-point order. An operation whose name breaks the law,
 * or that shares its name with another, is left out (the engine marks it unsupported; nothing can call it). Two operations whose members
 * collide refuse the document (`member_duplicate`).
 */
export const crmOpsOf = (document: unknown, crmId: string): CrmOpsReading => {
    if (!isCrmId(crmId)) return { ok: false, problem: "crm_id_invalid", at: null }
    const paths = recordOf(document).paths
    if (typeof paths !== "object" || paths === null || Array.isArray(paths)) return { ok: false, problem: "no_paths", at: null }
    const basePath = crmBasePathOf(document)
    if (basePath === null) return { ok: false, problem: "base_path_invalid", at: null }
    const all = Object.entries(recordOf(paths)).flatMap(([path, item]) =>
        path.startsWith("/")
            ? CRM_METHODS.filter((method) => recordOf(item)[method] !== undefined).flatMap((method) => {
                  const op = crmOpNameOf(crmId, basePath, method, path)
                  return op === null ? [] : [{ op, method, path }]
              })
            : [],
    )
    const counts = new Map<string, number>()
    for (const { op } of all) counts.set(op, (counts.get(op) ?? 0) + 1)
    const prefix = crmOpPrefixOf(crmId)
    const entries = all
        .filter(({ op }) => isCrmOp(op) && counts.get(op) === 1)
        .map(({ op, method, path }) => ({
            member: op.slice(prefix.length).replaceAll(/[.-]/gu, "_"),
            op,
            writes: method !== "get",
            at: `${method.toUpperCase()} ${path}`,
        }))
    const seen = new Set<string>()
    for (const entry of entries) {
        if (seen.has(entry.member)) return { ok: false, problem: "member_duplicate", at: entry.at }
        seen.add(entry.member)
    }
    return { ok: true, basePath, entries: entries.toSorted((a, b) => byCodePoint(a.member, b.member)) }
}

/** The constant of a CRM's operation map (`CRM_NIVOWEB`): `CRM_` and its id upper-cased, a dash an underscore. */
export const crmMapNameOf = (crmId: string): string => `CRM_${crmId.toUpperCase().replaceAll("-", "_")}`

/** A member name as TypeScript writes it: bare when it is an identifier, quoted otherwise. */
const memberOf = (name: string): string => (IDENTIFIER.test(name) ? name : JSON.stringify(name))

/**
 * The text of a package's generated names file of one CRM (`src/crm/<crmId>/api.generated.ts`): the operation map (`CRM_NIVOWEB`,
 * `get_prices: "nivo.api.crm.nivoweb.get.prices"`) and its provider key (`CRM_NIVOWEB_PROVIDER`, the runtime
 * twin of the `ProviderNames` member `PROVIDER.crm("nivoweb")` is typed by), all `as const` literals, and the augmentation of the SDK's
 * names: `ToolNames` gets every operation (a read `ToolSignature`, a write `Asking`, so a node must handle its `declined`), `ApiNames`
 * every operation, `ProviderNames` the provider key. The same entries always give the same text, so `--check` compares texts.
 */
export const crmNamesTextOf = (crmId: string, basePath: string, entries: ReadonlyArray<CrmOpEntry>): string => {
    const map = crmMapNameOf(crmId)
    const key = crmProviderKeyOf(crmId)
    return [
        "// GENERATED from the OpenAPI document beside this file (crm codegen); do not edit. The CRM id is the package's provider template's.",
        `// The operations of the CRM \`${crmId}\` (base path \`${basePath}\`): \`nivo.api.crm.${crmId}.<method>.<path>\`, ONE name a node`,
        "// calls and an interface reads.",
        "",
        `/** Every operation of the CRM \`${crmId}\`, by its method and path. */`,
        `export const ${map} = {`,
        ...entries.map((entry) => `    ${memberOf(entry.member)}: ${JSON.stringify(entry.op)},`),
        "} as const",
        "",
        `/** The provider key a node lists for these operations (\`PROVIDER.crm(${JSON.stringify(crmId)})\`). */`,
        `export const ${map}_PROVIDER = ${JSON.stringify(key)} as const`,
        "",
        `declare module "@nivo-lite/agent-sdk/names" {`,
        "    interface ToolNames {",
        ...entries.map((entry) => `        ${JSON.stringify(entry.op)}: ${entry.writes ? "Asking" : "ToolSignature"}`),
        "    }",
        "    interface ApiNames {",
        ...entries.map((entry) => `        ${JSON.stringify(entry.op)}: ApiSignature`),
        "    }",
        "    interface ProviderNames {",
        `        ${JSON.stringify(key)}: true`,
        "    }",
        "}",
        "",
    ].join("\n")
}
