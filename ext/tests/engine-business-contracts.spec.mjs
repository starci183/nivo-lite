// The decision of the project check `engine-business-contracts` (ext/support/engine-business-contracts-rules.mjs) on scratch trees: a map of path -> text.
import { strict as assert } from "node:assert"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { test } from "node:test"
import { ROOT } from "../support/program.mjs"
import {
    allowedProviderImports,
    aroundContract,
    contractFindings,
    deliveryFindings,
    findingLine,
    genericContracts,
    pipelineFindingLine,
    pipelineLists,
    providerFindingLine,
    providerImportFindings,
    providerModules,
    scopeFindings,
    translateFindings,
    treeOf,
} from "../support/engine-business-contracts-rules.mjs"

const SDK = "packages/agent-sdk/src"
const GENERIC = new Set(["engine.plugin-tools"])
const treeFrom = (entries) => treeOf(new Map(Object.entries(entries)))

/** An agent-sdk tree with one generic contract, one business contract and the entry that re-exports them as `@nivo-lite/agent-sdk/x`. */
const sdk = (extra = {}) => ({
    [`${SDK}/service/service.ts`]: `export const defineServiceContract = <T>(id: string) => ({ entry: "service-contract", id }) as unknown as T`,
    [`${SDK}/plugin-tools/plugin-tools.ts`]: [
        `import { defineServiceContract } from "../service/service"`,
        `export const PLUGIN_TOOLS = defineServiceContract<X>("engine.plugin-tools")`,
        `export const LEDGER_ENTRIES: C<L> = defineServiceContract<L>("engine.ledger-entries")`,
    ].join("\n"),
    [`${SDK}/plugin-tools/index.ts`]: `export * from "./plugin-tools"`,
    [`${SDK}/chat/chat.ts`]: `import { defineServiceContract as define } from "../service/service"\nexport const CHAT_A = define<Chat>("engine.customer-chat")`,
    [`${SDK}/chat/index.ts`]: `export { CHAT_A as CUSTOMER_CHAT } from "./chat"`,
    ...extra,
})
const found = (entries, generic = GENERIC) => contractFindings(treeFrom(entries), generic).findings
const where = (findings) => findings.map((finding) => `${finding.kind} ${finding.file}:${finding.line} ${finding.contract}`)
const ENGINE = "be/src/modules/domain/x/x.service.ts"

test("a generic contract referenced in the engine passes, a listed one is no declaration finding", () => {
    const tree = sdk({ [ENGINE]: `import { PLUGIN_TOOLS } from "@nivo-lite/agent-sdk/plugin-tools"\nexport const use = () => PLUGIN_TOOLS` })
    const all = found(tree, new Set(["engine.plugin-tools", "engine.ledger-entries", "engine.customer-chat"]))
    assert.deepEqual(all, [])
    assert.deepEqual(where(found(tree)), [
        `sdk-declaration ${SDK}/chat/chat.ts:2 engine.customer-chat`,
        `sdk-declaration ${SDK}/plugin-tools/plugin-tools.ts:3 engine.ledger-entries`,
    ])
})

test("a contract off the list referenced in the engine fails with file:line and the id, once per file with the later uses listed", () => {
    const tree = sdk({
        [ENGINE]: [`import { PLUGIN_TOOLS, LEDGER_ENTRIES } from "@nivo-lite/agent-sdk/plugin-tools"`, `const a = PLUGIN_TOOLS`, `const b = plugins.within(LEDGER_ENTRIES, x)`, `const c = LEDGER_ENTRIES`].join("\n"),
    })
    const engine = found(tree).filter((finding) => finding.kind === "engine-reference")
    assert.deepEqual(where(engine), [`engine-reference ${ENGINE}:1 engine.ledger-entries`])
    assert.deepEqual(engine[0].uses, [3, 4])
    assert.equal(findingLine(engine[0]), `${ENGINE}:1  references contract engine.ledger-entries (LEDGER_ENTRIES; also at line 3, 4), not on the generic list`)
})

test("an agent-sdk declaration off the list fails; a spec and a fixture of agent-sdk are not read", () => {
    const tree = sdk({
        [`${SDK}/chat/chat.spec.ts`]: `import { defineServiceContract } from "../service/service"\nexport const S = defineServiceContract<X>("engine.spec-only")`,
        [`${SDK}/installation/installation.fixture.ts`]: `import { defineServiceContract } from "../service/service"\nexport const F = defineServiceContract<X>("engine.fixture-store")`,
        [`${SDK}/tests/fixtures/x.ts`]: `import { defineServiceContract } from "../../service/service"\nexport const T = defineServiceContract<X>("engine.test-store")`,
    })
    const declarations = found(tree).filter((finding) => finding.kind === "sdk-declaration")
    assert.deepEqual(where(declarations), [`sdk-declaration ${SDK}/chat/chat.ts:2 engine.customer-chat`, `sdk-declaration ${SDK}/plugin-tools/plugin-tools.ts:3 engine.ledger-entries`])
    assert.deepEqual(declarations.map((finding) => finding.name), ["CHAT_A", "LEDGER_ENTRIES"])
})

test("a reference inside a composition root, a spec file or the engine's test support is not counted", () => {
    const text = `import { LEDGER_ENTRIES } from "@nivo-lite/agent-sdk/plugin-tools"\nexport const x = LEDGER_ENTRIES`
    const tree = sdk({
        "be/src/modules/domain/installed-plugins/installed.policy.ts": text,
        "be/src/modules/domain/x/x.service.spec.ts": text,
        "be/src/tests/fixtures/builders/installation-parts.builder.ts": text,
        "be/src/tests/world/helper.ts": text,
    })
    const result = found(tree)
    assert.deepEqual(where(result.filter((finding) => finding.kind === "engine-reference")), [])
    assert.deepEqual(where(result.filter((finding) => finding.kind === "test-support-reference")), ["test-support-reference be/src/tests/world/helper.ts:1 engine.ledger-entries"])
})

test("structural resolution: re-exports, aliases, a namespace import and an `export *` still reach the contract; a same-named local const does not", () => {
    const tree = sdk({
        "be/src/modules/domain/a/a.ts": `import { CUSTOMER_CHAT as Store } from "@nivo-lite/agent-sdk/chat"\nexport const s = Store`,
        "be/src/modules/domain/b/b.ts": `export { CUSTOMER_CHAT as ChatContract } from "@nivo-lite/agent-sdk/chat"`,
        "be/src/modules/domain/c/c.ts": `import * as sdk from "@nivo-lite/agent-sdk/plugin-tools"\nexport const l = sdk.LEDGER_ENTRIES\nexport const g = sdk.PLUGIN_TOOLS`,
        "be/src/modules/domain/d/d.ts": `export * from "@nivo-lite/agent-sdk/plugin-tools"`,
        "be/src/modules/domain/e/e.ts": `import { CUSTOMER_CHAT } from "../../../../../packages/agent-sdk/src/chat"\nexport const r = CUSTOMER_CHAT`,
        "be/src/modules/domain/f/f.ts": `const LEDGER_ENTRIES = { id: "engine.ledger-entries" }\nconst CUSTOMER_CHAT = 1\nexport const k = [LEDGER_ENTRIES, CUSTOMER_CHAT]`,
        "be/src/modules/domain/g/g.ts": `import { LEDGER_ENTRIES } from "./local"\nexport const m = LEDGER_ENTRIES`,
        "be/src/modules/domain/g/local.ts": `export const LEDGER_ENTRIES = { id: "x" }`,
    })
    const engine = found(tree).filter((finding) => finding.kind === "engine-reference")
    assert.deepEqual(where(engine), [
        "engine-reference be/src/modules/domain/a/a.ts:1 engine.customer-chat",
        "engine-reference be/src/modules/domain/b/b.ts:1 engine.customer-chat",
        "engine-reference be/src/modules/domain/c/c.ts:2 engine.ledger-entries",
        "engine-reference be/src/modules/domain/d/d.ts:1 engine.ledger-entries",
        "engine-reference be/src/modules/domain/e/e.ts:1 engine.customer-chat",
    ])
    assert.deepEqual(engine.map((finding) => finding.name), ["Store", "ChatContract", "sdk.LEDGER_ENTRIES", "LEDGER_ENTRIES", "CUSTOMER_CHAT"])
})

test("an engine file that re-exports through a carrier is read: a name imported from a be file that re-exports the contract is caught", () => {
    const tree = sdk({
        "be/src/modules/domain/x/hub.ts": `export { CUSTOMER_CHAT } from "@nivo-lite/agent-sdk/chat"`,
        "be/src/modules/domain/y/y.ts": `import { CUSTOMER_CHAT } from "../x/hub"\nexport const q = CUSTOMER_CHAT`,
    })
    const engine = found(tree).filter((finding) => finding.kind === "engine-reference")
    assert.deepEqual(where(engine), ["engine-reference be/src/modules/domain/x/hub.ts:1 engine.customer-chat", "engine-reference be/src/modules/domain/y/y.ts:1 engine.customer-chat"])
})

test("only a call of the imported defineServiceContract declares a contract: a same-named local function and a plain string do not", () => {
    const tree = sdk({
        [`${SDK}/other/other.ts`]: [`const defineServiceContract = (id: string) => id`, `export const NOT_A_CONTRACT = defineServiceContract("engine.local-fake")`, `export const WORDS = "engine.customer-chat"`].join("\n"),
    })
    assert.deepEqual(where(found(tree).filter((finding) => finding.file.endsWith("other.ts"))), [])
    // The id written as a string in the engine is a finding (the id is declared data), a string no contract declares is not.
    const engine = found(sdk({ [ENGINE]: `export const a = "engine.customer-chat"\nexport const b = "engine.nothing"` })).filter((finding) => finding.kind === "engine-id-literal")
    assert.deepEqual(where(engine), [`engine-id-literal ${ENGINE}:1 engine.customer-chat`])
})

test("an engine declaration of a contract is a finding unless its id is listed", () => {
    const decl = { "be/src/modules/domain/x/own.ts": `import { defineServiceContract } from "@nivo-lite/agent-sdk/service"\nexport const OWN = defineServiceContract<X>("engine.own")` }
    assert.deepEqual(where(found(sdk(decl)).filter((finding) => finding.kind === "engine-declaration")), ["engine-declaration be/src/modules/domain/x/own.ts:2 engine.own"])
    assert.deepEqual(found(sdk(decl), new Set(["engine.own", "engine.plugin-tools", "engine.ledger-entries", "engine.customer-chat"])), [])
})

test("a domain module exists only around a contract when every service file references it or imports a file that does", () => {
    const base = {
        "be/src/modules/domain/chat/chat.store.ts": `import { CUSTOMER_CHAT } from "@nivo-lite/agent-sdk/chat"\nexport const s = CUSTOMER_CHAT`,
        "be/src/modules/domain/chat/chat.service.ts": `import { s } from "./chat.store"\n@Injectable() export class ChatService { use() { return s } }`,
        "be/src/modules/domain/chat/chat.reader.service.ts": `import { s } from "./chat.store"\n@Injectable() export class ReaderService { use() { return s } }`,
    }
    const around = (entries) => {
        const tree = treeFrom(sdk(entries))
        const { findings } = contractFindings(tree, GENERIC)
        return aroundContract(tree, findings.filter((finding) => finding.kind === "engine-reference"))
    }
    assert.deepEqual(around(base).map((one) => [one.folder, one.contracts]), [["chat", ["engine.customer-chat"]]])
    // One service file that touches nothing of the contract: the module is more than a wrapper.
    assert.deepEqual(around({ ...base, "be/src/modules/domain/chat/other.service.ts": `@Injectable() export class OtherService {}` }), [])
})

test("provider modules are the folders whose class registers in a provider registry at boot; a folder with another onModuleInit is none", () => {
    const registryFiles = {
        "be/src/modules/domain/provider-registry/registry.ts": `export abstract class ProviderRegistryService<P> { register(port: P) {} of(k: string) {} }\n@Injectable() export class SpeechRegistryService extends ProviderRegistryService<S> {}`,
        "be/src/modules/domain/video-compose/registry.ts": `@Injectable() export class VideoComposeRegistryService { register(p: P) {} of(k: string) {} }`,
        "be/src/modules/domain/one-provider/reg.service.ts": `@Injectable() export class Reg { constructor(private readonly speech: SpeechRegistryService, private readonly impl: Impl) {} onModuleInit() { this.speech.register(this.impl) } }`,
        "be/src/modules/domain/two-provider/reg.service.ts": `@Injectable() export class Reg { constructor(private readonly registry: VideoComposeRegistryService) {} onModuleInit(): void { this.registry.register(this.impl) } }`,
        "be/src/modules/domain/not-a-provider/boot.service.ts": `@Injectable() export class Boot { constructor(private readonly other: SomethingElse) {} onModuleInit() { this.other.register(this) } }`,
        "be/src/modules/domain/no-hook/reg.service.ts": `@Injectable() export class Reg { constructor(private readonly speech: SpeechRegistryService) {} later() { this.speech.register(this.impl) } }`,
        "be/src/modules/domain/spec-only/reg.service.spec.ts": `@Injectable() export class Reg { constructor(private readonly speech: SpeechRegistryService) {} onModuleInit() { this.speech.register(this.impl) } }`,
    }
    const providers = providerModules(treeFrom(registryFiles))
    assert.deepEqual([...providers.keys()].sort(), ["one-provider", "two-provider"])
    assert.deepEqual(providers.get("one-provider"), { file: "be/src/modules/domain/one-provider/reg.service.ts", line: 1 })
})

const ALLOWED = new Map([
    ["connections", "any"],
    ["account-data", "type-only"],
])
const providerTree = (files) =>
    treeFrom({
        "be/src/modules/domain/provider-registry/registry.ts": `export abstract class ProviderRegistryService<P> { register(port: P) {} of(k: string) {} }\n@Injectable() export class SpeechRegistryService extends ProviderRegistryService<S> {}`,
        "be/src/modules/domain/p-provider/reg.service.ts": `@Injectable() export class Reg { constructor(private readonly s: SpeechRegistryService) {} onModuleInit() { this.s.register(this) } }`,
        "be/src/modules/domain/q-provider/reg.service.ts": `@Injectable() export class Reg { constructor(private readonly s: SpeechRegistryService) {} onModuleInit() { this.s.register(this) } }`,
        ...files,
    })
const providerRuns = (files) => {
    const tree = providerTree(files)
    return providerImportFindings(tree, providerModules(tree), ALLOWED).map((finding) => `${finding.file.split("/").pop()}:${finding.line} ${finding.piece} (${finding.form})`)
}

test("a provider module importing a state piece fails; an allowed piece, its own folder, another provider and platform imports pass", () => {
    const text = [
        `import { A } from "@modules/domain/connections"`,
        `import { B } from "@modules/domain/chat-records"`,
        `import { C } from "@modules/domain/q-provider"`,
        `import { D } from "@modules/platform/clock"`,
        `import { E } from "./other"`,
        `import { F } from "../contacts/contacts.service"`,
        `export { G } from "@modules/domain/customer-routes/routes"`,
        `const h = await import("@modules/domain/channels")`,
    ].join("\n")
    assert.deepEqual(providerRuns({ "be/src/modules/domain/p-provider/poll.service.ts": text }), [
        "poll.service.ts:2 chat-records (not allowed)",
        "poll.service.ts:6 contacts (not allowed)",
        "poll.service.ts:7 customer-routes (not allowed)",
        "poll.service.ts:8 channels (not allowed)",
    ])
})

test("a type-only piece may be imported as a type and not as a value; a spec of a provider and a folder that is no provider are not read", () => {
    const text = [`import type { T } from "@modules/domain/account-data"`, `import { type U } from "@modules/domain/account-data"`, `import { V } from "@modules/domain/account-data"`, `export type { W } from "@modules/domain/account-data"`].join("\n")
    assert.deepEqual(providerRuns({ "be/src/modules/domain/p-provider/types.ts": text }), ["types.ts:3 account-data (value import of a type-only piece)"])
    assert.deepEqual(
        providerRuns({
            "be/src/modules/domain/p-provider/poll.service.spec.ts": `import { B } from "@modules/domain/chat-records"`,
            "be/src/modules/domain/plain/plain.service.ts": `import { B } from "@modules/domain/chat-records"`,
        }),
        [],
    )
    assert.equal(
        providerFindingLine(providerImportFindings(providerTree({ "be/src/modules/domain/p-provider/x.ts": `import { B } from "@modules/domain/contacts"` }), new Map([["p-provider", {}]]), ALLOWED)[0]),
        "be/src/modules/domain/p-provider/x.ts:1  provider module p-provider imports contacts (not allowed)",
    )
})

test("the generic list is read from the table under its title; a missing section or a row without a reason is an error", () => {
    const md = [
        "# Layers",
        "## Generic service contracts the engine may look up",
        "| Contract id | Why generic |",
        "|---|---|",
        "| `engine.plugin-tools` | any module serves its own tools |",
        "| `engine.other` | |",
        "",
        "## Next",
        "| `engine.not-this-table` | x |",
    ].join("\n")
    const { ids, errors } = genericContracts(md)
    assert.deepEqual([...ids], ["engine.plugin-tools", "engine.other"])
    assert.deepEqual(errors, ["generic contract engine.other has no reason"])
    assert.equal(genericContracts("# Layers\n").errors.length, 1)
    const providers = allowedProviderImports(["## Allowed imports of a provider module", "| Piece | Form | Why |", "|---|---|---|", "| `connections` | `any` | x |", "| `account-data` | `type-only` | y |", "| `bad` | maybe | z |"].join("\n"))
    assert.deepEqual([...providers.allowed], [["connections", "any"], ["account-data", "type-only"]])
    assert.equal(providers.errors.length, 1)
})

test("the concepts of the lane hold both lists, and the business contracts are not on the generic one", () => {
    const concept = (name) => readFileSync(resolve(ROOT, ".starciwork", "concepts", name), "utf8")
    const generic = genericContracts(concept("layers.md"))
    assert.deepEqual(generic.errors, [])
    for (const id of ["engine.customer-chat", "engine.customer-chat-reads", "engine.ledger-entries"]) assert.equal(generic.ids.has(id), false, id)
    assert.equal(generic.ids.has("engine.plugin-tools"), true)
    const providers = allowedProviderImports(concept("providers.md"))
    assert.deepEqual(providers.errors, [])
    for (const piece of ["contacts", "customer-routes", "chat-records", "conversations", "channels", "entity-engine", "entity-engine-door", "zalo-inbox"]) assert.equal(providers.allowed.has(piece), false, piece)
    assert.equal(providers.allowed.get("account-data"), "type-only")
    assert.equal(providers.allowed.get("provider-registry"), "any")
})

// Part D: the one event pipeline (triggers concept rule 13 and its three tables).

const DECL = "be/src/modules/domain/z-provider/z-message.trigger.ts"
const SCHEMAS = new Set(["zod", "@nivo-lite/agent-sdk/names"])
const declaration = (...imports) =>
    [...imports, `export const Z = { provider: "z", name: "m", verb: TRIGGER.x, raw: z.object({}), data: z.object({}), translate: (raw) => ({ id: raw.id, data: {} }) }`].join("\n")
const translateRuns = (files) =>
    translateFindings(treeOf(new Map(Object.entries(files))), SCHEMAS).map((finding) => `${finding.file.split("/").pop()}:${finding.line} ${finding.specifier} (${finding.why})`)

test("D1: a trigger declaration imports values only from its folder and the listed entries; types are free; a plain `translate` is no declaration", () => {
    const text = declaration(
        `import { TRIGGER } from "@nivo-lite/agent-sdk/names"`,
        `import { z } from "zod"`,
        `import type { TriggerDeclaration } from "@modules/domain/provider-triggers"`,
        `import { LABELS } from "./messages/z.messages"`,
        `import { ContactsService } from "@modules/domain/contacts"`,
        `import { isRecord } from "@modules/platform/primitives"`,
        `import { q } from "@nivo-lite/agent-sdk/query"`,
        `import axios from "axios"`,
    )
    assert.deepEqual(translateRuns({ [DECL]: text, "be/src/modules/domain/z-provider/messages/z.messages.ts": "export const LABELS = {}" }), [
        "z-message.trigger.ts:5 @modules/domain/contacts (outside the provider's own folder)",
        "z-message.trigger.ts:6 @modules/platform/primitives (outside the provider's own folder)",
        "z-message.trigger.ts:7 @nivo-lite/agent-sdk/query (a value import of agent-sdk outside the listed entries (only its types))",
        "z-message.trigger.ts:8 axios (a package that is not on the list)",
    ])
    // An object with a `translate` member but no `verb` / `raw` (a client's own method) declares no trigger; a spec is not read.
    assert.deepEqual(translateRuns({ "be/src/modules/integrations/x/x.client.ts": `import axios from "axios"\nexport const c = { translate: (a) => a }` }), [])
    assert.deepEqual(translateRuns({ "be/src/modules/domain/z-provider/z-message.trigger.spec.ts": declaration(`import axios from "axios"`) }), [])
})

const WRITERS = new Set(["be/src/modules/domain/agent-work/agent-wake.service.ts#AgentWakeService", "be/src/modules/domain/agent-work/agent-tag.service.ts#AgentTagService"])
const wakeTree = (files) =>
    treeOf(
        new Map(
            Object.entries({
                "be/src/modules/domain/agent-work/agent-wake.service.ts": "export class AgentWakeService { write() {} }",
                "be/src/modules/domain/agent-work/agent-tag.service.ts": `import { AgentWakeService } from "./agent-wake.service"\nexport class AgentTagService {}`,
                "be/src/modules/domain/agent-work/agent-drain.service.ts": "export class AgentDrainService {}",
                "be/src/modules/domain/agent-work/index.ts": `export { AgentWakeService } from "./agent-wake.service"\nexport * from "./agent-tag.service"\nexport * from "./agent-drain.service"`,
                ...files,
            }),
        ),
    )

test("D2: only the delivery function and the listed callers import a wake writer, through any re-export; the writers' folder and specs are not read", () => {
    const tree = wakeTree({
        "be/src/modules/domain/provider-triggers/provider-triggers.service.ts": `import { AgentWakeService } from "@modules/domain/agent-work"`,
        "be/src/modules/domain/inbound/door.service.ts": `import { AgentWakeService as W } from "@modules/domain/agent-work"`,
        "be/src/modules/domain/leads/lead-wake.service.ts": `import { AgentTagService } from "../agent-work"`,
        "be/src/modules/domain/leads/other.service.ts": `import { AgentDrainService } from "@modules/domain/agent-work"`,
        "be/src/modules/domain/leads/lead-wake.service.spec.ts": `import { AgentTagService } from "@modules/domain/agent-work"`,
    })
    const callers = new Set(["be/src/modules/domain/provider-triggers/provider-triggers.service.ts"])
    const found = deliveryFindings(tree, WRITERS, callers)
    assert.deepEqual(
        found.map((finding) => `${finding.file}:${finding.line} ${finding.name}`),
        ["be/src/modules/domain/inbound/door.service.ts:1 W", "be/src/modules/domain/leads/lead-wake.service.ts:1 AgentTagService"],
    )
    assert.equal(pipelineFindingLine(found[0]), "be/src/modules/domain/inbound/door.service.ts:1  imports the wake writer (W) outside the one delivery function and its listed callers")
})

test("D3: the scope files declare only generic members; a `data` member list typed otherwise is the verb's own data", () => {
    const file = "packages/agent-sdk/src/graph/workflow-contract.ts"
    const text = [
        `const SCOPE: ReadonlyArray<SuppliedParam> = [{ name: "eventId", type: "string" }, { name: "data", type: "object" }]`,
        `const OLD: ReadonlyArray<SuppliedParam> = [{ name: "conversationId", type: "string" }, { name: "isStart", type: "boolean" }]`,
        `const DATA: ReadonlyArray<DataMember> = [{ name: "text", type: "string" }]`,
        `export const SOURCES = { zalo: { supplies: [{ name: "visitor", type: "string" }] }, sepay: { supplies: SCOPE } }`,
    ].join("\n")
    const found = scopeFindings(treeOf(new Map([[file, text]])), [file], new Set(["eventId", "data"]))
    assert.deepEqual(found.map((finding) => `${finding.line} ${finding.member}`), ["2 conversationId", "2 isStart", "4 visitor"])
    assert.deepEqual(scopeFindings(treeOf(new Map()), [file], new Set()).map((finding) => finding.member), ["(scope file missing)"])
})

test("D: the three tables are read from triggers.md; the lane's concept holds them and lists no chat member as generic", () => {
    const md = [
        "### Generic members of the trigger scope",
        "| Value | Kind | Why |",
        "|---|---|---|",
        "| `eventId` | member | the id |",
        "| `a.ts` | file | the scope |",
        "| `bad` | maybe | x |",
        "### Delivery callers of the wake writer",
        "| Value | Kind | Why |",
        "|---|---|---|",
        "| `w.ts#W` | writer | the door |",
        "| `d.ts` | caller | |",
        "### Schema libraries a provider trigger declaration may import",
        "| Entry | Why |",
        "|---|---|",
        "| `zod` | schemas |",
    ].join("\n")
    const lists = pipelineLists(md)
    assert.deepEqual([...lists.scope], ["eventId"])
    assert.deepEqual(lists.scopeFiles, ["a.ts"])
    assert.deepEqual([...lists.writers], ["w.ts#W"])
    assert.deepEqual([...lists.callers], ["d.ts"])
    assert.deepEqual([...lists.schema], ["zod"])
    assert.equal(lists.errors.length, 2)
    const lane = pipelineLists(readFileSync(resolve(ROOT, ".starciwork", "concepts", "triggers.md"), "utf8"))
    assert.deepEqual(lane.errors, [])
    for (const member of ["conversationId", "isStart", "visitor", "leadId", "agentId", "channel", "text", "lines"]) assert.equal(lane.scope.has(member), false, member)
    assert.equal(lane.writers.size, 2)
})
