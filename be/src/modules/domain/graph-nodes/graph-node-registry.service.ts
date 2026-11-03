import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap } from "@nestjs/common"
import { nodeIndexOf, nodeListProblems } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition, NodeIndex } from "@nivo-lite/agent-sdk/node"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { InjectGraphNodesOptions } from "./graph-nodes.decorators"
import { GraphNodesLogEvent } from "./graph-nodes.log-events"
import type { GraphNodesOptions } from "./graph-nodes.options"
import type { NodeDataPort, NodeEffectExecutor } from "./graph-nodes.contracts"

@Injectable()
/**
 * The installed nodes and who serves them. The app hands in the install it assembled from its node packages; each module that owns
 * a kind of record registers its data port, and each module that acts registers the executor of its effect, when it starts. The core
 * knows only these registrations: no kind, effect or node is named here.
 */
export class GraphNodeRegistryService implements OnApplicationBootstrap {
    private readonly index: NodeIndex
    private readonly ports = new Map<string, NodeDataPort>()
    private readonly executors = new Map<string, NodeEffectExecutor>()

    constructor(
        @InjectGraphNodesOptions() options: GraphNodesOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {
        this.index = nodeIndexOf(options.install)
        for (const problem of nodeListProblems(options.install)) {
            this.logger.warn(GraphNodesLogEvent.InstallProblem, { code: problem.code, at: problem.at })
        }
    }

    /** Names, once the app has started, each installed effect and data kind no module serves yet. */
    onApplicationBootstrap(): void {
        const unserved = [
            ...[...this.index.effects.keys()].filter((effect) => !this.executors.has(effect)),
            ...[...this.index.dataKinds.keys()].filter((kind) => !this.ports.has(kind)),
        ]
        for (const at of unserved) this.logger.info(GraphNodesLogEvent.Unserved, { at })
    }

    /** Registers the data port of a kind; a second port for a kind is a wiring bug. */
    addDataPort(port: NodeDataPort): void {
        if (this.ports.has(port.kind)) {
            throw new GraphNodesError({ code: GraphNodesErrorCode.PortDuplicate, params: { kind: port.kind } })
        }
        this.ports.set(port.kind, port)
    }

    /** Registers the executor of an effect; a second executor for an effect is a wiring bug. */
    addExecutor(executor: NodeEffectExecutor): void {
        if (this.executors.has(executor.effect)) {
            throw new GraphNodesError({ code: GraphNodesErrorCode.PortDuplicate, params: { kind: executor.effect } })
        }
        this.executors.set(executor.effect, executor)
    }

    /** The install by id. */
    installed(): NodeIndex {
        return this.index
    }

    /** The installed node of an id; refused when the app did not install it. */
    nodeOf(id: string): NodeDefinition {
        const node = this.index.nodes.get(id)
        if (node === undefined) throw new GraphNodesError({ code: GraphNodesErrorCode.NodeUnknown, params: { node: id } })
        return node
    }

    /** The port of a data kind; refused when no module serves it. */
    portOf(kind: string): NodeDataPort {
        const port = this.ports.get(kind)
        if (port === undefined) throw new GraphNodesError({ code: GraphNodesErrorCode.PortMissing, params: { kind } })
        return port
    }

    /** The executor of an effect; refused when no module performs it. */
    executorOf(effect: string): NodeEffectExecutor {
        const executor = this.executors.get(effect)
        if (executor === undefined) {
            throw new GraphNodesError({ code: GraphNodesErrorCode.ExecutorMissing, params: { effect } })
        }
        return executor
    }
}
