import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AiGenerationsError, GenerationsService } from "@modules/domain/ai-generations"
import type { GenerationState } from "@modules/domain/ai-generations"
import { EventsService } from "@modules/domain/events"
import { VideoProjectScriptingService } from "@modules/domain/video-projects"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type { MessageCatalog } from "@modules/platform/i18n"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import type { ScriptProject } from "./video-stored.contracts"
import { VideoScriptReadsService } from "./video-script-reads.service"
import { VideoScriptingCompletionService } from "./video-scripting-completion.service"
import { VIDEO_SCRIPT_RETRY } from "./video-scripting.templates"

const WS = "workspace-1"
const NOW = "2026-10-13T09:00:00.000Z"
const ANSWER = JSON.stringify({
    title: "Spring  sale",
    scenes: [
        { caption: "Fresh", voiceover: "Hi" },
        { caption: "Visit", voiceover: "Bye" },
    ],
})
const PROMPT = [
    { role: "system", content: "Write a script" },
    { role: "tool", content: "dropped" },
]

const META = {
    generation_id: "generation-1",
    script_request_id: "generation-1",
    attempts: 1,
    auto_title: true,
    started_at: "2026-10-13T08:59:58.000Z",
}

const stateOf = builder<GenerationState>({
    id: "generation-1",
    workspaceId: WS,
    purpose: "video_script",
    status: "done",
    text: ANSWER,
    errorCode: null,
    input: { context: { projectId: "project-1" }, messages: PROMPT },
    output: {},
    timings: { total_ms: 5 },
    createdAt: "2026-10-13T08:59:58.000Z",
    finishedAt: NOW,
    messages: [],
})

const projectOf = builder<ScriptProject>({
    id: "project-1",
    title: "Draft",
    goal: "offer",
    aspect: "9:16",
    target_seconds: 30,
    status: "scripting",
    inputs: { media: [`${WS}/a.jpg`] },
    script_meta: META,
    updated_at: NOW,
    render_status: null,
    workspace_name: "Bakery",
    shop_name: null,
})

/** The delivery key the bus hands the `video` reactor. */
const CLAIM = { consumer: "ai_generation_completed__video", dedupeKey: "generation-1" }

const build = async (state: GenerationState | null, project: ScriptProject | null = projectOf(), claimWon = true) => {
    const inbox = mock<Inbox>({ claim: jest.fn().mockResolvedValue(claimWon) })
    const tx = fakeTransaction(mockEntityManager())
    const reads = mock<VideoScriptReadsService>()
    reads.projectOf.mockResolvedValue(project ?? undefined)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    const generations = mock<GenerationsService>()
    generations.state.mockResolvedValue(state)
    generations.request.mockResolvedValue({ id: "generation-2", status: "queued" })
    const events = mock<EventsService>()
    const projectWriter = mock<VideoProjectScriptingService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoScriptingCompletionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: INBOX, useValue: inbox },
            { provide: GenerationsService, useValue: generations },
            { provide: EventsService, useValue: events },
            { provide: VideoProjectScriptingService, useValue: projectWriter },
            { provide: VideoScriptReadsService, useValue: reads },
        ],
    }).compile()
    return {
        completion: moduleRef.get(VideoScriptingCompletionService),
        inbox,
        tx,
        generations,
        events,
        projectWriter,
        reads,
    }
}

describe("VideoScriptingCompletionService", () => {
    describe("complete", () => {
        it("claims the delivery in the transaction of the effect and changes nothing for a redelivery", async () => {
            const { completion, inbox, projectWriter, events } = await build(stateOf(), projectOf(), false)

            await expect(completion.complete(WS, "generation-1", CLAIM)).resolves.toBeUndefined()

            expect(inbox.claim).toHaveBeenCalledWith(
                "ai_generation_completed__video",
                "generation-1",
                expect.anything(),
            )
            expect(projectWriter.finish).not.toHaveBeenCalled()
            expect(events.record).not.toHaveBeenCalled()
        })

        it("saves the parsed scenes with the project's media, closes the request and records the event", async () => {
            const { completion, tx, generations, events, projectWriter } = await build(stateOf())

            await expect(completion.complete(WS, "generation-1", CLAIM)).resolves.toBeUndefined()

            const scenes = [
                {
                    id: "generation-1-1",
                    role: "hook",
                    caption: "Fresh",
                    voiceover: "Hi",
                    visual: "",
                    media: `${WS}/a.jpg`,
                },
                {
                    id: "generation-1-2",
                    role: "cta",
                    caption: "Visit",
                    voiceover: "Bye",
                    visual: "",
                    media: `${WS}/a.jpg`,
                },
            ]
            const manager = projectWriter.finish.mock.calls[0]?.[0]
            expect(projectWriter.finish).toHaveBeenCalledWith(manager, {
                workspaceId: WS,
                projectId: "project-1",
                generationId: "generation-1",
                script: JSON.stringify(scenes),
                durationMs: 2000,
                title: "Spring sale",
                meta: JSON.stringify({ ...META, timings: { total_ms: 5 }, finished_at: NOW }),
            })
            expect(generations.recordResult).toHaveBeenCalledWith(
                WS,
                "generation-1",
                { projectId: "project-1" },
                manager,
            )
            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: WS,
                    kind: "video.script_generated",
                    actor: "OpenClaw",
                    summary: 'video.script.generated:{"title":"Spring sale","scenes":2}',
                    evidence: "1. Fresh\n2. Visit",
                },
                manager,
            )
            expect(tx.commits).toBe(1)
        })
    })
})

describe("VideoScriptingCompletionService", () => {
    describe("complete", () => {
        it("keeps the project title when the owner typed it", async () => {
            const { completion, projectWriter } = await build(
                stateOf(),
                projectOf({ script_meta: { ...META, auto_title: false } }),
            )

            await completion.complete(WS, "generation-1", CLAIM)

            expect(projectWriter.finish.mock.calls[0]?.[1]).toMatchObject({ title: null })
        })

        it.each([
            ["a generation that is gone", null],
            ["another purpose", stateOf({ purpose: "content_post" })],
            ["a generation with no project", stateOf({ input: {} })],
            ["a generation still running", stateOf({ status: "running" })],
            ["a queued generation", stateOf({ status: "queued" })],
        ])("ignores %s", async (_label, state) => {
            const { completion, tx, projectWriter } = await build(state)

            await expect(completion.complete(WS, "generation-1", CLAIM)).resolves.toBeUndefined()
            expect(tx.outcomes).toEqual([])
            expect(projectWriter.finish).not.toHaveBeenCalled()
        })

        it.each([
            ["a project that is gone", null],
            ["a project no longer scripting", projectOf({ status: "draft" })],
            [
                "a project another generation owns",
                projectOf({ script_meta: { ...META, generation_id: "generation-9" } }),
            ],
            ["a project with no request", projectOf({ script_meta: { generation_id: "generation-1" } })],
        ])("writes nothing for %s", async (_label, project) => {
            const { completion, tx, projectWriter, generations } = await build(stateOf(), project)

            await completion.complete(WS, "generation-1", CLAIM)

            expect(projectWriter.finish).not.toHaveBeenCalled()
            expect(projectWriter.fail).not.toHaveBeenCalled()
            expect(generations.recordFailure).not.toHaveBeenCalled()
            expect(tx.commits).toBe(1)
        })
    })
})

describe("VideoScriptingCompletionService", () => {
    describe("complete", () => {
        it("records the failure of a generation that ended without text", async () => {
            const { completion, projectWriter, generations } = await build(stateOf({ status: "error", text: null }))

            await completion.complete(WS, "generation-1", CLAIM)

            const manager = projectWriter.fail.mock.calls[0]?.[0]
            expect(projectWriter.fail).toHaveBeenCalledWith(manager, {
                workspaceId: WS,
                projectId: "project-1",
                generationId: "generation-1",
                code: "code:VIDEO_SCRIPT_FAILED",
                meta: JSON.stringify({ ...META, finished_at: NOW }),
            })
            expect(generations.recordFailure).toHaveBeenCalledWith(WS, "generation-1", "VIDEO_SCRIPT_FAILED", manager)
            expect(projectWriter.finish).not.toHaveBeenCalled()
        })

        it("asks once more for valid JSON after a malformed first answer", async () => {
            const { completion, generations, projectWriter } = await build(stateOf({ text: "no json here" }))

            await completion.complete(WS, "generation-1", CLAIM)

            const manager = projectWriter.start.mock.calls[0]?.[0]
            expect(generations.request).toHaveBeenCalledWith(
                {
                    workspaceId: WS,
                    purpose: "video_script",
                    module: "video",
                    kind: "engine",
                    responseFormat: "json",
                    timeoutMs: 110_000,
                    messages: [
                        { role: "system", content: "Write a script" },
                        { role: "user", content: VIDEO_SCRIPT_RETRY },
                    ],
                },
                { projectId: "project-1", requestId: "generation-1" },
                manager,
            )
            expect(projectWriter.start).toHaveBeenCalledWith(
                manager,
                WS,
                "project-1",
                JSON.stringify({ ...META, generation_id: "generation-2", attempts: 2 }),
            )
            expect(projectWriter.fail).not.toHaveBeenCalled()
        })
    })
})

describe("VideoScriptingCompletionService", () => {
    describe("complete", () => {
        it("fails a second malformed answer as a format error", async () => {
            const meta = { ...META, generation_id: "generation-2", attempts: 2 }
            const { completion, generations, projectWriter } = await build(
                stateOf({ id: "generation-2", text: "{}" }),
                projectOf({ script_meta: meta }),
            )

            await completion.complete(WS, "generation-2", CLAIM)

            expect(generations.request).not.toHaveBeenCalled()
            expect(projectWriter.fail.mock.calls[0]?.[1]).toEqual({
                workspaceId: WS,
                projectId: "project-1",
                generationId: "generation-2",
                code: "code:VIDEO_SCRIPT_FORMAT",
                meta: JSON.stringify({ ...meta, finished_at: NOW }),
            })
            expect(generations.recordFailure.mock.calls[0]?.slice(0, 3)).toEqual([
                WS,
                "generation-1",
                "VIDEO_SCRIPT_FORMAT",
            ])
        })

        it("rolls back when the correction cannot be queued for another reason", async () => {
            const { completion, tx, generations, projectWriter } = await build(stateOf({ text: "no json here" }))
            const failure = new VideoError({ code: VideoErrorCode.StorageFailed, params: { path: "queue" } })
            generations.request.mockRejectedValue(failure)

            await expect(completion.complete(WS, "generation-1", CLAIM)).rejects.toBe(failure)
            expect(projectWriter.start).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
        })

        it("fails a done generation whose text is null", async () => {
            const { completion, tx, projectWriter, generations } = await build(stateOf({ text: null }))

            await completion.complete(WS, "generation-1", CLAIM)

            const manager = projectWriter.fail.mock.calls[0]?.[0]
            expect(projectWriter.fail).toHaveBeenCalledWith(manager, {
                workspaceId: WS,
                projectId: "project-1",
                generationId: "generation-1",
                code: "code:VIDEO_SCRIPT_FAILED",
                meta: JSON.stringify({ ...META, finished_at: NOW }),
            })
            expect(generations.recordFailure).toHaveBeenCalledWith(WS, "generation-1", "VIDEO_SCRIPT_FAILED", manager)
            expect(generations.request).not.toHaveBeenCalled()
            expect(tx.commits).toBe(1)
        })
    })
})

describe("VideoScriptingCompletionService", () => {
    describe("complete", () => {
        it("keeps an untitled answer's project title and supplies null media without a start time", async () => {
            const meta = { ...META, started_at: null }
            const { completion, projectWriter, events } = await build(
                stateOf({ text: JSON.stringify({ scenes: [{ caption: "First" }, { caption: "Last" }] }) }),
                projectOf({ inputs: {}, script_meta: meta }),
            )

            await completion.complete(WS, "generation-1", CLAIM)

            const manager = projectWriter.finish.mock.calls[0]?.[0]
            expect(projectWriter.finish).toHaveBeenCalledWith(manager, {
                workspaceId: WS,
                projectId: "project-1",
                generationId: "generation-1",
                script: JSON.stringify([
                    { id: "generation-1-1", role: "hook", caption: "First", voiceover: "", visual: "", media: null },
                    { id: "generation-1-2", role: "cta", caption: "Last", voiceover: "", visual: "", media: null },
                ]),
                durationMs: 0,
                title: null,
                meta: JSON.stringify({ ...meta, timings: { total_ms: 5 }, finished_at: NOW }),
            })
            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: WS,
                    kind: "video.script_generated",
                    actor: "OpenClaw",
                    summary: 'video.script.generated:{"title":"Draft","scenes":2}',
                    evidence: "1. First\n2. Last",
                },
                manager,
            )
        })

        it.each(["not a date", "2026-10-13T09:00:02.000Z"])(
            "reports zero duration for an invalid or future start time: %s",
            async (startedAt) => {
                const meta = { ...META, started_at: startedAt }
                const { completion, projectWriter } = await build(stateOf(), projectOf({ script_meta: meta }))

                await completion.complete(WS, "generation-1", CLAIM)

                expect(projectWriter.finish.mock.calls[0]?.[1]).toMatchObject({
                    workspaceId: WS,
                    projectId: "project-1",
                    generationId: "generation-1",
                    durationMs: 0,
                    title: "Spring sale",
                    meta: JSON.stringify({ ...meta, timings: { total_ms: 5 }, finished_at: NOW }),
                })
            },
        )
    })
})

describe("VideoScriptingCompletionService", () => {
    describe("complete", () => {
        it("retains only string-content conversation messages when queuing a correction", async () => {
            const { completion, generations, projectWriter } = await build(
                stateOf({
                    text: "invalid answer",
                    input: {
                        context: { projectId: "project-1" },
                        messages: [
                            null,
                            { role: "user", content: 42 },
                            { role: "assistant", content: "Previous answer" },
                            { role: "user", content: "Use approved facts" },
                        ],
                    },
                }),
            )

            await completion.complete(WS, "generation-1", CLAIM)

            const manager = projectWriter.start.mock.calls[0]?.[0]
            expect(generations.request).toHaveBeenCalledWith(
                {
                    workspaceId: WS,
                    purpose: "video_script",
                    module: "video",
                    kind: "engine",
                    responseFormat: "json",
                    timeoutMs: 110_000,
                    messages: [
                        { role: "assistant", content: "Previous answer" },
                        { role: "user", content: "Use approved facts" },
                        { role: "user", content: VIDEO_SCRIPT_RETRY },
                    ],
                },
                { projectId: "project-1", requestId: "generation-1" },
                manager,
            )
            expect(projectWriter.start).toHaveBeenCalledWith(
                manager,
                WS,
                "project-1",
                JSON.stringify({ ...META, generation_id: "generation-2", attempts: 2 }),
            )
        })
    })
})

describe("VideoScriptingCompletionService", () => {
    describe("complete", () => {
        it("records a format failure when the generation engine refuses the correction", async () => {
            const { completion, tx, generations, projectWriter } = await build(
                stateOf({ text: "invalid answer", input: { context: { projectId: "project-1" }, messages: null } }),
            )
            const failure = mock<AiGenerationsError>()
            Object.setPrototypeOf(failure, AiGenerationsError.prototype)
            generations.request.mockRejectedValue(failure)

            await completion.complete(WS, "generation-1", CLAIM)

            const manager = projectWriter.fail.mock.calls[0]?.[0]
            expect(generations.request).toHaveBeenCalledWith(
                {
                    workspaceId: WS,
                    purpose: "video_script",
                    module: "video",
                    kind: "engine",
                    responseFormat: "json",
                    timeoutMs: 110_000,
                    messages: [{ role: "user", content: VIDEO_SCRIPT_RETRY }],
                },
                { projectId: "project-1", requestId: "generation-1" },
                manager,
            )
            expect(projectWriter.fail).toHaveBeenCalledWith(manager, {
                workspaceId: WS,
                projectId: "project-1",
                generationId: "generation-1",
                code: "code:VIDEO_SCRIPT_FORMAT",
                meta: JSON.stringify({ ...META, finished_at: NOW }),
            })
            expect(generations.recordFailure).toHaveBeenCalledWith(WS, "generation-1", "VIDEO_SCRIPT_FORMAT", manager)
            expect(projectWriter.start).not.toHaveBeenCalled()
            expect(tx.commits).toBe(1)
        })
    })
})

describe("VideoScriptingCompletionService", () => {
    describe("complete", () => {
        it.each([undefined, null, 42])(
            "writes nothing when the request changes to %p during a refused retry",
            async (requestId) => {
                const meta: Record<string, unknown> = { ...META }
                const { completion, tx, generations, projectWriter, events } = await build(
                    stateOf({ text: "invalid answer" }),
                    projectOf({ script_meta: meta }),
                )
                const failure = mock<AiGenerationsError>()
                Object.setPrototypeOf(failure, AiGenerationsError.prototype)
                generations.request.mockImplementationOnce(() => {
                    meta.script_request_id = requestId
                    return Promise.reject(failure)
                })

                await expect(completion.complete(WS, "generation-1", CLAIM)).resolves.toBeUndefined()

                expect(generations.request).toHaveBeenCalledTimes(1)
                expect(meta.script_request_id).toBe(requestId)
                expect(projectWriter.fail.mock.calls).toEqual([])
                expect(projectWriter.start.mock.calls).toEqual([])
                expect(projectWriter.finish.mock.calls).toEqual([])
                expect(generations.recordFailure.mock.calls).toEqual([])
                expect(generations.recordResult.mock.calls).toEqual([])
                expect(events.record.mock.calls).toEqual([])
                expect(tx.commits).toBe(1)
                expect(tx.rollbacks).toBe(0)
            },
        )
    })
})
