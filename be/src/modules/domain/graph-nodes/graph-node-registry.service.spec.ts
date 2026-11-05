import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { echo, emptyPing as ping, record } from "@tests/fixtures/builders/graph-node-probe.builder"
import { EntityNodePortsService } from "@modules/domain/entity-engine"
import type { EntityNodePort } from "@modules/domain/entity-engine"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { GraphNodeRegistryService } from "./graph-node-registry.service"
import { GRAPH_NODES_OPTIONS } from "./graph-nodes.decorators"
import type { NodeDataPort, NodeEffectExecutor, NodeInstall } from "./graph-nodes.contracts"

const INSTALL: NodeInstall = { nodes: [echo], effects: [ping], tools: [], dataKinds: [record] }

const build = async (engine: ReadonlyArray<EntityNodePort> = []) => {
    const logger = mock<Logger>()
    const entityPorts = mock<EntityNodePortsService>()
    entityPorts.ports.mockReturnValue(engine)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeRegistryService,
            { provide: GRAPH_NODES_OPTIONS, useValue: { install: INSTALL } },
            { provide: LOGGER, useValue: logger },
            { provide: EntityNodePortsService, useValue: entityPorts },
        ],
    }).compile()
    return { registry: moduleRef.get(GraphNodeRegistryService), logger }
}

const port: NodeDataPort = { kind: "record", read: () => Promise.resolve([]) }
const executor: NodeEffectExecutor = { effect: "core.ping", execute: () => Promise.resolve({ kind: "r", id: "1" }) }

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

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
        expect(registry.optionalExecutorOf("core.ping")).toBe(executor)
        expect(registry.optionalExecutorOf("core.ghost")).toBeUndefined()
        expect(registry.installed().effects.get("core.ping")).toBe(ping)
    })

    it("serves the data kind of every engine entity, and refuses a module that registers a port for the same kind", async () => {
        const engined: EntityNodePort = { kind: "record", read: () => Promise.resolve([]) }
        const { registry, logger } = await build([engined])
        registry.onApplicationBootstrap()

        expect(registry.portOf("record")).toBe(engined)
        expect(logger.info.mock.calls).toEqual([["graph_nodes.unserved", { at: "core.ping" }]])
        expect(thrownBy(() => registry.addDataPort(port))).toMatchObject({ code: GraphNodesErrorCode.PortDuplicate })
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

        expect(thrownBy(() => registry.addDataPort(port))).toMatchObject({ code: GraphNodesErrorCode.PortDuplicate })
        expect(thrownBy(() => registry.addExecutor(executor))).toMatchObject({
            code: GraphNodesErrorCode.PortDuplicate,
        })
        expect(thrownBy(() => registry.nodeOf("core.ghost"))).toMatchObject({ code: GraphNodesErrorCode.NodeUnknown })
        expect(thrownBy(() => registry.portOf("ghost"))).toMatchObject({ code: GraphNodesErrorCode.PortMissing })
        expect(thrownBy(() => registry.executorOf("core.ghost"))).toMatchObject({
            code: GraphNodesErrorCode.ExecutorMissing,
        })
    })
})
