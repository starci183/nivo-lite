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
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { coreEffects, coreNodes, TOOL } from "@nivo-lite/blocks-core"
import { seededGraphOf } from "@tests/fixtures/builders/flow-f-world.builder"
import type { SeededGraphName } from "@tests/fixtures/builders/flow-f-world.builder"

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
        expect(registry.optionalPortOf("record")).toBe(port)
        expect(registry.optionalPortOf("ghost")).toBeUndefined()
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

/*
 * Every effect a seeded graph can run has a module that performs it. The mark-paid, claim-record and claim-withdraw effects were
 * installed and used by the seeded graphs with no executor anywhere in the back end: the start-up log said `graph_nodes.unserved`
 * for days and the live runs died on GRAPH_NODES_EXECUTOR_MISSING (the paid order, the customer's "da chuyen").
 * This reads the back end's executors the way they register (a file that calls `addExecutor` and names the effect, as a literal, as
 * the `<name>Effect.id` of the core vocabulary or as its `TOOL.<name>` constant), so an effect a seeded graph needs and no module
 * serves fails here, not in front of a customer.
 */

const SOURCE_ROOT = join(__dirname, "..", "..")
const SEEDED: ReadonlyArray<SeededGraphName> = ["accounting", "chatbot", "sales"]

const sourcesUnder = (folder: string): ReadonlyArray<string> =>
    readdirSync(folder).flatMap((name) => {
        const path = join(folder, name)
        if (statSync(path).isDirectory()) return sourcesUnder(path)
        return name.endsWith(".ts") && !name.endsWith(".spec.ts") ? [path] : []
    })

/** The core effects by the name the vocabulary exports them under (`agentTagEffect` serves `nivo.agent.tag`: the prefix is not in it). */
const effectBySymbol = new Map(
    coreEffects.map((effect) => [
        `${effect.id.replace(/^nivo\./u, "").replace(/[.-](\w)/g, (_all, letter: string) => letter.toUpperCase())}Effect`,
        effect.id,
    ]),
)

/** The effects the back end registers an executor for. */
const servedEffects = (): ReadonlySet<string> => {
    const served = new Set<string>()
    for (const path of sourcesUnder(SOURCE_ROOT)) {
        const text = readFileSync(path, "utf8")
        if (!text.includes("addExecutor(") || path.includes("graph-node-registry.service")) continue
        for (const effect of coreEffects) if (text.includes(`"${effect.id}"`)) served.add(effect.id)
        for (const [symbol, id] of effectBySymbol) if (text.includes(`${symbol}.id`)) served.add(id)
        for (const [name, id] of Object.entries(TOOL)) if (new RegExp(`\\bTOOL\\.${name}\\b`).test(text)) served.add(id)
    }
    return served
}

/** Every effect a seeded graph's nodes may run, and the undo of each that has one. */
const seededEffects = (): ReadonlySet<string> => {
    const nodes = new Map<string, (typeof coreNodes)[number]>(coreNodes.map((node) => [node.id, node]))
    const compensations = new Map<string, string | undefined>(
        coreEffects.map((effect) => [effect.id, effect.compensation]),
    )
    const effects = new Set<string>()
    for (const name of SEEDED) {
        for (const node of seededGraphOf(name).nodes) {
            for (const effect of nodes.get(node.step)?.effects ?? []) {
                effects.add(effect)
                const undo = compensations.get(effect)
                if (undo !== undefined) effects.add(undo)
            }
        }
    }
    return effects
}

describe("the effects of the seeded graphs are served", () => {
    it("reads the seeded graphs and the back end's executors", () => {
        expect(seededEffects().size).toBeGreaterThan(5)
        expect(servedEffects()).toContain(TOOL.customerMessageSend)
    })

    it("has an executor for every effect a seeded graph may run, and for its undo", () => {
        const served = servedEffects()
        expect([...seededEffects()].filter((effect) => !served.has(effect)).sort()).toEqual([])
    })

    it("serves the payment effects the live Zalo order died on", () => {
        expect([...servedEffects()]).toEqual(
            expect.arrayContaining([TOOL.paymentMarkPaid, TOOL.paymentClaimRecord, TOOL.paymentClaimWithdraw]),
        )
    })
})
