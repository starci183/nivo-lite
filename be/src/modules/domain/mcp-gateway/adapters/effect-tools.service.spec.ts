import { Global, Injectable, Module } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, mock } from "@starci/jest-preset"
import { z } from "zod"
import { defineEffect } from "@nivo-lite/agent-sdk/node"
import type { EffectCall, EffectDefinition, NodeIndex, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { EntityEngineService, EntityMutationService, EntityNodePortsService } from "@modules/domain/entity-engine"
import { GraphNodeEffectsService, GraphNodeRegistryService, GraphNodesModule } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { IDS } from "@modules/platform/ids"
import { LOGGER, type Logger } from "@modules/platform/logging"
import type { NodeEffectExecutor } from "@modules/domain/graph-nodes"
import { McpGatewayError, McpGatewayErrorCode } from "../errors/mcp-gateway.error"
import type { GatewayRun, NativeAdapter, NativeCaller } from "../mcp-gateway.contracts"
import { CONVERSATION_LEADS_GATE } from "../mcp-gateway.decorators"
import { EffectToolsService } from "./effect-tools.service"

const MESSAGE_SEND = defineEffect({
    id: "nivo.lead.message.send",
    title: { key: "customerMessageSend" },
    payload: z.object({ conversationId: z.string().min(1), text: z.string().min(1) }).strict(),
    rights: [],
})
const ORDER_CREATE = defineEffect({
    id: "nivo.order.create",
    title: { key: "orderCreate" },
    payload: z.object({ leadId: z.string().min(1) }).strict(),
    rights: [],
})

const INSTALL: NodeIndex = {
    nodes: new Map(),
    effects: new Map<string, EffectDefinition>([
        [MESSAGE_SEND.id, MESSAGE_SEND],
        [ORDER_CREATE.id, ORDER_CREATE],
    ]),
    tools: new Map(),
    dataKinds: new Map(),
}

const RUN: GatewayRun = {
    turnId: "run-1",
    locale: "vi",
    origin: "customer",
    memberId: null,
    handedOffBy: "agent-0",
    leadId: null,
    stepTools: ["nivo.lead.message.send"],
}

const CALLER: NativeCaller = { agentId: "agent-1", conversationId: "conv-1", opKey: "step-1:tool:0", run: RUN }

const SENT: SubjectRef = { kind: "message", id: "m-1", facts: { channel: "zalo_oa" } }

interface Options {
    /** Whether the app runs the graph host (its registry and ledger). */
    readonly host?: boolean
    /** The executor of `nivo.lead.message.send`, or none. */
    readonly executor?: NodeEffectExecutor["execute"] | null
}

const build = async (options: Options = {}) => {
    const registry = mock<GraphNodeRegistryService>()
    const ledger = mock<GraphNodeEffectsService>()
    const execute = jest.fn<ReturnType<NodeEffectExecutor["execute"]>, Parameters<NodeEffectExecutor["execute"]>>()
    execute.mockImplementation(options.executor ?? (() => Promise.resolve(SENT)))
    registry.installed.mockReturnValue(INSTALL)
    registry.optionalExecutorOf.mockImplementation((effect) =>
        effect === MESSAGE_SEND.id && options.executor !== null ? { effect, execute } : undefined,
    )
    ledger.once.mockImplementation((_workspaceId, _effect, _call, act) => act())
    const host = options.host ?? true
    const moduleRef = await Test.createTestingModule({
        providers: [
            EffectToolsService,
            ...(host
                ? [
                      { provide: GraphNodeRegistryService, useValue: registry },
                      { provide: GraphNodeEffectsService, useValue: ledger },
                  ]
                : []),
            {
                provide: CONVERSATION_LEADS_GATE,
                useValue: { leadOf: () => Promise.resolve("lead-1") },
            },
        ],
    }).compile()
    return { service: moduleRef.get(EffectToolsService), registry, ledger, execute }
}

const adapterOf = (adapters: ReadonlyArray<NativeAdapter>, key: string): NativeAdapter => {
    const found = adapters.find((adapter) => adapter.manifest.key === key)
    if (found === undefined) throw new Error(`no adapter ${key}`)
    return found
}

describe("EffectToolsService", () => {
    it("serves one connector per effect domain, named by the effect ids", async () => {
        const { service } = await build()

        const adapters = service.adapters()

        expect(adapters.map((adapter) => adapter.manifest.key)).toEqual(["lead", "order"])
        expect(adapterOf(adapters, "lead").manifest.tools.map((spec) => spec.name)).toEqual(["message.send"])
    })

    it("serves none in an app without the graph host", async () => {
        const { service } = await build({ host: false })

        expect(service.adapters()).toEqual([])
    })

    it("runs the executor once per step key in the turn the token signed, and answers its fact", async () => {
        const { service, ledger, execute } = await build()
        const customer = adapterOf(service.adapters(), "lead")

        await expect(
            customer.invoke("ws-1", "message.send", { conversationId: "conv-1", text: "Dạ" }, CALLER),
        ).resolves.toEqual({ kind: "message", id: "m-1", facts: { channel: "zalo_oa" } })

        const call: EffectCall = { key: "step-1:tool:0", dedupeKey: null }
        expect(ledger.once).toHaveBeenCalledWith("ws-1", "nivo.lead.message.send", call, expect.any(Function), {
            args: { conversationId: "conv-1", text: "Dạ" },
        })
        expect(execute).toHaveBeenCalledWith(
            {
                turnId: "run-1",
                workspaceId: "ws-1",
                agentId: "agent-1",
                subject: null,
                conversationId: "conv-1",
                locale: "vi",
                origin: "customer",
                memberId: null,
                handedOffBy: "agent-0",
            },
            { conversationId: "conv-1", text: "Dạ" },
            call,
        )
    })

    it("refuses a call made in no graph step, before anything runs", async () => {
        const { service, execute } = await build()
        const customer = adapterOf(service.adapters(), "lead")
        const outside: NativeCaller = { agentId: "agent-1", conversationId: "conv-1" }

        await expect(
            customer.invoke("ws-1", "message.send", { conversationId: "conv-1", text: "Dạ" }, outside),
        ).resolves.toEqual({ kind: "refused", id: "no_run" })
        expect(execute).not.toHaveBeenCalled()
    })

    it("refuses a conversation other than the run's", async () => {
        const { service, execute } = await build()
        const customer = adapterOf(service.adapters(), "lead")

        await expect(
            customer.invoke("ws-1", "message.send", { conversationId: "conv-9", text: "Dạ" }, CALLER),
        ).resolves.toEqual({ kind: "refused", id: "conversation_mismatch" })
        expect(execute).not.toHaveBeenCalled()
    })

    it("refuses an effect no module performs", async () => {
        const { service } = await build({ executor: null })
        const order = adapterOf(service.adapters(), "order")

        await expect(order.invoke("ws-1", "create", { leadId: "lead-1" }, CALLER)).resolves.toEqual({
            kind: "refused",
            id: "not_served",
        })
    })

    it("answers a typed guard the executor throws as a refusal fact, and lets any other throw fail the call", async () => {
        const guard = new McpGatewayError({ code: McpGatewayErrorCode.NativeRefused, params: { reason: "held" } })
        const guarded = await build({ executor: () => Promise.reject(guard) })
        const broken = await build({ executor: () => Promise.reject(new TypeError("db down")) })
        const args = { conversationId: "conv-1", text: "Dạ" }

        await expect(
            adapterOf(guarded.service.adapters(), "lead").invoke("ws-1", "message.send", args, CALLER),
        ).resolves.toEqual({ kind: "refused", id: McpGatewayErrorCode.NativeRefused, facts: { reason: "held" } })
        await expect(
            adapterOf(broken.service.adapters(), "lead").invoke("ws-1", "message.send", args, CALLER),
        ).rejects.toThrow(TypeError)
    })

    it("refuses arguments its payload schema does not take, and a tool its domain does not have", async () => {
        const { service } = await build()
        const customer = adapterOf(service.adapters(), "lead")

        await expect(customer.invoke("ws-1", "message.send", { conversationId: "conv-1" }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
        })
        await expect(customer.invoke("ws-1", "message.ghost", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
        })
    })
})

/** The model door of the composed app: never called by these specs. */
@Injectable()
class UnusedModelDoor {}

/** The tool door of the composed app: never called by these specs. */
@Injectable()
class UnusedToolDoor {
    call(): Promise<unknown> {
        return Promise.reject(new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool: "none" } }))
    }
}

/** What the graph host reads from the app, as global providers (the app root's platform modules). */
@Global()
@Module({
    providers: [
        UnusedModelDoor,
        { provide: EntityEngineService, useValue: mock<EntityEngineService>() },
        { provide: EntityMutationService, useValue: mock<EntityMutationService>() },
        { provide: EntityNodePortsService, useValue: mock<EntityNodePortsService>({ ports: () => [] }) },
        { provide: LOGGER, useValue: mock<Logger>() },
        { provide: CLOCK, useValue: new FakeClock(new Date("2026-11-11T00:00:00.000Z")) },
        { provide: IDS, useValue: fakeIds() },
    ],
    exports: [UnusedModelDoor, EntityEngineService, EntityMutationService, EntityNodePortsService, LOGGER, CLOCK, IDS],
})
class AppPlatformModule {}

/** The gateway's side as the gateway module declares it: `EffectToolsService` is its own provider, the host comes from the app. */
@Module({ providers: [EffectToolsService], exports: [EffectToolsService] })
class GatewaySideModule {}

describe("EffectToolsService in the composed app (GraphNodesModule registered globally, as apps/api composes it)", () => {
    it("is handed the real effect ledger, so the installed effects are served as gateway tools", async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                AppPlatformModule,
                GraphNodesModule.register({
                    isGlobal: true,
                    install: { nodes: [], effects: [MESSAGE_SEND, ORDER_CREATE], tools: [], dataKinds: [] },
                    model: UnusedModelDoor,
                    tools: UnusedToolDoor,
                }),
                GatewaySideModule,
            ],
        }).compile()

        const adapters = moduleRef.get(EffectToolsService).adapters()

        expect(adapters.map((adapter) => adapter.manifest.key)).toEqual(["lead", "order"])
    })
})
