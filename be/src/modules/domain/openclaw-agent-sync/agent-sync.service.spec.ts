import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { FakeTransaction } from "@starci/jest-preset"
import { OPENCLAW_AGENT_REGISTRY, OPENCLAW_WORKSPACE_WRITER } from "@modules/integrations/openclaw"
import type { AgentRegistryService, WorkspaceWriterService } from "@modules/integrations/openclaw"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AGENTS_QUEUE_PRODUCER } from "@modules/queues/agents"
import type { AgentsQueue } from "@modules/queues/agents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { AgentBundleService, PauseClient } from "@modules/domain/agents"
import { INTERNAL_FILES } from "./agent-sync.policy"
import { AgentSyncService } from "./agent-sync.service"
import type { AgentBundle } from "@modules/domain/agents"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import { OPENCLAW_AGENT_SYNC_OPTIONS } from "./openclaw-agent-sync.decorators"
import { OpenclawAgentSyncLogEvent } from "./openclaw-agent-sync.log-events"
import type { OpenclawAgentSyncOptions } from "./openclaw-agent-sync.options"
import type { Installation, InstallationDirectory } from "@modules/domain/agents"
import { OpenclawAgentSyncErrorCode } from "./errors/openclaw-agent-sync.error"
import {
    FIND_SYNC_STATE,
    RECORD_SYNC_CHECKED,
    RECORD_SYNC_FAILED,
    RECORD_SYNC_WRITTEN,
} from "./persistence/openclaw-agent-sync.sql"

const OPTIONS: OpenclawAgentSyncOptions = { reloadSettleMs: 2000 }

const WORKSPACE = "12345678-aaaa-bbbb-cccc-000000000000"
const AT = "2026-10-12T10:00:00.000Z"

const installationOf = builder<Installation>({
    id: "i1",
    workspaceId: WORKSPACE,
    module: "chatbot",
    name: "Chatbot",
    isMulti: false,
    agentId: "a1",
    operatingMode: "assist",
    settings: {},
    activeContextVersionId: null,
})

const BUNDLE: AgentBundle = {
    installationId: "i1",
    workspaceId: WORKSPACE,
    module: "chatbot",
    agentId: "ws-12345678-chatbot",
    agentName: "Bot",
    contextVersion: 3,
    audience: "customer",
    files: [{ path: "AGENTS.md", content: "rules" }],
}

const RECORD = [
    "i1",
    WORKSPACE,
    "ws-12345678-chatbot",
    AT,
    3,
    "hash-1",
    '[{"path":"AGENTS.md","bytes":1,"sha256":"s"}]',
]

interface Setup {
    installation?: Installation | null
    previousHash?: string | null
    current?: boolean
    registered?: boolean
    dirs?: boolean
    internalCurrent?: boolean
    internalRegistered?: boolean
}

const build = async (setup: Setup = {}) => {
    const tx: FakeTransaction = fakeTransaction(
        mockEntityManager({
            query: [
                FIND_SYNC_STATE,
                setup.previousHash === undefined ? [] : [{ content_hash: setup.previousHash, status: "ok" }],
            ],
        }),
    )
    tx.em.query.mockResolvedValue([])
    tx.em.query.mockResolvedValueOnce(
        setup.previousHash === undefined ? [] : [{ content_hash: setup.previousHash, status: "ok" }],
    )
    const installations = mock<InstallationDirectory>({
        byId: jest.fn(() => Promise.resolve(setup.installation === undefined ? installationOf() : setup.installation)),
        onOpenclaw: jest.fn(() =>
            Promise.resolve([
                { id: "i1", workspaceId: WORKSPACE },
                { id: "i2", workspaceId: "w2" },
            ]),
        ),
    })
    const registry = mock<AgentRegistryService>({
        workspaceDirs: jest.fn(() =>
            setup.dirs === false ? null : { local: "/cfg/workspace-x", gateway: "/gw/workspace-x" },
        ),
        isCurrent: jest.fn(() => setup.current === true || setup.internalCurrent === true),
        register: jest.fn(() => setup.registered === true || setup.internalRegistered === true),
    })
    const writer = mock<WorkspaceWriterService>({
        contentHash: jest.fn(() => "hash-1"),
        metaOf: jest.fn(() => [{ path: "AGENTS.md", bytes: 1, sha256: "s" }]),
        matches: jest.fn(() => setup.current === true || setup.internalCurrent === true),
        write: jest.fn(() => ({ written: 1, removed: 0 })),
    })
    const bundles = mock<AgentBundleService>({ build: jest.fn(() => Promise.resolve(BUNDLE)) })
    const queue = mock<AgentsQueue>({ enqueueSyncAgents: jest.fn(() => Promise.resolve()) })
    const pause = mock<PauseClient>({ wait: jest.fn(() => Promise.resolve()) })
    const members = mock<WorkspaceMembersService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentSyncService,
            { provide: OPENCLAW_AGENT_SYNC_OPTIONS, useValue: OPTIONS },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: LOGGER, useValue: logger },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: OPENCLAW_AGENT_REGISTRY, useValue: registry },
            { provide: OPENCLAW_WORKSPACE_WRITER, useValue: writer },
            { provide: AgentBundleService, useValue: bundles },
            { provide: AGENTS_QUEUE_PRODUCER, useValue: queue },
            { provide: PauseClient, useValue: pause },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return {
        service: moduleRef.get(AgentSyncService),
        tx,
        installations,
        registry,
        writer,
        bundles,
        queue,
        pause,
        logger,
        members,
    }
}

describe("AgentSyncService", () => {
    describe("request", () => {
        it("queues the sync of one installation in the caller's transaction", async () => {
            const { service, tx, queue } = await build()

            await service.request({ workspaceId: "w1", installationId: "i1", force: true }, tx.em)

            expect(queue.enqueueSyncAgents).toHaveBeenCalledWith(
                { workspaceId: "w1", installationId: "i1", force: true, requestedAt: Date.parse(AT) },
                tx.em,
            )
        })

        it("queues the sync of a whole workspace without an installation", async () => {
            const { service, tx, queue } = await build()

            await service.request({ workspaceId: "w1", installationId: null, force: false }, tx.em)

            expect(queue.enqueueSyncAgents).toHaveBeenCalledWith(
                { workspaceId: "w1", force: false, requestedAt: Date.parse(AT) },
                tx.em,
            )
        })

        it("opens its own transaction when asked to", async () => {
            const { service, tx, queue } = await build()

            await service.requestNow({ workspaceId: "w1", installationId: null, force: false })

            expect(tx.commits).toBe(1)
            expect(queue.enqueueSyncAgents).toHaveBeenCalledTimes(1)
        })
    })

    describe("requestFor", () => {
        it("queues the sync for an owner or manager of the workspace", async () => {
            const { service, queue, members } = await build()

            await service.requestFor("u1", { workspaceId: "w1", installationId: "i1", force: true })

            expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
            expect(queue.enqueueSyncAgents).toHaveBeenCalledWith(
                { workspaceId: "w1", installationId: "i1", force: true, requestedAt: Date.parse(AT) },
                expect.anything(),
            )
        })

        it("syncs the whole workspace, not forced, when the ask names neither", async () => {
            const { service, queue } = await build()

            await service.requestFor("u1", { workspaceId: "w1" })

            expect(queue.enqueueSyncAgents).toHaveBeenCalledWith(
                { workspaceId: "w1", force: false, requestedAt: Date.parse(AT) },
                expect.anything(),
            )
        })

        it("queues nothing for someone who may not", async () => {
            const { service, queue, members } = await build()
            const refusal = new Error("not a manager")
            members.require.mockRejectedValue(refusal)

            await expect(service.requestFor("u1", { workspaceId: "w1" })).rejects.toBe(refusal)
            expect(queue.enqueueSyncAgents).not.toHaveBeenCalled()
        })
    })
})

describe("AgentSyncService", () => {
    describe("process", () => {
        it("syncs the installation a job names", async () => {
            const { service, bundles } = await build({ previousHash: "old" })

            await expect(service.process({ workspaceId: WORKSPACE, installationId: "i1" })).resolves.toBe(1)
            expect(bundles.build).toHaveBeenCalledTimes(1)
        })

        it("handles nothing for an installation the sync skips", async () => {
            const { service } = await build({ installation: null })

            await expect(service.process({ workspaceId: WORKSPACE, installationId: "i1" })).resolves.toBe(0)
        })

        it("handles nothing for a payload of another shape", async () => {
            const { service, installations } = await build()

            await expect(service.process({ force: "yes" })).resolves.toBe(0)
            expect(installations.byId).not.toHaveBeenCalled()
        })

        it("ignores a payload that names an installation without its workspace", async () => {
            const { service, installations } = await build()

            await expect(service.process({ installationId: "i1" })).resolves.toBe(0)
            expect(installations.byId).not.toHaveBeenCalled()
        })

        it("fans a workspace out into one job per installation on OpenClaw", async () => {
            const { service, installations, queue, tx } = await build()

            await expect(service.process({ workspaceId: "w1" })).resolves.toBe(2)

            expect(installations.onOpenclaw).toHaveBeenCalledWith("w1", 500)
            expect(queue.enqueueSyncAgents).toHaveBeenNthCalledWith(
                1,
                { workspaceId: WORKSPACE, installationId: "i1", requestedAt: Date.parse(AT) },
                expect.anything(),
            )
            expect(queue.enqueueSyncAgents).toHaveBeenNthCalledWith(
                2,
                { workspaceId: "w2", installationId: "i2", requestedAt: Date.parse(AT) },
                expect.anything(),
            )
            expect(tx.commits).toBe(1)
        })

        it("fans the scheduler tick out over every workspace", async () => {
            const { service, installations } = await build()

            await expect(service.process({})).resolves.toBe(2)
            expect(installations.onOpenclaw).toHaveBeenCalledWith(null, 500)
        })
    })
})

describe("AgentSyncService", () => {
    describe("syncInstallation", () => {
        it("skips an installation that is not on OpenClaw unless forced", async () => {
            const { service, bundles } = await build({
                installation: installationOf({ settings: { processor: "nivo" } }),
            })

            await expect(service.syncInstallation(WORKSPACE, "i1", false)).resolves.toBeNull()
            await expect(service.syncInstallation(WORKSPACE, "i1", true)).resolves.toMatchObject({ changed: true })
            expect(bundles.build).toHaveBeenCalledTimes(1)
        })

        it("writes the files, registers the agent, waits for the reload and records the sync", async () => {
            const { service, tx, writer, registry, pause, logger } = await build({
                previousHash: "old",
                registered: true,
            })

            const outcome = await service.syncInstallation(WORKSPACE, "i1", false)

            expect(outcome).toEqual({
                agentId: "ws-12345678-chatbot",
                contextVersion: 3,
                files: 1,
                contentHash: "hash-1",
                changed: true,
                written: 1,
                removed: 0,
                registered: true,
            })
            expect(writer.write).toHaveBeenCalledWith("/cfg/workspace-x", BUNDLE.files)
            expect(registry.register).toHaveBeenCalledWith("ws-12345678-chatbot", "Bot")
            expect(pause.wait).toHaveBeenCalledWith(2000)
            expect(tx.em.query).toHaveBeenCalledWith(FIND_SYNC_STATE, ["i1"])
            expect(tx.em.query).toHaveBeenCalledWith(RECORD_SYNC_WRITTEN, RECORD)
            expect(logger.info).toHaveBeenCalledWith(OpenclawAgentSyncLogEvent.AgentSynced, {
                agentId: "ws-12345678-chatbot",
                written: 1,
                removed: 0,
                registered: true,
            })
        })

        it("does not wait when openclaw.json did not change", async () => {
            const { service, pause } = await build({ previousHash: "old", registered: false })

            await expect(service.syncInstallation(WORKSPACE, "i1", false)).resolves.toMatchObject({ registered: false })
            expect(pause.wait).not.toHaveBeenCalled()
        })

        it("only moves the check time when the copy is already current", async () => {
            const { service, tx, writer } = await build({ previousHash: "hash-1", current: true })

            await expect(service.syncInstallation(WORKSPACE, "i1", false)).resolves.toMatchObject({
                changed: false,
                written: 0,
                registered: false,
            })

            expect(writer.write).not.toHaveBeenCalled()
            expect(tx.em.query).toHaveBeenCalledWith(RECORD_SYNC_CHECKED, RECORD)
        })

        it("rewrites when the hash is the same but a file on disk differs", async () => {
            const { service, writer } = await build({ previousHash: "hash-1", current: false })

            await expect(service.syncInstallation(WORKSPACE, "i1", false)).resolves.toMatchObject({ changed: true })
            expect(writer.write).toHaveBeenCalledTimes(1)
        })
    })
})

describe("AgentSyncService", () => {
    describe("syncInstallation", () => {
        it("records the failure on the sync row and rethrows it", async () => {
            const { service, tx, logger } = await build({ dirs: false })

            await expect(service.syncInstallation(WORKSPACE, "i1", false)).rejects.toMatchObject({
                code: OpenclawAgentSyncErrorCode.WorkspaceUnavailable,
            })

            expect(tx.em.query).toHaveBeenCalledWith(RECORD_SYNC_FAILED, [
                "i1",
                WORKSPACE,
                "ws-12345678-chatbot",
                AT,
                "OPENCLAW_AGENT_SYNC_WORKSPACE_UNAVAILABLE",
            ])
            expect(logger.error).toHaveBeenCalledTimes(1)
        })

        it("still rethrows the original failure when it cannot be recorded", async () => {
            const { service, tx, bundles, logger } = await build()
            const failure = new Error("bundle failed")
            const recordFailure = new Error("table locked")
            bundles.build.mockRejectedValue(failure)
            tx.em.query.mockReset()
            tx.em.query.mockRejectedValue(recordFailure)

            await expect(service.syncInstallation(WORKSPACE, "i1", false)).rejects.toBe(failure)

            expect(logger.error).toHaveBeenCalledWith(OpenclawAgentSyncLogEvent.SyncFailureNotRecorded, recordFailure, {
                installationId: "i1",
            })
        })
    })
})

describe("AgentSyncService", () => {
    describe("ensureInternalAgent", () => {
        it("writes the files and registers the internal agent on first use", async () => {
            const { service, writer, registry, pause } = await build({ internalRegistered: true })
            writer.matches.mockReturnValue(false)

            await expect(service.ensureInternalAgent(WORKSPACE)).resolves.toBe("ws-12345678-nivo")

            expect(writer.write).toHaveBeenCalledWith("/cfg/workspace-x", INTERNAL_FILES)
            expect(registry.register).toHaveBeenCalledWith("ws-12345678-nivo", "NIVO")
            expect(pause.wait).toHaveBeenCalledWith(2000)
        })

        it("only verifies an internal agent that is already current", async () => {
            const { service, writer, registry, pause } = await build({ internalCurrent: true })

            await expect(service.ensureInternalAgent(WORKSPACE)).resolves.toBe("ws-12345678-nivo")

            expect(writer.write).not.toHaveBeenCalled()
            expect(registry.register).not.toHaveBeenCalled()
            expect(pause.wait).not.toHaveBeenCalled()
        })

        it("does not wait when registering changed nothing", async () => {
            const { service, pause, writer } = await build({ internalRegistered: false })
            writer.matches.mockReturnValue(true)

            await service.ensureInternalAgent(WORKSPACE)

            expect(pause.wait).not.toHaveBeenCalled()
        })

        it("refuses when the agent workspaces cannot be written", async () => {
            const { service } = await build({ dirs: false })

            await expect(service.ensureInternalAgent(WORKSPACE)).rejects.toMatchObject({
                code: OpenclawAgentSyncErrorCode.WorkspaceUnavailable,
            })
        })
    })
})
