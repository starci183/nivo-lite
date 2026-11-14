import type { ApiVerb } from "@nivo-lite/agent-sdk/names"
import { defineModule } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import type { SpecDocument, SpecNode, SpecView } from "@nivo-lite/agent-sdk/spec"
import { ACME_TICKET_GET, ACME_TICKET_LIST, ACME_TICKET_UPDATE, OTHER_THING_LIST } from "@nivo-lite/agent-sdk/testing"
import { coreBlocks } from "../blocks/core-blocks"
import { platformModule } from "./platform/declaration"
import { DATA_PAGE_WORDS, agentDeskViewOf, withAgentDesk } from "./platform/specs/agent-desk"
import type { DeskOfModule } from "./platform/specs/agent-desk"
import { openApiReadsOf, providerReadOf, workbenchSpecProblems } from "./workbench-spec-problems"
import type { ProviderReadFacts } from "./workbench-spec-problems"

declare module "@nivo-lite/agent-sdk/names" {
    interface ApiNames {
        "nivo.api.acme.get.tickets": ApiSignature
    }
}

const WORD = { vi: "x", en: "x" }

/** A provider page read and a provider record read the specs below bind. */
const READS: ReadonlyArray<ProviderReadFacts> = [
    { name: "openapi:acme.ticket.list", shape: "list", inputs: ["status", "limit", "cursor"] },
    { name: "openapi:acme.ticket.get", shape: "record", inputs: ["ticketId"] },
    { name: "openapi:acme.summary.count.get", shape: "record", inputs: [] },
]

const table = (read: string, variables: Readonly<Record<string, string>> = {}): SpecNode => ({
    id: "rows",
    block: "core.table",
    props: {
        label: WORD,
        empty: DATA_PAGE_WORDS.empty,
        idPath: "id",
        columns: [{ term: WORD, path: "subject" }],
        selectParam: "row",
    },
    bind: { rows: { read, variables } },
})

const DESK: DeskOfModule = {
    dataSets: [{ set: "tickets", label: WORD, countPath: "tickets" }],
    counts: { read: "openapi:acme.summary.count.get" },
    pages: { tickets: table("openapi:acme.ticket.list", { status: "open" }) },
}

const specOf = (views: ReadonlyArray<SpecView>): SpecDocument => ({
    schema: "nivo/workbench-spec@1",
    module: "acme",
    params: { row: { type: "string", url: "row" }, run: { type: "string", url: "run" } },
    views,
})

const agentModule = (views: ReadonlyArray<SpecView>, agent = true): ModuleDeclaration =>
    defineModule({
        key: "acme",
        namespace: "acme",
        ...(agent ? { agent: { tools: [] } } : {}),
        permissions: [],
        reads: [],
        actions: [],
        specs: [specOf(views)],
    })

const codesOf = (module: ModuleDeclaration): ReadonlyArray<string> =>
    workbenchSpecProblems(module, coreBlocks, [platformModule], READS).map(
        (entry) => `${entry.problem.code} ${entry.problem.at}`,
    )

/** True for a view of a spec: an object that carries its string id. */
const isSpecView = (value: unknown): value is SpecView =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

describe("the workbench rule", () => {
    it("accepts a module whose spec opens on the desk, with its data on a hidden data page bound to a provider read", () => {
        const spec = withAgentDesk(specOf([]), DESK)
        const views = spec.views.filter(isSpecView)
        expect(views.map((view) => [view.id, view.hidden === true])).toEqual([
            ["desk", false],
            ["data-tickets", true],
        ])
        expect(codesOf(agentModule(views))).toEqual([])
    })

    it("refuses an agent's workbench whose first view is not the desk (SPEC_DESK_MISSING), and leaves a module with no agent alone", () => {
        const queue: SpecView = { id: "queue", label: WORD, root: table("openapi:acme.ticket.list") }
        expect(codesOf(agentModule([queue, agentDeskViewOf(DESK)]))).toContain("SPEC_DESK_MISSING queue")
        expect(codesOf(agentModule([{ ...queue, id: "data-x", hidden: true }], false))).toEqual([])
    })

    it("refuses a provider table outside a data page (SPEC_PROVIDER_TABLE_IN_DESK), but lets a record read count on the desk", () => {
        const tab: SpecView = { id: "tickets", label: WORD, root: table("openapi:acme.ticket.list") }
        expect(codesOf(agentModule([agentDeskViewOf(DESK), tab]))).toEqual([
            "SPEC_PROVIDER_TABLE_IN_DESK tickets/rows.rows",
            "SPEC_DATA_PAGE_MISSING desk/desk-data.items.tickets",
        ])
    })

    it("refuses a data page drawn as a tab and a data set whose page the spec does not hold", () => {
        const page: SpecView = { id: "data-tickets", label: WORD, root: table("openapi:acme.ticket.list") }
        expect(codesOf(agentModule([agentDeskViewOf(DESK), page]))).toEqual(["SPEC_DATA_PAGE_TAB data-tickets"])
    })

    it("judges a provider binding like a module read: an unknown read, a shape against the slot, a variable the read does not take", () => {
        const pages = (root: SpecNode): ReadonlyArray<SpecView> => [
            agentDeskViewOf(DESK),
            { id: "data-tickets", label: WORD, hidden: true, root },
        ]
        expect(codesOf(agentModule(pages(table("openapi:acme.nothing.list"))))).toEqual([
            "SPEC_BINDING_UNKNOWN data-tickets/rows.rows",
        ])
        expect(codesOf(agentModule(pages(table("openapi:acme.ticket.get"))))).toEqual([
            "SPEC_BINDING_SHAPE data-tickets/rows.rows",
        ])
        expect(codesOf(agentModule(pages(table("openapi:acme.ticket.list", { owner: "me" }))))).toEqual([
            "SPEC_VAR_UNKNOWN data-tickets/rows.rows.owner",
        ])
    })

    it("tells a provider read from a module read by the colon", () => {
        expect(providerReadOf("openapi:orders.list")).toEqual({ provider: "openapi", read: "orders.list" })
        expect(providerReadOf("platform.agent-runs")).toBeNull()
    })
})

describe("the OpenAPI reads a package offers a screen", () => {
    // The fixture connector's tools come from the SDK's own test fixtures (rule NIVO-TOOLS-1: a package spec defines no tool).
    const list = ACME_TICKET_LIST
    const get = ACME_TICKET_GET
    const write = ACME_TICKET_UPDATE
    const other = OTHER_THING_LIST
    const module = (tools: ReadonlyArray<string>): ModuleDeclaration =>
        defineModule({
            key: "acme",
            namespace: "acme",
            agent: { tools },
            permissions: [],
            reads: [],
            actions: [],
            specs: [],
        })

    it("offers every reading tool declared under a namespace an open module uses, whether or not an agent holds it: a page when the answer holds items, else a record", () => {
        const tools = [list, get, write, other]
        const selected = module(["acme.ticket.get", "other.thing.list"])
        expect(openApiReadsOf(tools, [selected], ["acme"])).toEqual([
            { name: "openapi:acme.ticket.list", shape: "list", inputs: ["status", "limit"] },
            { name: "openapi:acme.ticket.get", shape: "record", inputs: ["ticketId"] },
        ])
    })

    it("names each read by the source's API verb when the caller gives the map (`<KEY>`, `<KEY>_API` of the generated names), never a tool id", () => {
        const apiOf = (tool: string): ApiVerb | null =>
            tool === "acme.ticket.list" ? "nivo.api.acme.get.tickets" : null
        expect(openApiReadsOf([list, get], [module(["acme.ticket.get"])], ["acme"], apiOf)).toEqual([
            { name: "openapi:nivo.api.acme.get.tickets", shape: "list", inputs: ["status", "limit"] },
        ])
        // @ts-expect-error a verb no ApiNames key declares is no API read
        const undeclared: (tool: string) => ApiVerb | null = () => "nivo.api.acme.get.nothing"
        expect(openApiReadsOf([list], [module(["acme.ticket.get"])], ["acme"], undeclared)).toHaveLength(1)
    })

    it("offers nothing of a connector no open module uses", () => {
        expect(openApiReadsOf([list, get], [module(["other.thing.list"])], ["acme"])).toEqual([])
    })
})
