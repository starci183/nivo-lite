import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap } from "@nestjs/common"
import { nodeIndexOf, nodeListProblems } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition, NodeIndex, NodeInstall } from "@nivo-lite/agent-sdk/node"
import { EntityNodePortsService } from "@modules/domain/entity-engine"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { InjectGraphNodesOptions } from "./graph-nodes.decorators"
import { GraphNodesLogEvent } from "./graph-nodes.log-events"
import type { GraphNodesOptions } from "./graph-nodes.options"
import type {
    NodeDataPort,
    NodeEffectExecutor,
    NodeSubjectResolver,
    OptionalNodeEffectExecutor,
} from "./graph-nodes.contracts"

@Injectable()
/**
 * The installed nodes and who serves them. The app hands in the install it assembled from its node packages; the entity engine serves
 * the data kind of every entity it declares, each module that still owns a kind of record outside the engine registers its data port,
 * and each module that acts registers the executor of its effect, when it starts. The core knows only these registrations: no kind,
 * effect or node is named here.
 */
export class GraphNodeRegistryService implements OnApplicationBootstrap {
    private readonly index: NodeIndex
    private readonly words: NodeInstall["words"]
    private readonly ports = new Map<string, NodeDataPort>()
    private readonly executors = new Map<string, NodeEffectExecutor>()
    private readonly resolvers: Array<NodeSubjectResolver> = []

    constructor(
        @InjectGraphNodesOptions() options: GraphNodesOptions,
        @InjectLogger() private readonly logger: Logger,
        entityPorts: EntityNodePortsService,
    ) {
        this.index = nodeIndexOf(options.install)
        this.words = options.install.words
        for (const port of entityPorts.ports()) this.addDataPort(port)
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

    /** Registers a resolver of the subject of a turn whose trigger named none. */
    addSubjectResolver(resolver: NodeSubjectResolver): void {
        this.resolvers.push(resolver)
    }

    /** The resolvers of a turn's subject, in the order they were registered. */
    subjectResolvers(): ReadonlyArray<NodeSubjectResolver> {
        return this.resolvers
    }

    /** The words of a text key of the install, as a model reads them; undefined for a key the install has no words for. */
    wordsOf(key: string): string | undefined {
        return this.words?.(key)
    }

    /** The install by id. */
    installed(): NodeIndex {
        return this.index
    }

    /** The installed node of an id; refused when the app did not install it. */
    nodeOf(id: string): NodeDefinition {
        const node = this.index.nodes.get(id)
        if (node === undefined)
            throw new GraphNodesError({ code: GraphNodesErrorCode.NodeUnknown, params: { node: id } })
        return node
    }

    /** The port of a data kind; refused when no module serves it. */
    portOf(kind: string): NodeDataPort {
        const port = this.ports.get(kind)
        if (port === undefined) throw new GraphNodesError({ code: GraphNodesErrorCode.PortMissing, params: { kind } })
        return port
    }

    /** The port of a data kind, or undefined when no module serves it. */
    optionalPortOf(kind: string): NodeDataPort | undefined {
        return this.ports.get(kind)
    }

    /** The executor of an effect, or undefined when no module performs it. */
    optionalExecutorOf(effect: string): OptionalNodeEffectExecutor {
        return this.executors.get(effect)
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
