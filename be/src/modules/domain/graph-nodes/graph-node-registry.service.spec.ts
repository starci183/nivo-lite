import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { z } from "zod"
import { defineDataKind, defineEffect, defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { GraphNodeRegistryService } from "./graph-node-registry.service"
import { GRAPH_NODES_OPTIONS } from "./graph-nodes.decorators"
import type { NodeDataPort, NodeEffectExecutor, NodeInstall } from "./graph-nodes.contracts"

const record = defineDataKind({ kind: "record", title: { key: "r" }, fields: z.object({ id: z.string() }) })
const ping = defineEffect({ id: "core.ping", title: { key: "p" }, payload: z.object({}), rights: [] })
const echo = defineNode({
    id: "core.echo",
    role: "execute",
    title: { key: "e" },
    params: z.object({}),
    input: z.object({}),
    output: z.object({}),
    rights: [],
    effects: ["core.ping", "core.ghost"],
    run: () => Promise.resolve({}),
    examples: [{ name: "e", params: {}, input: {}, output: {}, effects: [] }],
}) as unknown as NodeDefinition

const INSTALL: NodeInstall = { nodes: [echo], effects: [ping], tools: [], dataKinds: [record] }

const build = async () => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeRegistryService,
            { provide: GRAPH_NODES_OPTIONS, useValue: { install: INSTALL } },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { registry: moduleRef.get(GraphNodeRegistryService), logger }
}

const port: NodeDataPort = { kind: "record", read: () => Promise.resolve([]) }
const executor: NodeEffectExecutor = { effect: "core.ping", execute: () => Promise.resolve({ kind: "r", id: "1" }) }

describe("GraphNodeRegistryService", () => {
    it("warns of a problem of the install, and names what no module serves once the app started", async () => {
        const { registry, logger } = await build()
        expect(logger.warn).toHaveBeenCalledWith("graph_nodes.install_problem", {
            code: "NODE_EFFECT_UNKNOWN",
            at: "core.echo:core.ghost",
        })
        registry.onApplicationBootstrap()
        expect(logger.info.mock.calls).toEqual([
            ["graph_nodes.unserved", { at: "core.ping" }],
            ["graph_nodes.unserved", { at: "record" }],
        ])
    })

    it("answers the installed node, the port and the executor a module registered", async () => {
        const { registry, logger } = await build()
        registry.addDataPort(port)
        registry.addExecutor(executor)
        registry.onApplicationBootstrap()

        expect(logger.info).not.toHaveBeenCalled()
        expect(registry.nodeOf("core.echo")).toBe(echo)
        expect(registry.portOf("record")).toBe(port)
        expect(registry.executorOf("core.ping")).toBe(executor)
        expect(registry.installed().effects.get("core.ping")).toBe(ping)
    })

    it("keeps the subject resolvers in the order modules registered them", async () => {
        const { registry } = await build()
        const first = { subjectOf: () => Promise.resolve(null) }
        const second = { subjectOf: () => Promise.resolve(null) }
        registry.addSubjectResolver(first)
        registry.addSubjectResolver(second)
        expect(registry.subjectResolvers()).toEqual([first, second])
    })

    it("refuses a second port or executor, and a node, kind or effect nobody installed or serves", async () => {
        const { registry } = await build()
        registry.addDataPort(port)
        registry.addExecutor(executor)

        expect(() => registry.addDataPort(port)).toThrow(expect.objectContaining({ code: GraphNodesErrorCode.PortDuplicate }))
        expect(() => registry.addExecutor(executor)).toThrow(
            expect.objectContaining({ code: GraphNodesErrorCode.PortDuplicate }),
        )
        expect(() => registry.nodeOf("core.ghost")).toThrow(expect.objectContaining({ code: GraphNodesErrorCode.NodeUnknown }))
        expect(() => registry.portOf("ghost")).toThrow(expect.objectContaining({ code: GraphNodesErrorCode.PortMissing }))
        expect(() => registry.executorOf("core.ghost")).toThrow(
            expect.objectContaining({ code: GraphNodesErrorCode.ExecutorMissing }),
        )
    })
})
