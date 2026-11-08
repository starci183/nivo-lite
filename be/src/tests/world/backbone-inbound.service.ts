import type { OptionalRunTrace } from "@modules/domain/agent-runs"
import type { AgentTurnView, AgentHandlerEnding, AgentBegin } from "@modules/domain/agent-work"
import type { InboundEvent, InboundAccepted } from "../../modules/domain/agent-inbound/agent-inbound.contracts"
import type { IntentPlan, IntentRead } from "../../modules/domain/agent-turns/agent-turns.contracts"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { In } from "typeorm"
import { AgentTurnsService, AgentTriggersService } from "@modules/domain/agent-work"
import {
    GenericWebhookIntakeService,
    GenericWebhookJobService,
    InboundDoorService,
} from "@modules/domain/agent-inbound"
import { ConnectionsService } from "@modules/domain/connections"
import { workItemsEntities } from "@modules/domain/work-items"
import { ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import type { ChatTranscriptLine } from "@modules/domain/chat-records"
import { entityEngineEntities } from "@modules/domain/entity-engine"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { jobsEntities } from "@modules/platform/jobs"
import { genericWebhookKey } from "@modules/queues/generic-webhook"
import { inboxEntities } from "@modules/platform/inbox"
import { GenericWebhookProofService, signBody } from "../../modules/domain/agent-inbound/generic-webhook-proof.service"
import { deliveryIdOf } from "../../modules/domain/agent-inbound/generic-webhook.adapter"
import { InboundWorkHandlerService } from "../../modules/domain/agent-inbound/inbound-work-handler.service"
import { WebhookDoorStepService } from "../../modules/domain/agent-inbound/webhook-door-step.service"
import { AgentGraphContractsService } from "../../modules/domain/agent-graphs/agent-graph-contracts.service"
import { IntentStepHandlersService } from "../../modules/domain/agent-turns/intent-step-handlers.service"
import { IntentTagDoorStepService } from "../../modules/domain/agent-turns/intent-tag-door-step.service"
import { IntentPipelineService } from "@modules/domain/agent-turns"
import { AgentRunTraceService } from "../../modules/domain/agent-runs/agent-run-trace.service"
import { CustomerIntentsService } from "../../modules/domain/customer-turns/customer-intents.service"
import { CustomerWorkHandlerService } from "../../modules/domain/customer-turns/customer-work-handler.service"
import { AgentTurnExecutorService } from "../../modules/domain/agent-turns/agent-turn-executor.service"
import { AccountingPerformersRegistrarService } from "../../modules/domain/accounting/accounting-performers-registrar.service"
import { INBOUND_EVENT, INBOUND_GRAPH, persistInboundScene } from "../fixtures/builders/backbone-inbound.builder"
import type { InboundIdentity, InboundSceneHolder } from "../fixtures/builders/backbone-inbound.builder"
import { lapseLease, removeDrainJobs, settleAgentWork, wakeOfFact, wakesOfFact } from "./agent-work-database.service"
import { removeAuthUsers, removeWorkspace } from "./proof-accounts.service"
import { removeStepJobs } from "./agent-runs-database.service"
import { publishLaterVersion } from "./agent-graphs-database.service"
import type { useTestWorld } from "./use-test-world"

const WorkItemEntity: (typeof workItemsEntities)[0] = workItemsEntities[0]
type WorkItemEntity = InstanceType<typeof WorkItemEntity>
const [RecordEntity, RecordLinkEntity] = entityEngineEntities
const MemberEntity: (typeof workspaceMembersEntities)[0] = workspaceMembersEntities[0]
type WorkspaceMemberEntity = InstanceType<typeof MemberEntity>
const JobOutboxEntity: (typeof jobsEntities)[1] = jobsEntities[1]
type JobOutboxEntity = InstanceType<typeof JobOutboxEntity>
const InboxEntity: (typeof inboxEntities)[0] = inboxEntities[0]
const ROWS_MAX = 20
const NO_ABORT = new AbortController().signal

type World = ReturnType<typeof useTestWorld>

/** The ids of the tenant, and the ids of the conversation and customer message the seeded scene holds (empty until it is seeded). */
const identityOf = (world: World, scene: InboundSceneHolder): InboundIdentity => ({
    workspaceId: world.id(),
    userId: world.id(),
    agentId: world.id(),
    versionId: world.id(),
    get conversationId(): string {
        return scene.current?.conversationId ?? ""
    },
    get messageId(): string {
        return scene.current?.messageId ?? ""
    },
})

const eventsOf =
    (world: World, who: InboundIdentity) =>
    (key: string, over: Partial<InboundEvent> = {}): InboundEvent => ({
        workspaceId: who.workspaceId,
        agentId: who.agentId,
        adapter: "tag",
        eventType: "tag",
        idempotencyKey: world.key(key),
        scopeKey: "agent",
        actor: { kind: "agent", id: who.agentId, role: null },
        chain: null,
        payload: { text: "Request a receipt; do not claim the payment is verified." },
        attachments: [],
        evidence: [],
        ...over,
    })

const turnsOf = (world: World, who: InboundIdentity) => {
    const tryBegin = async (event: InboundEvent): Promise<AgentBegin> => {
        const wake = await wakeOfFact(world.db.primary, who.agentId, event.adapter, event.idempotencyKey)
        return world.resolve(AgentTurnsService).begin(who.agentId, wake.scopeKey, "inbound-proof-worker")
    }
    const begin = async (event: InboundEvent): Promise<AgentTurnView> => {
        const result = await tryBegin(event)
        assert(result.result === "begun", `Inbound proof could not begin: ${result.result}`)
        return result.turn
    }

    const planOf = async (event: InboundEvent): Promise<IntentPlan | null> => {
        const found = await world
            .resolve(AgentGraphContractsService)
            .turnContractsOf(who.workspaceId, who.agentId, event.eventType, "outsider", event.adapter)
        return found === null ? null : { ...found, trigger: event.eventType, trust: "outsider", pinned: null }
    }

    return {
        begin,
        tryBegin,
        planOf,
        async settle(turn: AgentTurnView, text: string): Promise<AgentHandlerEnding> {
            const turns = world.resolve(AgentTurnsService)
            assert.equal(await turns.propose(turn, { text }), "stored")
            const ending = await world.resolve(InboundWorkHandlerService).settle(turn, { text }, NO_ABORT)
            await turns.finish(turn, { ...ending, errorCode: null, usage: null })
            return ending
        },
        replay: (turn: AgentTurnView, text: string): Promise<AgentHandlerEnding> =>
            world.resolve(InboundWorkHandlerService).settle(turn, { text }, NO_ABORT),
        async read(turn: AgentTurnView, event: InboundEvent, text: string): Promise<IntentRead> {
            const plan = await planOf(event)
            assert(plan !== null, "The persisted graph must offer the actual event contract")
            return world.resolve(IntentPipelineService).read(turn, plan, text, NO_ABORT)
        },
        async storeText(turn: AgentTurnView, event: InboundEvent, text: string): Promise<string> {
            const plan = await planOf(event)
            assert(plan !== null, "The persisted graph must offer the actual event contract")
            return world.resolve(IntentPipelineService).storeText(turn, plan, text, NO_ABORT)
        },
        publishAlternative: async (): Promise<void> => {
            const owner = await world.db.primary.findOneByOrFail(MemberEntity, {
                workspaceId: who.workspaceId,
                userId: who.userId,
            })
            await publishLaterVersion(world, {
                workspaceId: who.workspaceId,
                agentId: who.agentId,
                publishedBy: owner.id,
                number: 2,
                document: INBOUND_GRAPH,
            })
        },
        async recover(turn: AgentTurnView, event: InboundEvent): Promise<AgentTurnView> {
            await lapseLease(world.db.primary, turn.agentId, turn.scopeKey)
            return begin(event)
        },
    }
}

const runtimeOf = (world: World) => ({
    async runtimeDown(turn: AgentTurnView): Promise<AgentHandlerEnding> {
        const run = await world.resolve(AgentTurnExecutorService).run(
            turn,
            {
                module: "accounting",
                runtimeAgentId: "proof",
                threadKey: "proof",
                message: "Verify payment",
                timeoutMs: 1000,
            },
            NO_ABORT,
        )
        assert(run.kind === "blocked", "The keyless real runtime must refuse the model call")
        const ending = await world.resolve(CustomerWorkHandlerService).holdOver(turn, run.reason)
        await world.resolve(AgentTurnsService).finish(turn, { ...ending, errorCode: null, usage: null })
        return ending
    },
    holdAgain: (turn: AgentTurnView): Promise<AgentHandlerEnding> =>
        world.resolve(CustomerWorkHandlerService).holdOver(turn, "openclaw_not_configured"),
})

const readsOf = (world: World, who: InboundIdentity) => ({
    owner: (): Promise<WorkspaceMemberEntity> =>
        world.db.primary.findOneByOrFail(MemberEntity, { workspaceId: who.workspaceId, userId: who.userId }),
    async trace(event: InboundEvent): Promise<OptionalRunTrace> {
        const wake = await wakeOfFact(world.db.primary, who.agentId, event.adapter, event.idempotencyKey)
        return world.resolve(AgentRunTraceService).ofWake(who.workspaceId, wake.id)
    },
    wakes: (event: InboundEvent): Promise<number> => wakesOfFact(world.db.primary, who.agentId, event.idempotencyKey),
    items: (): Promise<Array<WorkItemEntity>> =>
        world.db.primary.find(WorkItemEntity, { where: { workspaceId: who.workspaceId }, take: ROWS_MAX }),
    async replies(): Promise<ReadonlyArray<ChatTranscriptLine>> {
        const lines = await world.resolve(ChatMessagesService).transcript(who.workspaceId, who.conversationId)
        return lines.filter((line) => line.role === "agent")
    },
    replyTo: (messageId: string): Promise<boolean> =>
        world.resolve(ChatMessagesService).replyExists(who.workspaceId, who.conversationId, messageId),
})

interface WebhookState {
    endpoint: string
    signingKey: string
    readonly deliveryIds: Set<string>
}

const cleanInbound = async (world: World, who: InboundIdentity, deliveryIds: ReadonlySet<string>): Promise<void> => {
    await world.db.primary.delete(RecordLinkEntity, { workspaceId: who.workspaceId })
    await world.db.primary.delete(RecordEntity, { workspaceId: who.workspaceId })
    await settleAgentWork(world.db.primary, who.workspaceId)
    await removeDrainJobs(world.db.primary, who.workspaceId)
    await removeStepJobs(world.db.primary, who.workspaceId)
    await world.db.primary.delete(JobOutboxEntity, {
        queue: "generic_webhook",
        dedupeKey: In([...deliveryIds].map((deliveryId) => genericWebhookKey(deliveryId))),
    })
    await world.db.primary.delete(InboxEntity, { source: "generic_webhook", deliveryId: In([...deliveryIds]) })
    await removeWorkspace(world.db.primary, who.workspaceId)
    await removeAuthUsers(world.db.primary, [who.userId])
}

const deliverWebhook = async (
    world: World,
    eventOf: ReturnType<typeof eventsOf>,
    state: WebhookState,
    key: string,
    valid: boolean,
    claims: Readonly<Record<string, unknown>>,
): Promise<InboundEvent | null> => {
    const rawBody = Buffer.from(JSON.stringify({ ...claims, id: key, type: INBOUND_EVENT, amount_vnd: 3_500_000 }))
    const signature = signBody(valid ? state.signingKey : randomBytes(32).toString("hex"), rawBody)
    const proved = await world
        .resolve(GenericWebhookProofService)
        .prove({ scope: state.endpoint, signature, rawBody, timestamp: undefined })
    if (!proved) return null
    const deliveryId = deliveryIdOf({
        connectionId: state.endpoint,
        rawBody,
        eventType: INBOUND_EVENT,
        deliveryKey: key,
    })
    state.deliveryIds.add(deliveryId)
    await world.resolve(GenericWebhookIntakeService).accept({
        endpoint: state.endpoint,
        rawBody,
        signature,
        eventType: INBOUND_EVENT,
        deliveryKey: key,
    })
    const job = await world.db.primary.findOneByOrFail(JobOutboxEntity, {
        queue: "generic_webhook",
        dedupeKey: genericWebhookKey(deliveryId),
    })
    await world.resolve(GenericWebhookJobService).run(job.payload)
    return eventOf(key, { adapter: "generic_webhook", eventType: INBOUND_EVENT, idempotencyKey: deliveryId })
}

const webhooksOf = (
    world: World,
    who: InboundIdentity,
    scene: InboundSceneHolder,
    eventOf: ReturnType<typeof eventsOf>,
) => {
    const state: WebhookState = { endpoint: "", signingKey: "", deliveryIds: new Set<string>() }
    return {
        async seed(): Promise<void> {
            state.deliveryIds.clear()
            const seeded = await persistInboundScene(
                world.db.primary,
                who,
                world.resolve(ConnectionsService),
                world.resolve(AgentTriggersService),
                {
                    conversations: world.resolve(ChatConversationsService),
                    messages: world.resolve(ChatMessagesService),
                },
                { customerId: world.id(), connectionId: world.id() },
                randomBytes(32).toString("hex"),
            )
            scene.current = seeded
            state.endpoint = seeded.endpoint
            state.signingKey = seeded.signingKey
        },
        clean: (): Promise<void> => cleanInbound(world, who, state.deliveryIds),
        /** Proves the real signature and processes the persisted inbox/outbox delivery. */
        webhook: (
            key: string,
            valid = true,
            claims: Readonly<Record<string, unknown>> = {},
        ): Promise<InboundEvent | null> => deliverWebhook(world, eventOf, state, key, valid, claims),
        receipts: (): Promise<Array<JobOutboxEntity>> =>
            world.db.primary.find(JobOutboxEntity, {
                where: { queue: "generic_webhook", dedupeKey: In([...state.deliveryIds].map((deliveryId) => genericWebhookKey(deliveryId))) },
                take: ROWS_MAX,
            }),
    }
}

type BackboneInboundOfResultShape = {
    /** compile() does not start module lifecycles: register the real capabilities used by these proofs explicitly. */
    initialize(): void
    deliver: (event: InboundEvent) => Promise<InboundAccepted>
    seed(): Promise<void>
    clean: () => Promise<void>
    /** Proves the real signature and processes the persisted inbox/outbox delivery. */
    webhook: (key: string, valid?: boolean, claims?: Readonly<Record<string, unknown>>) => Promise<InboundEvent | null>
    receipts: () => Promise<Array<JobOutboxEntity>>
    owner: () => Promise<WorkspaceMemberEntity>
    trace(event: InboundEvent): Promise<OptionalRunTrace>
    wakes: (event: InboundEvent) => Promise<number>
    items: () => Promise<Array<WorkItemEntity>>
    replies: () => Promise<ReadonlyArray<ChatTranscriptLine>>
    replyTo: (messageId: string) => Promise<boolean>
    runtimeDown(turn: AgentTurnView): Promise<AgentHandlerEnding>
    holdAgain: (turn: AgentTurnView) => Promise<AgentHandlerEnding>
    begin: (event: InboundEvent) => Promise<AgentTurnView>
    tryBegin: (event: InboundEvent) => Promise<AgentBegin>
    planOf: (event: InboundEvent) => Promise<IntentPlan | null>
    settle(turn: AgentTurnView, text: string): Promise<AgentHandlerEnding>
    replay: (turn: AgentTurnView, text: string) => Promise<AgentHandlerEnding>
    read(turn: AgentTurnView, event: InboundEvent, text: string): Promise<IntentRead>
    storeText(turn: AgentTurnView, event: InboundEvent, text: string): Promise<string>
    publishAlternative: () => Promise<void>
    recover(turn: AgentTurnView, event: InboundEvent): Promise<AgentTurnView>
    who: InboundIdentity
    eventOf: (key: string, over?: Partial<InboundEvent>) => InboundEvent
}

/** Runs real inbound and pipeline services; model answers enter as external data at IntentPipelineService.read's public boundary. */
export const backboneInboundOf = (world: World): BackboneInboundOfResultShape => {
    const scene: InboundSceneHolder = { current: null }
    const who = identityOf(world, scene)
    const eventOf = eventsOf(world, who)
    return {
        who,
        eventOf,
        ...turnsOf(world, who),
        ...runtimeOf(world),
        ...readsOf(world, who),
        ...webhooksOf(world, who, scene, eventOf),
        /** compile() does not start module lifecycles: register the real capabilities used by these proofs explicitly. */
        initialize(): void {
            world.resolve(CustomerIntentsService).onModuleInit()
            world.resolve(AccountingPerformersRegistrarService).onModuleInit()
            world.resolve(IntentStepHandlersService).onModuleInit()
            world.resolve(IntentTagDoorStepService).onModuleInit()
            world.resolve(WebhookDoorStepService).onModuleInit()
        },
        deliver: (event: InboundEvent): Promise<InboundAccepted> =>
            world.db.primary.transaction((tx) => world.resolve(InboundDoorService).accept(tx, event)),
    }
}
