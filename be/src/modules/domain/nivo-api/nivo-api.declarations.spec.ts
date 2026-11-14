import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { API, NIVO_API, NIVO_API_GRAPHQL } from "@nivo-lite/agent-sdk/names"
import { buildNivoApiCatalog, declaredOps, holdsRole, searchOps } from "./nivo-api-catalog.policy"
import { NIVO_API_TABLE } from "./nivo-api.declarations"

const CATALOG = buildNivoApiCatalog(NIVO_API_TABLE)

/** Matchers as the `unknown` a matcher slot takes. */
const anything = (): unknown => expect.anything()
const arrayLike = (items: ReadonlyArray<unknown>): unknown => expect.arrayContaining([...items])

const ALL_NAMES = Object.values(NIVO_API).flatMap((object) => Object.values(object))

/** The feature folders whose GraphQL operations are never offered outside (keys, members, workspace, billing, admin). */
const NEVER_FOLDERS = ["api-keys", "workspaces", "billing", "credits", "admin"]

const FEATURES = join(__dirname, "..", "..", "..", "features", "api")

/** Every file under a folder. */
const filesUnder = (folder: string): ReadonlyArray<string> =>
    readdirSync(folder).flatMap((entry) => {
        const path = join(folder, entry)
        return statSync(path).isDirectory() ? filesUnder(path) : [path]
    })

/** The GraphQL operation names the resolvers of a feature folder declare (`@Query(…, { name: "x" })` / `@Mutation`). */
const operationsOf = (folder: string): ReadonlyArray<string> =>
    filesUnder(join(FEATURES, folder))
        .filter((path) => path.endsWith(".resolver.ts"))
        .flatMap((path) =>
            [...readFileSync(path, "utf8").matchAll(/@(?:Query|Mutation)\([^{]*\{[^}]*?name: "([A-Za-z]+)"/gu)].map(
                (match) => match[1] ?? "",
            ),
        )

describe("the NIVO data op declarations", () => {
    it("declare every NIVO-owned API name, and nothing else (total by type, checked at run time too)", () => {
        expect(declaredOps(NIVO_API_TABLE).map((op) => op.name).sort()).toEqual([...ALL_NAMES].sort())
        expect(API.nivo).toBe(NIVO_API)
    })

    it("map each op 1:1 to the GraphQL operation NIVO_API_GRAPHQL names", () => {
        const fields = CATALOG.map((op) => `${op.graphql.kind} ${op.graphql.operation}`)
        expect(new Set(fields).size).toBe(fields.length)
        for (const op of CATALOG) expect(op.graphql).toEqual(NIVO_API_GRAPHQL[op.name])
    })

    it("generate the catalogue from the exposed declarations only, each with object JSON Schemas for its input and output", () => {
        const exposed = declaredOps(NIVO_API_TABLE).filter((op) => op.declaration.exposed)
        expect(CATALOG.map((op) => op.name)).toEqual(exposed.map((op) => op.name))
        for (const op of CATALOG) {
            expect(op.inputSchema).toMatchObject({ type: "object" })
            expect(op.outputSchema).toMatchObject({ type: "object" })
            expect(op.declaration.summary.length).toBeGreaterThan(10)
        }
    })

    it("answer a workflow's input schema as the object and as the JSON text the GraphQL type carries", () => {
        const workflowGet = CATALOG.find((op) => op.name === NIVO_API.workflow.get)

        expect(workflowGet?.outputSchema.properties).toMatchObject({
            inputSchema: anything(),
            inputSchemaJson: anything(),
        })
    })

    it("annotate every exposed op coherently: a read is never destructive, and deletes, merges and unlinks are", () => {
        for (const op of CATALOG) expect(op.declaration.readOnly && op.declaration.destructive).toBe(false)
        const destructive = CATALOG.filter((op) => op.declaration.destructive).map((op) => op.name)
        expect(destructive).toEqual(
            expect.arrayContaining([
                NIVO_API.contact.delete,
                NIVO_API.contact.merge,
                NIVO_API.contact.identityUnlink,
                NIVO_API.file.delete,
            ]),
        )
        expect(NIVO_API_TABLE[NIVO_API.contact.delete]).toMatchObject({ role: "owner" })
    })
})

describe("the ops a person's client runs beside the screens: start a workflow, list stops, record types and actions, raw account data", () => {
    it.each<[string, Readonly<Record<string, unknown>>]>([
        [NIVO_API.workflow.get, { readOnly: true, role: "manager" }],
        [NIVO_API.workflow.run, { readOnly: false, destructive: false, idempotent: true, role: "manager" }],
        [NIVO_API.stop.list, { readOnly: true, role: "manager", customerText: true }],
        [NIVO_API.stop.answer, { readOnly: false, destructive: true, idempotent: false, role: "manager" }],
        [NIVO_API.run.stepDecide, { readOnly: false, destructive: true, idempotent: false, role: "manager" }],
        [NIVO_API.record.typeList, { readOnly: true, role: "member" }],
        [NIVO_API.contact.blockList, { readOnly: true, role: "manager", customerText: true }],
        [NIVO_API.workbench.action, { readOnly: false, destructive: true, idempotent: false, role: "member" }],
        [NIVO_API.accountData.typeList, { readOnly: true, role: "manager" }],
        [NIVO_API.accountData.rowList, { readOnly: true, role: "manager", customerText: true }],
    ])("declares %s exposed with its annotations and the role its handler's guard admits", (name, shape) => {
        const op = CATALOG.find((entry) => entry.name === name)
        expect(op?.declaration).toMatchObject({ exposed: true, ...shape })
    })

    // Ruling R24 (ROAD Opus-1c): a person's start is QUEUED through the workflow-start outbox and the api's job starts the run, so the
    // answer names no wake and no run any more (they do not exist when it answers): `started` (queued, once per opKey) or `refused` with why.
    it("takes a workflow's inputs as an object and its start's answer names the status and why it was refused, no wake or run", () => {
        const op = CATALOG.find((entry) => entry.name === NIVO_API.workflow.run)
        expect(op?.inputSchema).toMatchObject({
            required: arrayLike(["installationId", "workflowId", "inputs"]),
            properties: { inputs: { type: "object" } },
        })
        expect(op?.outputSchema).toMatchObject({ properties: { status: { enum: ["started", "refused"] }, refusal: {}, issues: {} } })
        expect(op?.outputSchema).not.toHaveProperty("properties.runId")
        expect(op?.outputSchema).not.toHaveProperty("properties.wakeId")
    })

    it("takes a stop's answer as the run, its step, the action and the words, and answers how the stop door took it", () => {
        const op = CATALOG.find((entry) => entry.name === NIVO_API.stop.answer)
        expect(op?.inputSchema).toMatchObject({
            required: arrayLike(["runId", "action"]),
            properties: { runId: {}, stepKey: {}, action: { enum: ["answer", "retry", "take_over", "skip"] }, text: {} },
        })
        expect(op?.outputSchema).toMatchObject({ properties: { outcome: {}, stepKey: {} } })
        const decide = CATALOG.find((entry) => entry.name === NIVO_API.run.stepDecide)
        expect(decide?.inputSchema).toMatchObject({
            required: arrayLike(["installationId", "runId", "verdict"]),
            properties: { verdict: { enum: ["approve", "reject", "retry"] } },
        })
        expect(decide?.outputSchema).toMatchObject({ properties: { ok: {}, refusal: {} } })
    })
})

describe("the never-exposed walk", () => {
    it("declares a key, member, workspace-delete, connection-secret and platform-admin op hidden, each with why", () => {
        const hidden = declaredOps(NIVO_API_TABLE).flatMap(({ name, declaration }) =>
            declaration.exposed ? [] : [[name, declaration.never] as const],
        )
        expect(new Set(hidden.map(([, never]) => never))).toEqual(
            new Set(["secret", "members", "workspace_delete", "platform_admin", "engine"]),
        )
        for (const [name] of hidden) expect(CATALOG.some((op) => op.name === name)).toBe(false)
    })

    it("keeps off the surface the one op that needs the engine (the api app): an agent's node tools; a stop's answer and an approval's verdict are recorded from the stores and offered", () => {
        const engine = declaredOps(NIVO_API_TABLE).flatMap(({ name, declaration }) =>
            !declaration.exposed && declaration.never === "engine" ? [name] : [],
        )
        expect(engine).toEqual([NIVO_API.agent.toolList])
        for (const name of [NIVO_API.stop.answer, NIVO_API.run.stepDecide])
            expect(CATALOG.some((op) => op.name === name)).toBe(true)
        for (const name of engine) expect(CATALOG.some((op) => op.name === name)).toBe(false)
    })

    it("offers no GraphQL operation of the key, member, workspace, billing or admin features", () => {
        const never = new Set(NEVER_FOLDERS.flatMap(operationsOf))
        expect(never.size).toBeGreaterThan(10)
        expect(CATALOG.filter((op) => never.has(op.graphql.operation)).map((op) => op.name)).toEqual([])
    })

    it("offers no op whose input or output carries a secret value", () => {
        const schemas = JSON.stringify(CATALOG.map((op) => [op.inputSchema, op.outputSchema]))
        for (const member of ['"secret"', '"password"', '"apiKey"', '"keyHash"', '"token"']) {
            expect(schemas).not.toContain(member)
        }
    })
})

describe("the catalogue's discovery and roles", () => {
    it("finds ops by prefixes of the words of their names and summaries, name matches first", () => {
        const entries = CATALOG.map((op) => ({ name: op.name, summary: op.declaration.summary }))
        expect(searchOps(entries, "workflow run").map((entry) => entry.name)[0]).toBe(NIVO_API.workflow.run)
        expect(searchOps(entries, "merge").map((entry) => entry.name)[0]).toBe(NIVO_API.contact.merge)
        expect(searchOps(entries, "").length).toBe(CATALOG.length)
        expect(searchOps(entries, "zzz-nothing")).toEqual([])
    })

    it("ranks the roles member < manager < owner", () => {
        expect(holdsRole("owner", "manager")).toBe(true)
        expect(holdsRole("manager", "owner")).toBe(false)
        expect(holdsRole("member", "member")).toBe(true)
        expect(holdsRole("member", "manager")).toBe(false)
    })
})
