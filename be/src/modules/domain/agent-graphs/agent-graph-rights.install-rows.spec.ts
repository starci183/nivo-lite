import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { TemplateAgent, TemplateGraph } from "@nivo-lite/agent-sdk/template"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { accountKindOf } from "@modules/domain/installed-plugins/template-graph-adapter.policy"
import { bindNodeProviders, type NamedAccount } from "@modules/domain/tools"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { templateGraph } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentNodeRequestsService } from "./agent-node-requests.service"
import recorded from "./policies/node-accounts-table.json"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

/**
 * What PRODUCTION binds is the proof table (`policies/node-accounts-table.json`: graph, step key, node id, mode, providers in order).
 * nivo-frame `rights`: nothing is written at install; at RUN TIME a step's call reads its node's request from the version it is pinned
 * to (`AgentNodeRequestsService.requestOf` over the ENGINE's graph, the adapter's `@1` output a workflow version stores) and binds, per
 * provider in the node's order, the agent's one attached account of it (`bindNodeProviders`; of several, the workspace default account,
 * else none: `needs_pick`). For every graph of every installed template agent, the request answers the table's mode and providers (the
 * pseudo-account `nivo` is none), and the binding over each account shape returns them in the table's order. A step whose node lists no
 * provider has a request with its mode and no accounts (every node declares its mode: rights.md rule 1).
 *
 * Ledger (TOOLS-LEAD 2026-11-13): the old text said "a step whose node calls no tool has no request" and checked it with `callsTool` (the
 * node's LISTED tools). Decision: templates.md lists only tools that act outside (the record, brain and contact tools are every node's by
 * default) and the adapter carries `mode` on every node step, so every node has a request; the cases below read it for every step, and the
 * last one answers the steps that list a provider.
 */

/** One graph of a template agent and the engine's graph its workflow version stores. */
interface Case {
    readonly agent: TemplateAgent
    readonly graph: TemplateGraph
    readonly engineGraph: GraphSpec
}

const CASES: ReadonlyArray<Case> = INSTALLED.templateAgents().flatMap((agent) =>
    agent.graphs.map((graph): Case => ({ agent, graph, engineGraph: templateGraph(graph.key) })),
)

/** One line of the recorded table. */
interface Line {
    readonly graph: string
    readonly step: string
    readonly node: string
    readonly mode: string
    readonly providers: ReadonlyArray<string>
}

const LINES: ReadonlyArray<Line> = recorded.lines

/** The request reader over a store whose pinned version is the case's engine graph. */
const readerOf = async (one: Case): Promise<AgentNodeRequestsService> => {
    const graphs = mock<AgentGraphsService>({
        versionAt: jest.fn().mockResolvedValue({ version: 1, document: { nodes: [], flow: one.engineGraph } }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentNodeRequestsService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return moduleRef.get(AgentNodeRequestsService)
}

const stepOf = (nodeKey: string) => ({ nodeKey, versionId: "v-1", workflowId: "wf-p" })

/** `count` attached accounts of every provider, named `<provider>-<index>`, attached in the REVERSE of the given order. */
const attachedOf = (providers: ReadonlyArray<string>, count: number): ReadonlyArray<NamedAccount> =>
    [...providers]
        .reverse()
        .flatMap((provider) => Array.from({ length: count }, (_unused, index) => ({ provider, connectionId: `${provider}-${String(index)}` })))

/** An attached account of a provider no node of the table lists: never bound. */
const DECOY: NamedAccount = { provider: "decoy", connectionId: "decoy-0" }

const NO_DEFAULT = (): string | null => null

describe("what production binds at run time is the proof table", () => {
    // Ledger (TOOLS-LEAD 2026-11-13): "accounting" leaves the list (the agent is dropped); booking, content, hiring and video join it.
    it("covers the core agents and the six NIVO Web agents, an OpenAPI source among the providers", () => {
        const agents = [...new Set(CASES.map((one) => one.agent.key))]
        expect(agents).toEqual(
            expect.arrayContaining([
                "chatbot",
                "sales",
                "booking",
                "content",
                "hiring",
                "video",
                "webmail",
                "webdocs",
                "webdesk",
                "webrenew",
                "webbooks",
                "websales",
            ]),
        )
        expect(agents).not.toContain("accounting")
        // Ledger (ROAD Opus-1f, R44 re-record): the OpenAPI source is named by its pinned id `crm.nivoweb` (CRM ruling), no bare `crm`.
        expect(LINES.some((line) => line.providers.includes("crm.nivoweb"))).toBe(true)
        expect([...new Set(LINES.map((line) => line.graph))].sort()).toEqual(CASES.map((one) => one.graph.key).sort())
    })

    it.each(CASES.map((one) => [one.graph.key, one] as const))(
        "%s: the reader answers each step's mode and providers in order, and the binding returns them in that order",
        async (key, one) => {
            const reader = await readerOf(one)
            const lines = LINES.filter((line) => line.graph === key)
            expect(lines.length).toBeGreaterThan(0)
            for (const line of lines) {
                const request = await reader.requestOf("ws-1", "agent-1", stepOf(line.step))
                expect([line.step, request]).toEqual([
                    line.step,
                    {
                        mode: line.mode,
                        accounts: line.providers.map((provider) => ({ kind: accountKindOf(provider), provider, connectionId: null })),
                    },
                ])
                const providers = request?.accounts.map((account) => account.provider) ?? []
                // One account of each provider (attached in another order, beside one no node lists): the node's order.
                expect([line.step, bindNodeProviders(providers, [DECOY, ...attachedOf(providers, 1)], NO_DEFAULT)]).toEqual([
                    line.step,
                    line.providers.map((provider) => ({ provider, connectionId: `${provider}-0` })),
                ])
                // None attached: nothing binds.
                expect(bindNodeProviders(providers, [DECOY], NO_DEFAULT)).toEqual([])
                // Two of each and no default account: no guess (`needs_pick`), nothing binds.
                expect(bindNodeProviders(providers, attachedOf(providers, 2), NO_DEFAULT)).toEqual([])
                // Two of each, the workspace default account of each is the second: that one, in the node's order.
                expect(bindNodeProviders(providers, attachedOf(providers, 2), (provider) => `${provider}-1`)).toEqual(
                    line.providers.map((provider) => ({ provider, connectionId: `${provider}-1` })),
                )
            }
        },
    )

    it("answers, step by step through the reader over the engine's graphs, exactly the recorded table of the steps that list a provider", async () => {
        const answered: Array<Line> = []
        for (const one of CASES) {
            const reader = await readerOf(one)
            for (const node of one.engineGraph.nodes) {
                if (node.accounts === undefined || node.accounts.length === 0) continue
                const request = await reader.requestOf("ws-1", "agent-1", stepOf(node.key))
                if (request === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: `no request for ${one.graph.key} ${node.key}` } })
                answered.push({
                    graph: one.graph.key,
                    step: node.key,
                    node: node.step,
                    mode: request.mode,
                    providers: request.accounts.map((account) => account.provider),
                })
            }
        }
        expect(answered).toEqual(LINES.filter((line) => line.providers.length > 0))
    })
})
