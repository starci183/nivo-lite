import { parse as parseYaml } from "yaml"

/**
 * Pure helpers for the Swagger / OpenAPI connector: read a spec, describe its operations, find the list of items in a response.
 * No server-only imports here: the wizard (browser) and the connector (server) share these types.
 */

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
export type AuthType = "none" | "header" | "query" | "bearer" | "basic"
export type PullEntity = "customer" | "order" | "product" | "transaction" | "other"
export const PULL_ENTITIES: ReadonlyArray<PullEntity> = ["customer", "order", "product", "transaction", "other"]
export const METHODS: ReadonlyArray<Method> = ["GET", "POST", "PUT", "PATCH", "DELETE"]

export type OpParam = { readonly name: string; readonly in: "path" | "query" | "header"; readonly required: boolean }
export type OpSuggest = { readonly itemsPath: string; readonly idField: string; readonly titleField: string }

/** One operation of the spec, in the shape the connection keeps (small: no schemas). */
export type OpDef = {
  readonly id: string
  readonly method: Method
  readonly path: string
  readonly summary: string
  readonly params: ReadonlyArray<OpParam>
  readonly hasBody: boolean
  /** Only present when read from a fresh spec; not stored. */
  readonly suggest?: OpSuggest
}

/** One operation pulled into the hub on every sync. Empty `itemsPath` means "find the first list in the response". */
export type PullConfig = {
  readonly opId: string
  readonly entity: PullEntity
  readonly itemsPath: string
  readonly idField: string
  readonly titleField: string
  /** Fixed query string for required parameters, like `status=open&limit=100`. */
  readonly fixedQuery: string
}

/** The non-secret configuration, stored as JSON under `public_meta.config`. */
export type OpenApiConfig = {
  readonly v: 1
  readonly specUrl: string
  readonly baseUrl: string
  readonly authType: AuthType
  /** Header or query parameter name of an API key. */
  readonly authName: string
  /** Only the operations that are pulled or allowed as tools. */
  readonly ops: ReadonlyArray<OpDef>
  readonly pulls: ReadonlyArray<PullConfig>
  /** Operation ids agents may call. */
  readonly tools: ReadonlyArray<string>
}

export type AuthSecret = { readonly type: AuthType; readonly name: string; readonly value: string; readonly user: string; readonly password: string }

export type ParsedSpec = { readonly title: string; readonly baseUrl: string; readonly ops: ReadonlyArray<OpDef>; readonly authHint: { readonly type: AuthType; readonly name: string } }

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === "string" ? v : "")

const MAX_OPS = 500

const resolveRef = (doc: Json, ref: string): unknown => {
  if (!ref.startsWith("#/")) return undefined
  let cur: unknown = doc
  for (const part of ref.slice(2).split("/")) {
    if (!isObj(cur)) return undefined
    cur = cur[part.replace(/~1/g, "/").replace(/~0/g, "~")]
  }
  return cur
}

const deref = (doc: Json, node: unknown, depth = 0): Json | undefined => {
  if (!isObj(node)) return undefined
  if (typeof node.$ref === "string" && depth < 8) return deref(doc, resolveRef(doc, node.$ref), depth + 1)
  return node
}

const ID_FIELDS = ["id", "_id", "uuid", "code", "sku", "key", "ID", "Id"]
const TITLE_FIELDS = ["name", "title", "full_name", "fullName", "display_name", "displayName", "label", "subject", "email", "code"]

const pickField = (keys: ReadonlyArray<string>, wanted: ReadonlyArray<string>) => wanted.find((w) => keys.includes(w)) ?? ""

/** Id and title field names out of a list of property names. */
export const suggestFields = (keys: ReadonlyArray<string>): { idField: string; titleField: string } => {
  const idField = pickField(keys, ID_FIELDS) || (keys.find((k) => /id$/i.test(k)) ?? keys[0] ?? "")
  const titleField = pickField(keys, TITLE_FIELDS.filter((t) => t !== idField)) || (keys.find((k) => k !== idField) ?? "")
  return { idField, titleField }
}

const findArraySchema = (doc: Json, schema: unknown, path: string, depth: number): { path: string; item: Json } | undefined => {
  const s = deref(doc, schema)
  if (!s) return undefined
  if (s.type === "array" || s.items) {
    const item = deref(doc, s.items)
    return item ? { path, item } : undefined
  }
  if (depth >= 2 || !isObj(s.properties)) return undefined
  for (const [k, v] of Object.entries(s.properties)) {
    const found = findArraySchema(doc, v, path ? `${path}.${k}` : k, depth + 1)
    if (found) return found
  }
  return undefined
}

const suggestFor = (doc: Json, operation: Json): OpSuggest | undefined => {
  const responses = isObj(operation.responses) ? operation.responses : {}
  const code = Object.keys(responses).find((c) => /^2\d\d$/.test(c)) ?? (responses.default ? "default" : undefined)
  const res = code ? deref(doc, responses[code]) : undefined
  if (!res) return undefined
  let schema: unknown = res.schema
  if (!schema && isObj(res.content)) {
    const media = isObj(res.content["application/json"]) ? res.content["application/json"] : Object.values(res.content).find(isObj)
    schema = isObj(media) ? media.schema : undefined
  }
  const arr = findArraySchema(doc, schema, "", 0)
  if (!arr) return undefined
  const keys = isObj(arr.item.properties) ? Object.keys(arr.item.properties) : []
  return { itemsPath: arr.path, ...suggestFields(keys) }
}

const baseUrlOf = (doc: Json, specUrl: string): string => {
  let raw = ""
  if (typeof doc.openapi === "string") {
    const server = Array.isArray(doc.servers) ? doc.servers.find(isObj) : undefined
    raw = server ? str(server.url) : "/"
    const vars = server && isObj(server.variables) ? server.variables : {}
    raw = raw.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = vars[k]
      return isObj(v) ? str(v.default) : ""
    })
  } else {
    const schemes = Array.isArray(doc.schemes) ? (doc.schemes as unknown[]).map(String) : []
    const scheme = schemes.includes("https") || schemes.length === 0 ? "https" : schemes[0]
    const basePath = str(doc.basePath)
    raw = doc.host ? `${scheme}://${str(doc.host)}${basePath}` : basePath || "/"
  }
  try {
    return (specUrl ? new URL(raw, specUrl).toString() : new URL(raw).toString()).replace(/\/+$/, "")
  } catch {
    return raw.startsWith("http") ? raw.replace(/\/+$/, "") : ""
  }
}

const authHintOf = (doc: Json): ParsedSpec["authHint"] => {
  const components = isObj(doc.components) ? doc.components : {}
  const schemes = isObj(components.securitySchemes) ? components.securitySchemes : isObj(doc.securityDefinitions) ? doc.securityDefinitions : {}
  for (const raw of Object.values(schemes)) {
    const s = deref(doc, raw)
    if (!s) continue
    const type = str(s.type).toLowerCase()
    if (type === "apikey") return { type: str(s.in) === "query" ? "query" : "header", name: str(s.name) }
    if (type === "basic" || (type === "http" && str(s.scheme).toLowerCase() === "basic")) return { type: "basic", name: "" }
    if (type === "http" || type === "oauth2" || type === "openidconnect") return { type: "bearer", name: "" }
  }
  return { type: "none", name: "" }
}

const cleanId = (s: string) => s.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80)

/** Reads a JSON or YAML spec (OpenAPI 3.x or Swagger 2.0). Throws a plain Vietnamese error when it is not one. */
export const parseSpecText = (text: string, specUrl = ""): ParsedSpec => {
  const trimmed = text.trim()
  if (!trimmed) throw new Error("Chưa có nội dung đặc tả.")
  let doc: unknown
  try {
    doc = JSON.parse(trimmed)
  } catch {
    try {
      doc = parseYaml(trimmed)
    } catch {
      throw new Error("Không đọc được đặc tả: cần JSON hoặc YAML hợp lệ.")
    }
  }
  if (!isObj(doc) || !(typeof doc.openapi === "string" ? doc.openapi.startsWith("3") : doc.swagger === "2.0")) {
    throw new Error("Đây không phải đặc tả OpenAPI 3.x hoặc Swagger 2.0.")
  }
  const paths = isObj(doc.paths) ? doc.paths : {}
  const ops: OpDef[] = []
  const used = new Set<string>()
  for (const [path, rawItem] of Object.entries(paths)) {
    const item = deref(doc, rawItem)
    if (!item || !path.startsWith("/")) continue
    const shared = Array.isArray(item.parameters) ? item.parameters : []
    for (const method of METHODS) {
      const operation = deref(doc, item[method.toLowerCase()])
      if (!operation || ops.length >= MAX_OPS) continue
      const own = Array.isArray(operation.parameters) ? operation.parameters : []
      const byKey = new Map<string, OpParam>()
      let hasBody = isObj(operation.requestBody)
      for (const raw of [...shared, ...own]) {
        const p = deref(doc, raw)
        if (!p) continue
        const where = str(p.in)
        if (where === "body") { hasBody = true; continue }
        if ((where !== "path" && where !== "query" && where !== "header") || !str(p.name)) continue
        byKey.set(`${where}:${str(p.name)}`, { name: str(p.name), in: where, required: where === "path" || p.required === true })
      }
      let id = cleanId(str(operation.operationId)) || cleanId(`${method.toLowerCase()}_${path}`)
      for (let n = 2; used.has(id); n++) id = `${id.replace(/_\d+$/, "")}_${n}`
      used.add(id)
      const text = str(operation.summary) || str(operation.description)
      const suggest = method === "GET" ? suggestFor(doc, operation) : undefined
      ops.push({ id, method, path, summary: text.replace(/\s+/g, " ").slice(0, 120), params: [...byKey.values()], hasBody, ...(suggest ? { suggest } : {}) })
    }
  }
  if (ops.length === 0) throw new Error("Đặc tả này không có API nào.")
  const info = isObj(doc.info) ? doc.info : {}
  return { title: str(info.title).slice(0, 80), baseUrl: baseUrlOf(doc, specUrl), ops, authHint: authHintOf(doc) }
}

/* ------------------------------------------------------------------ response items */

/** A value at a dotted path (`data.items`); an empty path is the value itself. */
export const getPath = (value: unknown, path: string): unknown => {
  if (!path.trim()) return value
  let cur: unknown = value
  for (const key of path.trim().split(".")) {
    if (Array.isArray(cur)) cur = cur[Number(key)]
    else if (isObj(cur)) cur = cur[key]
    else return undefined
  }
  return cur
}

/** The first array in a response (the response itself, or the first array property up to two levels down). */
export const detectItems = (body: unknown): { path: string; items: ReadonlyArray<unknown> } | undefined => {
  if (Array.isArray(body)) return { path: "", items: body }
  const walk = (node: unknown, path: string, depth: number): { path: string; items: ReadonlyArray<unknown> } | undefined => {
    if (!isObj(node)) return undefined
    for (const [k, v] of Object.entries(node)) if (Array.isArray(v)) return { path: path ? `${path}.${k}` : k, items: v }
    if (depth >= 2) return undefined
    for (const [k, v] of Object.entries(node)) {
      const found = walk(v, path ? `${path}.${k}` : k, depth + 1)
      if (found) return found
    }
    return undefined
  }
  return walk(body, "", 0)
}

/** Items of a response by the owner's path; falls back to the first array, then to the response as one item. */
export const itemsOf = (body: unknown, path: string): ReadonlyArray<unknown> => {
  const at = path.trim() ? getPath(body, path) : undefined
  if (Array.isArray(at)) return at
  const found = detectItems(body)
  if (found) return found.items
  return isObj(body) ? [body] : []
}

/** Suggested id and title fields from the first items of a real response. */
export const suggestFromItems = (items: ReadonlyArray<unknown>): { idField: string; titleField: string } => {
  const first = items.find(isObj)
  return first ? suggestFields(Object.keys(first)) : { idField: "", titleField: "" }
}

/** The text of a value for an id or title (numbers and strings only). */
export const textOf = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "")

export const opLabel = (op: Pick<OpDef, "method" | "path">) => `${op.method} ${op.path}`

/** A GET that can run on a schedule: no path parameter the sync cannot fill. */
export const isPullable = (op: OpDef) => op.method === "GET" && !op.params.some((p) => p.in === "path")
