import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { GenerationsService } from "@modules/domain/ai-generations"
import type { GenerationState } from "@modules/domain/ai-generations"
import { VideoProjectScriptingService } from "@modules/domain/video-projects"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoErrorCode } from "./errors/video.error"
import type { ScriptSource, ScriptProject } from "./video-stored.contracts"
import { VideoScriptReadsService } from "./video-script-reads.service"
import { VideoScriptingCompletionService } from "./video-scripting-completion.service"
import { VideoScriptingContextService } from "./video-scripting-context.service"
import { videoScriptMessages, videoScriptSourcesText } from "./video-scripting-prompt.policy"
import { VideoScriptingService } from "./video-scripting.service"

const WS = "workspace-1"
const SOURCE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"
const NOW = "2026-10-13T09:00:00.000Z"
const RECENT = "2026-10-13T08:58:00.000Z"
const STALE = "2026-10-13T08:50:00.000Z"

const SOURCES: ReadonlyArray<ScriptSource> = [{ title: "Menu", topic: null, content: "Bread 20k" }]

const projectOf = builder<ScriptProject>({
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    target_seconds: 30,
    status: "draft",
    inputs: { source_ids: [SOURCE, "not-a-uuid"], notes: "fresh bread" },
    script_meta: { auto_title: true },
    updated_at: RECENT,
    render_status: null,
    workspace_name: "Bakery",
    shop_name: null,
})

const stateOf = builder<GenerationState>({
    id: "generation-1",
    workspaceId: WS,
    purpose: "video_script",
    status: "running",
    text: null,
    errorCode: null,
    input: { context: { projectId: "project-1" } },
    output: {},
    timings: {},
    createdAt: RECENT,
    finishedAt: null,
    messages: [],
})

const SCRIPTING = projectOf({
    status: "scripting",
    script_meta: { script_request_id: "generation-1", generation_id: "generation-1", started_at: RECENT },
})

const build = async (project: ScriptProject | null = projectOf()) => {
    const tx = fakeTransaction(mockEntityManager())
    const reads = mock<VideoScriptReadsService>()
    reads.projectOf.mockResolvedValue(project ?? undefined)
    reads.sourcesOf.mockResolvedValue(SOURCES)
    const members = mock<WorkspaceMembersService>()
    const generations = mock<GenerationsService>()
    generations.request.mockResolvedValue({ id: "generation-1", status: "queued" })
    const context = mock<VideoScriptingContextService>()
    context.forProject.mockResolvedValue("CONTEXT")
    const projectWriter = mock<VideoProjectScriptingService>()
    const completion = mock<VideoScriptingCompletionService>()
    completion.complete.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoScriptingService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: GenerationsService, useValue: generations },
            { provide: VideoScriptingContextService, useValue: context },
            { provide: VideoProjectScriptingService, useValue: projectWriter },
            { provide: VideoScriptingCompletionService, useValue: completion },
            { provide: VideoScriptReadsService, useValue: reads },
        ],
    }).compile()
    return {
        scripting: moduleRef.get(VideoScriptingService),
        tx,
        reads,
        members,
        generations,
        context,
        projectWriter,
        completion,
    }
}

describe("VideoScriptingService", () => {
    describe("request", () => {
        it("queues one generation from the project's public sources and stores its operation", async () => {
            const { scripting, tx, reads, members, generations, context, projectWriter } = await build()

            await expect(scripting.request("person-1", WS, "project-1")).resolves.toEqual({
                id: "generation-1",
                status: "queued",
                projectId: "project-1",
            })

            const sources = videoScriptSourcesText(SOURCES)
            const manager = projectWriter.start.mock.calls[0]?.[0]
            expect(members.require).toHaveBeenCalledWith("person-1", WS, ["owner", "manager"])
            expect(reads.projectOf).toHaveBeenCalledWith(manager, WS, "project-1", true)
            expect(reads.sourcesOf).toHaveBeenCalledWith(WS, [SOURCE])
            expect(context.forProject).toHaveBeenCalledWith(WS, projectOf(), sources)
            expect(generations.request).toHaveBeenCalledWith(
                {
                    workspaceId: WS,
                    purpose: "video_script",
                    module: "video",
                    kind: "engine",
                    responseFormat: "json",
                    timeoutMs: 110_000,
                    messages: videoScriptMessages(projectOf(), WS, sources, "CONTEXT"),
                },
                { projectId: "project-1" },
                manager,
            )
            expect(projectWriter.start).toHaveBeenCalledWith(
                manager,
                WS,
                "project-1",
                JSON.stringify({
                    auto_title: true,
                    script_request_id: "generation-1",
                    generation_id: "generation-1",
                    attempts: 1,
                    started_at: NOW,
                    finished_at: null,
                }),
            )
            expect(tx.commits).toBe(1)
        })

        it("refuses a project that is not there", async () => {
            const { scripting, generations } = await build(null)

            await expect(scripting.request("person-1", WS, "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.ProjectNotFound,
                params: { projectId: "project-1" },
            })
            expect(generations.request).not.toHaveBeenCalled()
        })
    })
})

describe("VideoScriptingService", () => {
    describe("request", () => {
        it.each([
            ["a rendering project", projectOf({ status: "rendering" })],
            ["a queued render", projectOf({ render_status: "queued" })],
            ["a running render", projectOf({ render_status: "rendering" })],
            ["a fresh operation with no request id", projectOf({ status: "scripting", script_meta: {} })],
        ])("refuses %s as busy", async (_label, project) => {
            const { scripting, generations } = await build(project)

            await expect(scripting.request("person-1", WS, "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.ProjectBusy,
                params: { projectId: "project-1" },
            })
            expect(generations.request).not.toHaveBeenCalled()
        })

        it("answers the running operation to a second click", async () => {
            const { scripting, generations, projectWriter } = await build(SCRIPTING)
            generations.state.mockResolvedValue(stateOf({ status: "queued" }))

            await expect(scripting.request("person-1", WS, "project-1")).resolves.toEqual({
                id: "generation-1",
                projectId: "project-1",
                status: "queued",
            })
            expect(generations.request).not.toHaveBeenCalled()
            expect(projectWriter.start).not.toHaveBeenCalled()
        })

        it.each([
            ["no active generation identity", { script_request_id: "generation-1", started_at: RECENT }, []],
            [
                "an active generation that is gone",
                { script_request_id: "generation-1", generation_id: "generation-2", started_at: RECENT },
                [[WS, "generation-2", expect.anything()]],
            ],
        ])("keeps a fresh request running with %s", async (_label, scriptMeta, stateCalls) => {
            const { scripting, generations, projectWriter } = await build(
                projectOf({ status: "scripting", script_meta: scriptMeta }),
            )
            generations.state.mockResolvedValue(null)

            await expect(scripting.request("person-1", WS, "project-1")).resolves.toEqual({
                id: "generation-1",
                projectId: "project-1",
                status: "running",
            })
            expect(generations.request).not.toHaveBeenCalled()
            expect(projectWriter.start).not.toHaveBeenCalled()
            expect(generations.state.mock.calls).toEqual(stateCalls)
        })
    })
})

describe("VideoScriptingService", () => {
    describe("request", () => {
        it("times out a stale operation and its retry before queuing a fresh one", async () => {
            const stale = projectOf({
                status: "scripting",
                script_meta: { script_request_id: "generation-0", generation_id: "generation-9", started_at: STALE },
            })
            const { scripting, generations } = await build(stale)

            await expect(scripting.request("person-1", WS, "project-1")).resolves.toMatchObject({ id: "generation-1" })
            expect(generations.recordFailure.mock.calls.map((call) => call.slice(0, 3))).toEqual([
                [WS, "generation-0", "VIDEO_SCRIPT_TIMEOUT"],
                [WS, "generation-9", "VIDEO_SCRIPT_TIMEOUT"],
            ])
        })
    })
})

describe("VideoScriptingService", () => {
    describe("status", () => {
        it("refuses an operation that is not a video script", async () => {
            const { scripting, generations } = await build()
            generations.state.mockResolvedValue(stateOf({ purpose: "content_post" }))

            await expect(scripting.status("person-1", WS, "generation-1")).rejects.toMatchObject({
                code: VideoErrorCode.ProjectNotFound,
                params: { projectId: "generation-1" },
            })
        })

        it("refuses an operation that is gone", async () => {
            const { scripting, generations } = await build()
            generations.state.mockResolvedValue(null)

            await expect(scripting.status("person-1", WS, "generation-1")).rejects.toMatchObject({
                code: VideoErrorCode.ProjectNotFound,
            })
        })

        it("reports a saved script as succeeded", async () => {
            const { scripting, generations } = await build(SCRIPTING)
            generations.state.mockResolvedValue(
                stateOf({ status: "done", output: { result: { projectId: "project-1" } } }),
            )

            await expect(scripting.status("person-1", WS, "generation-1")).resolves.toEqual({
                id: "generation-1",
                projectId: "project-1",
                status: "succeeded",
                progress: 100,
                resultId: "project-1",
                errorCode: null,
            })
        })

        it.each([
            ["a video script code", "VIDEO_SCRIPT_FORMAT", "VIDEO_SCRIPT_FORMAT"],
            ["another code", "AI_GENERATIONS_FAILED", "VIDEO_SCRIPT_FAILED"],
            ["no code", null, "VIDEO_SCRIPT_FAILED"],
        ])("reports a failed generation with %s", async (_label, errorCode, expected) => {
            const { scripting, generations } = await build(SCRIPTING)
            generations.state.mockResolvedValue(stateOf({ status: "error", errorCode }))

            await expect(scripting.status("person-1", WS, "generation-1")).resolves.toMatchObject({
                status: "failed",
                errorCode: expected,
            })
        })
    })
})

describe("VideoScriptingService", () => {
    describe("status", () => {
        it("reports an operation older than the limit as timed out", async () => {
            const { scripting, generations } = await build(SCRIPTING)
            generations.state.mockResolvedValue(stateOf({ createdAt: STALE }))

            await expect(scripting.status("person-1", WS, "generation-1")).resolves.toMatchObject({
                status: "failed",
                errorCode: "VIDEO_SCRIPT_TIMEOUT",
            })
        })

        it("reports an operation a newer request replaced", async () => {
            const { scripting, generations } = await build(
                projectOf({ script_meta: { script_request_id: "generation-5" } }),
            )
            generations.state.mockResolvedValue(stateOf())

            await expect(scripting.status("person-1", WS, "generation-1")).resolves.toMatchObject({
                status: "failed",
                errorCode: "VIDEO_SCRIPT_SUPERSEDED",
            })
        })

        it("reports the progress of the correction attempt that now runs", async () => {
            const project = projectOf({
                status: "scripting",
                script_meta: { script_request_id: "generation-1", generation_id: "generation-2", started_at: RECENT },
            })
            const { scripting, generations } = await build(project)
            generations.state
                .mockResolvedValueOnce(stateOf())
                .mockResolvedValueOnce(stateOf({ id: "generation-2", status: "queued" }))

            await expect(scripting.status("person-1", WS, "generation-1")).resolves.toEqual({
                id: "generation-1",
                projectId: "project-1",
                status: "queued",
                progress: 0,
                resultId: null,
                errorCode: null,
            })
            expect(generations.state).toHaveBeenLastCalledWith(WS, "generation-2")
        })

        it("reports the running original operation", async () => {
            const { scripting, generations } = await build(SCRIPTING)
            generations.state.mockResolvedValue(stateOf())

            await expect(scripting.status("person-1", WS, "generation-1")).resolves.toMatchObject({
                status: "running",
                progress: 50,
            })
        })
    })
})

describe("VideoScriptingService", () => {
    describe("status", () => {
        it("reports a running correction when its generation row is unavailable", async () => {
            const { scripting, generations, projectWriter } = await build(
                projectOf({
                    status: "scripting",
                    script_meta: { script_request_id: "generation-1", generation_id: "generation-2" },
                }),
            )
            generations.state.mockResolvedValueOnce(stateOf()).mockResolvedValueOnce(null)

            await expect(scripting.status("person-1", WS, "generation-1")).resolves.toEqual({
                id: "generation-1",
                projectId: "project-1",
                status: "running",
                progress: 50,
                resultId: null,
                errorCode: null,
            })
            expect(generations.state.mock.calls).toEqual([
                [WS, "generation-1"],
                [WS, "generation-2"],
            ])
            expect(projectWriter.start).not.toHaveBeenCalled()
        })
    })

    describe("complete", () => {
        it("hands the finished generation to the completion step", async () => {
            const { scripting, completion } = await build()

            await expect(
                scripting.complete(WS, "generation-1", {
                    consumer: "ai_generation_completed__video",
                    dedupeKey: "generation-1",
                }),
            ).resolves.toBeUndefined()
            expect(completion.complete).toHaveBeenCalledWith(WS, "generation-1", {
                consumer: "ai_generation_completed__video",
                dedupeKey: "generation-1",
            })
        })
    })
})
