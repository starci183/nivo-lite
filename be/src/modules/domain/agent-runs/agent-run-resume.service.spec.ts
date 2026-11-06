import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { runStepViewOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunParkStoreService } from "./agent-run-park-store.service"
import { AgentRunResumeService } from "./agent-run-resume.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunWorkspacesService } from "./agent-run-workspaces.service"
import { AGENT_RUNS_OPTIONS } from "./agent-runs.decorators"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import { TOOL_OUTCOME_UNKNOWN, WORKSPACE_SLICE } from "./policies/agent-runs.policy"
import type { AgentStepHandler, StepJson } from "./agent-runs.contracts"
import type { ResumeAnswer, RunStepView } from "./agent-runs-engine.contracts"

const failedStep = (errorCode: string | null = "boom"): RunStepView =>
    runStepViewOf({ stepKey: "turn", status: "failed", attempt: 3, errorCode, fence: 4 })

const RESUMED: ResumeAnswer = { kind: "resumed", stepKey: "turn", workspaceId: "ws-1", errorCode: "boom", at: 9 }

const REF = { runId: "run-1", workspaceId: "ws-1" }

interface Options {
    readonly failed?: RunStepView | null
    readonly answer?: ResumeAnswer
    readonly refreshed?: StepJson
    readonly parked?: ReadonlyArray<{ runId: string; workspaceId: string }>
    readonly slices?: ReadonlyArray<ReadonlyArray<string>>
}

const handlerOf = (over: Options): AgentStepHandler => ({
    kind: "turn",
    run: () => Promise.resolve({ kind: "failed", code: "x" }),
    ...(over.refreshed === undefined ? {} : { refresh: () => Promise.resolve(over.refreshed) }),
})

type Variant = "default" | "tuned" | "bare"

/** The service on a build named b2 with the default bounds, with a pause of ten minutes and two tries a run, or in an app that gave it no options. */
const make = async (over: Options, variant: Variant) => {
    const store = mock<AgentRunParkStoreService>({
        failedStepOf: jest.fn().mockResolvedValue(over.failed === undefined ? failedStep() : over.failed),
        resumeRun: jest.fn().mockResolvedValue(over.answer ?? RESUMED),
        markParked: jest.fn().mockResolvedValue(true),
        parked: jest.fn().mockResolvedValue(over.parked ?? []),
    })
    const runs = mock<AgentRunStoreService>({
        viewsOf: jest.fn().mockResolvedValue([stepViewOf({ stepKey: "turn", kind: "turn", status: "failed" })]),
    })
    const workspaces = mock<AgentRunWorkspacesService>()
    const slices = over.slices ?? [["ws-1"]]
    slices.forEach((slice) => workspaces.next.mockResolvedValueOnce(slice))
    const handlers = mock<AgentRunHandlersService>({ of: jest.fn(() => handlerOf(over)) })
    const logger = mock<Logger>()
    const builder =
        variant === "bare"
            ? Test.createTestingModule({
                  providers: [
                      AgentRunResumeService,
                      { provide: LOGGER, useValue: logger },
                      { provide: AgentRunParkStoreService, useValue: store },
                      { provide: AgentRunStoreService, useValue: runs },
                      { provide: AgentRunWorkspacesService, useValue: workspaces },
                      { provide: AgentRunHandlersService, useValue: handlers },
                  ],
              })
            : variant === "tuned"
              ? Test.createTestingModule({
                    providers: [
                        AgentRunResumeService,
                        { provide: LOGGER, useValue: logger },
                        { provide: AgentRunParkStoreService, useValue: store },
                        { provide: AgentRunStoreService, useValue: runs },
                        { provide: AgentRunWorkspacesService, useValue: workspaces },
                        { provide: AgentRunHandlersService, useValue: handlers },
                        {
                            provide: AGENT_RUNS_OPTIONS,
                            useValue: { buildId: "b2", parkSweepMinutes: 10, parkMaxResumes: 2 },
                        },
                    ],
                })
              : Test.createTestingModule({
                    providers: [
                        AgentRunResumeService,
                        { provide: LOGGER, useValue: logger },
                        { provide: AgentRunParkStoreService, useValue: store },
                        { provide: AgentRunStoreService, useValue: runs },
                        { provide: AgentRunWorkspacesService, useValue: workspaces },
                        { provide: AgentRunHandlersService, useValue: handlers },
                        { provide: AGENT_RUNS_OPTIONS, useValue: { buildId: "b2" } },
                    ],
                })
    const container = await builder.compile()
    return { service: container.get(AgentRunResumeService), store, logger, workspaces }
}

const build = (over: Options = {}) => make(over, "default")

const buildTuned = (over: Options = {}) => make(over, "tuned")

const buildBare = (over: Options = {}) => make(over, "bare")

describe("AgentRunResumeService.resume", () => {
    it("puts a parked run back on its failed step and records who asked and why", async () => {
        const { service, store, logger } = await build()

        await expect(service.resume({ ...REF, actor: "member-1", reason: "fixed scope" })).resolves.toEqual({
            kind: "resumed",
            stepKey: "turn",
            workspaceId: "ws-1",
        })

        expect(store.resumeRun).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: "ws-1",
                runId: "run-1",
                actor: "member-1",
                reason: "fixed scope",
                auto: false,
            }),
        )
        expect(logger.info).toHaveBeenCalledWith(
            AgentRunsLogEvent.RunResumed,
            expect.objectContaining({ runId: "run-1" }),
        )
    })

    it("hands the failed step the input its handler read afresh", async () => {
        const { service, store } = await build({ refreshed: { scope: "new" } })

        await service.resume({ ...REF, actor: "member-1", reason: "x" })

        expect(store.resumeRun).toHaveBeenCalledWith(expect.objectContaining({ input: { scope: "new" } }))
    })

    it("never runs again a step whose outcome is unknown", async () => {
        const { service, store } = await build({ failed: failedStep(TOOL_OUTCOME_UNKNOWN) })

        await expect(service.resume({ ...REF, actor: "m", reason: "x" })).resolves.toEqual({
            kind: "outcome_unknown",
        })
        expect(store.resumeRun).not.toHaveBeenCalled()
    })

    it("refuses a compensated run: it is triggered again, never resumed", async () => {
        const { service, logger } = await build({ failed: null, answer: { kind: "compensated" } })

        await expect(service.resume({ ...REF, actor: "m", reason: "x" })).resolves.toEqual({
            kind: "compensated",
        })
        expect(logger.info).not.toHaveBeenCalled()
    })
})

describe("AgentRunResumeService passes", () => {
    it("resumes the runs parked under another build, as the build", async () => {
        const { service, store } = await build({ parked: [REF] })

        await expect(service.resumeParked(true)).resolves.toEqual({ looked: 1, resumed: 1 })

        expect(store.parked).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: "ws-1", build: "b2", byBuild: true, minAgeSeconds: 0 }),
        )
        expect(store.resumeRun).toHaveBeenCalledWith(expect.objectContaining({ actor: "build", auto: true }))
    })

    it("walks every slice of workspaces for the build pass and only the named ones for the sweep's", async () => {
        const full = Array.from({ length: WORKSPACE_SLICE }, (_, index) => `ws-${String(index)}`)
        const { service, store, workspaces } = await build({ slices: [full, ["ws-last"]] })

        await service.resumeParked(true)

        expect(workspaces.next).toHaveBeenCalledTimes(2)
        expect(store.parked).toHaveBeenCalledTimes(WORKSPACE_SLICE + 1)

        store.parked.mockClear()
        await service.resumeParked(false, ["ws-a", "ws-b"])

        expect(workspaces.next).toHaveBeenCalledTimes(2)
        expect(store.parked.mock.calls.map((call) => call[0].workspaceId)).toEqual(["ws-a", "ws-b"])
    })

    it("takes the next slice of workspaces when the sweep names none", async () => {
        const { service, store } = await build({ slices: [["ws-7"]] })

        await service.resumeParked(false)

        expect(store.parked).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "ws-7", byBuild: false }))
    })

    it("spaces the sweep by the configured minutes and bounds its tries", async () => {
        const { service, store } = await buildTuned({ parked: [REF] })

        await service.resumeParked(false)

        expect(store.parked).toHaveBeenCalledWith(
            expect.objectContaining({ minAgeSeconds: 600, max: 2, byBuild: false }),
        )
        expect(store.resumeRun).toHaveBeenCalledWith(
            expect.objectContaining({ actor: "sweep", max: 2, backoffSeconds: 600 }),
        )
    })

    it("uses the defaults without options and counts a refused run as not resumed", async () => {
        const { service, store } = await buildBare({ answer: { kind: "exhausted" }, parked: [REF] })

        await expect(service.resumeParked(false)).resolves.toEqual({ looked: 1, resumed: 0 })

        expect(store.parked).toHaveBeenCalledWith(expect.objectContaining({ minAgeSeconds: 1800, max: 5 }))
    })
})

describe("AgentRunResumeService failures", () => {
    it("logs a run that fails and goes on with the next", async () => {
        const { service, store, logger } = await build({
            parked: [REF, { runId: "run-2", workspaceId: "ws-1" }],
        })
        store.resumeRun.mockRejectedValueOnce(new Error("db"))

        await expect(service.resumeParked(false)).resolves.toEqual({ looked: 2, resumed: 1 })
        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.ResumeFailed, expect.any(Error), {
            kind: "pass",
            runId: "run-1",
        })
    })

    it("logs a workspace that fails and goes on with the next", async () => {
        const { service, store, logger } = await build({ parked: [REF], slices: [["ws-1", "ws-2"]] })
        store.parked.mockRejectedValueOnce(new Error("db"))

        await expect(service.resumeParked(false)).resolves.toEqual({ looked: 1, resumed: 1 })
        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.ResumeFailed, expect.any(Error), {
            kind: "workspace",
            workspaceId: "ws-1",
        })
    })
})

describe("AgentRunResumeService bootstrap and park mark", () => {
    it("resumes by build when the app starts and names a build", async () => {
        const { service, store } = await build()

        await service.onApplicationBootstrap()

        expect(store.parked).toHaveBeenCalledWith(expect.objectContaining({ byBuild: true }))
    })

    it("does nothing at start without a build, and never marks a build it does not have", async () => {
        const { service, store } = await buildBare()

        await service.onApplicationBootstrap()
        await service.markParked("ws-1", "run-1")

        expect(store.parked).not.toHaveBeenCalled()
        expect(store.markParked).not.toHaveBeenCalled()
    })

    it("marks the build a run parked under, and logs a start pass that fails", async () => {
        const { service, store, logger, workspaces } = await build()
        workspaces.next.mockReset().mockRejectedValue(new Error("db"))

        await service.markParked("ws-1", "run-1")
        await service.onApplicationBootstrap()

        expect(store.markParked).toHaveBeenCalledWith("ws-1", "run-1", "b2")
        expect(logger.error).toHaveBeenCalledWith(AgentRunsLogEvent.ResumeFailed, expect.any(Error), { kind: "boot" })
    })
})
