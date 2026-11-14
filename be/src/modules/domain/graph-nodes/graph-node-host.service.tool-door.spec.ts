import { Test } from "@nestjs/testing"
import type { NodeHostPorts } from "@nivo-lite/agent-sdk/node"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import {
    PROBE_RUN as INPUT,
    armGraphNodeDoubles,
    probeAskOf as askOf,
    readingPort,
} from "@tests/fixtures/builders/graph-nodes.builder"
import { GraphNodeEffectsService } from "./graph-node-effects.service"
import { GraphNodeHostService } from "./graph-node-host.service"
import { GraphNodeRegistryService } from "./graph-node-registry.service"
import { GraphNodeRunTokensService } from "./graph-node-run-tokens.service"
import { GRAPH_NODE_MODEL, GRAPH_NODE_TOOL_DOOR } from "./graph-nodes.decorators"
import type {
    NodeDataPort,
    NodeModelDoor,
    NodeSubjectResolver,
    NodeToolAnswer,
    NodeToolDoor,
    NodeToolRun,
} from "./graph-nodes.contracts"

const NOW = "2026-11-04T10:00:00.000Z"

/** The host with every port bound; `port` is what the registry answers for the `record` kind. */
const build = async (port: NodeDataPort, resolvers: ReadonlyArray<NodeSubjectResolver> = []) => {
    const registry = mock<GraphNodeRegistryService>()
    const effects = mock<GraphNodeEffectsService>()
    const ai = mock<Required<NodeModelDoor>>()
    const tokens = mock<GraphNodeRunTokensService>()
    const tools = mock<NodeToolDoor>({ run: undefined })
    const executor = armGraphNodeDoubles({ registry, effects, ai, tokens, tools }, port, resolvers)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: ai },
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: tools },
        ],
    }).compile()
    return { host: moduleRef.get(GraphNodeHostService), executor, effects, ai, tokens, registry, tools }
}

/** The host where no tool door is bound. */
describe("GraphNodeHostService the tool door", () => {
    it("answers the ask, not the node's own error, when a node throws after its call was refused for a person", async () => {
        const { host, tools } = await build(readingPort())
        const ask = askOf()
        tools.call.mockRejectedValue(ask)

        await expect(host.run(INPUT)).rejects.toBe(ask)
    })

    it("hands the tool door the run token and the approval the step carries", async () => {
        const { host, tokens, tools } = await build(readingPort())
        const approval = { by: "member-1", fingerprint: "f-1" }

        await host.run({ ...INPUT, approval })

        expect(tokens.mint).toHaveBeenCalledWith(INPUT.turn)
        expect(tools.call.mock.calls[0]?.[0]).toMatchObject({ token: "token-1", approval })
    })

    it("asks a defineNode node's call for no refusals as answers, and never reads a declined decision for it", async () => {
        const { host, tools } = await build(readingPort())
        const declined = jest.fn(() => Promise.resolve(true))

        await host.run({ ...INPUT, declined })

        expect(tools.call.mock.calls[0]?.[0]).not.toHaveProperty("refusals")
        expect(declined).not.toHaveBeenCalled()
    })
})

describe("GraphNodeHostService the one runner", () => {
    it("sends the effect and the tool of a node through the door's runner, and keeps the host's own ledger and executor out", async () => {
        const { host, tools, executor, effects } = await build(readingPort())
        const runs: Array<NodeToolRun> = []
        tools.run = (call: NodeToolRun): Promise<NodeToolAnswer> => {
            runs.push(call)
            return Promise.resolve(
                call.road === "effect"
                    ? { road: "effect", subject: { kind: "record", id: "e-1" } }
                    : { road: "tool", value: { seen: true } },
            )
        }

        await expect(host.run(INPUT)).resolves.toMatchObject({ effects: [{ id: "core.ping" }] })

        expect(runs.map((call) => call.road).sort()).toEqual(["effect", "tool"])
        expect(runs.find((call) => call.road === "effect")).toMatchObject({
            token: "token-1",
            effect: "core.ping",
            payload: { n: 1 },
            approval: null,
            turn: INPUT.turn,
            attempt: { step: INPUT.key, startedAt: NOW },
        })
        expect(executor.execute).not.toHaveBeenCalled()
        expect(effects.once).not.toHaveBeenCalled()
        expect(tools.call).not.toHaveBeenCalled()
    })

    it("stops the node at an effect the runner asks a person for", async () => {
        const { host, tools } = await build(readingPort())
        const ask = askOf()
        tools.run = (): Promise<NodeToolAnswer> => Promise.reject(ask)

        await expect(host.run(INPUT)).rejects.toBe(ask)
    })
})

describe("GraphNodeHostService effect rights", () => {
    it("asks the door for the right of each effect with the run token, and runs the effect when the door has no objection", async () => {
        const { host, tools, executor } = await build(readingPort())
        tools.effectRight = jest.fn().mockResolvedValue(null)

        await host.run(INPUT)

        expect(tools.effectRight).toHaveBeenCalledWith({
            token: "token-1",
            effect: "core.ping",
            payload: { n: 1 },
            approval: null,
        })
        expect(executor.execute).toHaveBeenCalled()
    })

    it("answers the door's refusal as the effect's ordinary refusal fact, and neither runs nor ledgers the effect", async () => {
        const { host, tools, executor, effects } = await build(readingPort())
        const refusal = { kind: "refused", id: "not_attached", facts: { tool: "core.ping" } }
        tools.effectRight = jest.fn().mockResolvedValue(refusal)

        await expect(host.run(INPUT)).resolves.toMatchObject({ output: { ref: "not_attached" }, effects: [] })
        expect(executor.execute).not.toHaveBeenCalled()
        expect(effects.once).not.toHaveBeenCalled()
    })

    it("stops the node at an effect whose right waits for a person, like a tool that waits", async () => {
        const { host, tools, executor } = await build(readingPort())
        const ask = askOf()
        tools.effectRight = jest.fn().mockRejectedValue(ask)

        await expect(host.run(INPUT)).rejects.toBe(ask)
        expect(executor.execute).not.toHaveBeenCalled()
        expect(tools.call).not.toHaveBeenCalled()
    })
})

describe("GraphNodeHostService replay hook", () => {
    it("runs the node on the ports the engine's wrapper answers, handing it the host's own ports", async () => {
        const { host, executor, ai } = await build(readingPort())
        const seen: Array<string> = []
        const replay = jest.fn((ports: NodeHostPorts): NodeHostPorts => ({
            ...ports,
            execute: (effect, payload, call) => {
                seen.push(`execute:${effect.id}`)
                return ports.execute(effect, payload, call)
            },
            model: {
                ...ports.model,
                text: () => {
                    seen.push("model.text")
                    return Promise.resolve("replayed")
                },
            },
        }))

        await expect(host.run({ ...INPUT, replay })).resolves.toMatchObject({
            output: { text: "replayed", ref: "e-1" },
        })

        expect(replay).toHaveBeenCalledTimes(1)
        expect(seen).toEqual(expect.arrayContaining(["execute:core.ping", "model.text"]))
        expect(executor.execute).toHaveBeenCalledTimes(1)
        expect(ai.nodeText).not.toHaveBeenCalled()
    })

    it("a wrapper that answers a call itself keeps it from the host: no right is asked, nothing is ledgered, no executor runs", async () => {
        const { host, executor, effects, tools } = await build(readingPort())
        tools.effectRight = jest.fn().mockResolvedValue(null)
        const replay = (ports: NodeHostPorts): NodeHostPorts => ({
            ...ports,
            execute: () => Promise.resolve({ kind: "record", id: "kept" }),
        })

        await expect(host.run({ ...INPUT, replay })).resolves.toMatchObject({ output: { ref: "kept" } })

        expect(tools.effectRight).not.toHaveBeenCalled()
        expect(effects.once).not.toHaveBeenCalled()
        expect(executor.execute).not.toHaveBeenCalled()
    })

    it("runs on the host's ports as they are when no wrapper is given", async () => {
        const { host, executor } = await build(readingPort())

        await expect(host.run(INPUT)).resolves.toMatchObject({ output: { ref: "e-1" } })
        expect(executor.execute).toHaveBeenCalledTimes(1)
    })
})

describe("GraphNodeHostService the replay of an approved call (nivo-frame rights 11d)", () => {
    it("runs a call asking again for a fingerprint a person approved in this step once more, carrying that approval", async () => {
        const { host, tools } = await build(readingPort())
        const approval = { by: "member-owner", fingerprint: "f" }
        const approved = jest.fn(() => Promise.resolve(approval))
        tools.call.mockRejectedValueOnce(askOf())

        await expect(host.run({ ...INPUT, approved })).resolves.toBeDefined()

        expect(approved).toHaveBeenCalledWith("f")
        expect(tools.call).toHaveBeenCalledTimes(2)
        expect(tools.call.mock.calls[1]?.[0]).toMatchObject({ approval })
    })

    it("keeps the ask (a new card) when nobody approved that fingerprint, or the approval is of another call", async () => {
        for (const given of [null, { by: "member-owner", fingerprint: "another" }]) {
            const { host, tools } = await build(readingPort())
            const ask = askOf()
            tools.call.mockRejectedValue(ask)

            await expect(host.run({ ...INPUT, approved: () => Promise.resolve(given) })).rejects.toBe(ask)
            expect(tools.call).toHaveBeenCalledTimes(1)
        }
    })

    it("asks once more at most: an approved replay that still asks keeps that ask", async () => {
        const { host, tools } = await build(readingPort())
        const ask = askOf()
        tools.call.mockRejectedValue(ask)

        await expect(host.run({ ...INPUT, approved: () => Promise.resolve({ by: "m", fingerprint: "f" }) })).rejects.toBe(ask)
        expect(tools.call).toHaveBeenCalledTimes(2)
    })
})
