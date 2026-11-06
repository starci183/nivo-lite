import assert from "node:assert/strict"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import type { DoorApi, DoorCallResult } from "@nivo-lite/agent-sdk/mutation"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { eachInOrder } from "@modules/platform/primitives"
import { ChatMessageProposeExecutorService } from "@modules/domain/chat-node-ports"
import { EntityEngineService, EntityPortsService, ModuleJobRunnerService } from "@modules/domain/entity-engine"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import type { SceneWorkspace } from "../../fixtures/builders/accounting-scene.builder"
import { chatApproveProofModules } from "../../world/chat-approve-proof.module"
import { currentRole } from "../../world/backend-role-sandbox.service"
import { useTestWorld } from "../../world/use-test-world"
import { backendSandbox } from "../../world/workbench-door-proof.module"
import { useDoorProof } from "../../world/workbench-door-proof.service"

jest.setTimeout(240_000)

const world = useTestWorld({ modules: chatApproveProofModules(), sandbox: backendSandbox })
const proof = useDoorProof(world)

const DELIVER = "chatbot.deliver-reply"
const ANSWER = "Shop opens at 8."
const ASKED = "When do you open?"

/** One call the job made to the door. */
interface DoorCall {
    readonly tool: string
    readonly input: Readonly<Record<string, JsonValue>>
    readonly effectKey: string
}

/** What the door answers next, and what it was asked. */
interface DoorState {
    answer: DoorCallResult
    calls: Array<DoorCall>
}

const door: DoorState = { answer: { ok: true, output: null }, calls: [] }

interface Scene extends SceneWorkspace {
    readonly entities: EntitiesApi
    readonly conversationId: string
}

beforeAll(() => {
    world.resolve(ModuleJobRunnerService).bindDoor({
        doorApi: (binding): DoorApi => ({
            call: (tool, input) => {
                door.calls.push({ tool, input, effectKey: binding.effectKey("send") })
                return Promise.resolve(door.answer)
            },
        }),
    })
})

beforeEach(() => {
    door.answer = { ok: true, output: null }
    door.calls = []
})

const openScene = async (): Promise<Scene> => {
    const workspace: SceneWorkspace = { workspaceId: world.id(), userId: world.id() }
    await proof.persistWorkspace(workspace)
    const engine = world.resolve(EntityEngineService)
    const entities = world
        .resolve(EntityPortsService)
        .entitiesApi((use) => engine.scoped(workspace.workspaceId, use), "action")
    const made = await entities.insert("chat.conversation", {
        name: "Lan",
        channel: "website",
        lastText: ASKED,
        lastRole: "user",
        status: "needs",
    })
    assert(made.ok, "The scene conversation must be stored")
    return { ...workspace, entities, conversationId: made.row.id }
}

/** The AI drafts a reply, as the node `chatbot.draft-reply` does through its effect. */
const propose = (scene: Scene, text: string) => {
    const turn: NodeTurn = {
        turnId: world.id(),
        workspaceId: scene.workspaceId,
        agentId: world.id(),
        subject: null,
        conversationId: scene.conversationId,
        locale: "vi",
    }
    return world
        .resolve(ChatMessageProposeExecutorService)
        .proposeReply(turn, { conversationId: scene.conversationId, text, asked: ASKED })
}

/** Runs the delivery jobs the outbox holds, as the module-jobs processor would. */
const runDeliveries = async (scene: Scene): Promise<void> => {
    const runner = world.resolve(ModuleJobRunnerService)
    const due = (await proof.deliveries(scene.workspaceId)).filter((delivery) => delivery.job === DELIVER)
    await eachInOrder(due, (delivery) =>
        runner.run({
            jobId: delivery.id,
            kind: DELIVER,
            fencingToken: 1,
            currentStep: null,
            payload: delivery.payload,
        }),
    )
}

const lineOf = async (scene: Scene, id: string): Promise<Readonly<Record<string, unknown>> | null> =>
    (await scene.entities.get("chat.message", id))?.data ?? null

const queuedOf = async (scene: Scene) =>
    (await proof.deliveries(scene.workspaceId)).filter((delivery) => delivery.job === DELIVER)

describe("a proposed reply is approved, sent once and recorded, as the back-end role", () => {
    it("runs on a connection that is the back-end role, so the policies are the deployed ones", async () => {
        expect(await currentRole(world.db.primary)).toBe("app_be")
    })

    it("keeps one proposed line per conversation: a new draft replaces the words of the one that waits", async () => {
        const scene = await openScene()
        const first = await propose(scene, "Draft one")
        const second = await propose(scene, ANSWER)
        expect(second).toEqual(first)
        expect(await proof.read(scene, "chatbot.proposals", { threadId: scene.conversationId })).toMatchObject({
            id: first.id,
            text: ANSWER,
            asked: ASKED,
        })
        expect(await lineOf(scene, first.id)).toMatchObject({ status: "proposed", role: "agent", authorKind: "ai" })
    })

    it("approves the proposal: the line is posted, one delivery is enqueued, and the door gets chat.send once under the line key", async () => {
        const scene = await openScene()
        const line = await propose(scene, ANSWER)

        await expect(proof.act(scene, "chatbot.approve-and-send", { id: line.id })).resolves.toMatchObject({
            ok: true,
            data: { messageId: line.id },
        })

        expect(await lineOf(scene, line.id)).toMatchObject({ status: "posted", text: ANSWER })
        const queued = await queuedOf(scene)
        expect(queued).toHaveLength(1)
        expect(door.calls).toEqual([])

        await runDeliveries(scene)
        expect(door.calls).toEqual([
            {
                tool: "chat.send",
                input: { conversationId: scene.conversationId, text: ANSWER, key: line.id },
                effectKey: `${queued[0]?.id}:send`,
            },
        ])
        expect(await lineOf(scene, line.id)).toMatchObject({ status: "posted", deliveryStatus: "sent" })
        expect(await proof.read(scene, "chatbot.proposals", { threadId: scene.conversationId })).toBeNull()

        await runDeliveries(scene)
        expect(door.calls).toHaveLength(1)
    })
})

describe("approving and refusing a proposal", () => {
    it("sends the words the person changed", async () => {
        const scene = await openScene()
        const line = await propose(scene, "Draft")
        await proof.act(scene, "chatbot.approve-and-send", { id: line.id, text: "Changed words" })
        await runDeliveries(scene)
        expect(door.calls[0]?.input).toMatchObject({ text: "Changed words", key: line.id })
    })

    it("refuses to approve a line twice, and queues nothing more", async () => {
        const scene = await openScene()
        const line = await propose(scene, ANSWER)
        await proof.act(scene, "chatbot.approve-and-send", { id: line.id })
        await expect(proof.act(scene, "chatbot.approve-and-send", { id: line.id })).resolves.toMatchObject({
            ok: false,
            reason: "refused",
        })
        expect(await queuedOf(scene)).toHaveLength(1)
    })

    it("retries a transient door failure and records a refusal on the line", async () => {
        const scene = await openScene()
        const line = await propose(scene, ANSWER)
        await proof.act(scene, "chatbot.approve-and-send", { id: line.id })

        door.answer = { ok: false, reason: "transient", message: "timeout" }
        await expect(runDeliveries(scene)).rejects.toBeDefined()
        expect(await lineOf(scene, line.id)).not.toMatchObject({ deliveryStatus: "sent" })

        door.answer = { ok: false, reason: "failed", message: "zalo_recipient" }
        await runDeliveries(scene)
        expect(await lineOf(scene, line.id)).toMatchObject({
            deliveryStatus: "failed",
            deliveryError: "zalo_recipient",
        })
    })

    it("keeps a rejected proposal and sends nothing", async () => {
        const scene = await openScene()
        const line = await propose(scene, ANSWER)
        await expect(proof.act(scene, "chatbot.reject-proposal", { id: line.id })).resolves.toMatchObject({ ok: true })
        expect(await lineOf(scene, line.id)).toMatchObject({ status: "rejected" })
        expect(await queuedOf(scene)).toEqual([])
        expect(door.calls).toEqual([])
    })
})
