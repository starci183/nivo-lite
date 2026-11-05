import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentRunAlertsService } from "@modules/domain/agent-runs"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { Secret } from "@modules/platform/config"
import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import { ENTITY_ENGINE_OPTIONS } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import { EntityEngineService } from "./entity-engine.service"
import { EntityPortsService } from "./entity-ports.service"
import { ModuleJobRunnerService } from "./module-job-runner.service"
import { mintScopedTx } from "./policies/scoped-tx.policy"

type ParseFailure = Extract<ReturnType<JobDefinition["input"]["safeParse"]>, { success: false }>["error"]

const WS = "11111111-1111-4111-8111-111111111111"
const TX = mintScopedTx({ manager: mockEntityManager(), workspaceId: WS })

const claimed = (payload: object): ClaimedJob => ({
    jobId: "j-1",
    kind: "module-jobs.run",
    fencingToken: 2,
    currentStep: null,
    payload,
})

const payloadOf = (job: string) => ({ workspaceId: WS, job, input: { orderId: "o-1" } })

const build = async (buildId?: string) => {
    const engine = mock<EntityEngineService>()
    const ports = mock<EntityPortsService>()
    const plainInput = mock<JobDefinition["input"]>()
    const callingInput = mock<JobDefinition["input"]>()
    const plain = mock<JobDefinition>({
        name: "sales.confirmNotice",
        input: plainInput,
        ports: { orders: { entry: "port", id: "engine.entities" } },
    })
    const calling = mock<JobDefinition>({
        name: "sales.sendNotice",
        input: callingInput,
        ports: { door: { entry: "port", id: "engine.door" } },
    })
    plainInput.safeParse.mockReturnValue({ success: true, data: { orderId: "o-1" } })
    callingInput.safeParse.mockReturnValue({ success: true, data: { orderId: "o-1" } })
    plain.run.mockResolvedValue(undefined)
    calling.run.mockResolvedValue(undefined)
    engine.scoped.mockImplementation((_workspaceId, run) => run(TX))
    ports.portsFor.mockReturnValue({ handle: "ports" })
    const claims = mock<JobClaims>()
    const alerts = mock<AgentRunAlertsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleJobRunnerService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
            {
                provide: ENTITY_ENGINE_OPTIONS,
                useValue: builder<EntityEngineOptions>({
                    entities: [],
                    jobs: [plain, calling],
                    cursorKey: new Secret("a2V5"),
                })(buildId === undefined ? {} : { buildId }),
            },
            { provide: JOB_CLAIMS, useValue: claims },
            { provide: AgentRunAlertsService, useValue: alerts },
        ],
    }).compile()
    return { runner: moduleRef.get(ModuleJobRunnerService), engine, ports, plain, plainInput, calling, claims, alerts }
}

describe("ModuleJobRunnerService", () => {
    it("runs a declared job in one scoped transaction of the workspace it was enqueued in", async () => {
        const { runner, engine, ports, plain } = await build()

        await runner.run(claimed(payloadOf("sales.confirmNotice")))

        expect(engine.scoped).toHaveBeenCalledTimes(1)
        expect(engine.scoped.mock.calls[0]?.[0]).toBe(WS)
        expect(ports.portsFor.mock.calls[0]?.slice(1)).toEqual(["job", plain.ports])
        const runIn = ports.portsFor.mock.calls[0]?.[0]
        await expect(runIn?.((tx) => Promise.resolve(tx))).resolves.toBe(TX)
        const [handed, input, context] = plain.run.mock.calls[0] ?? []
        expect([handed, input]).toEqual([{ handle: "ports" }, { orderId: "o-1" }])
        expect([context?.workspaceId, context?.attempt, context?.effectKey("notify")]).toEqual([WS, 2, "j-1:notify"])
    })

    it("gives every call of a job that calls the door a scoped transaction of its own", async () => {
        const { runner, engine, ports, calling } = await build()

        await runner.run(claimed(payloadOf("sales.sendNotice")))

        expect(engine.scoped).not.toHaveBeenCalled()
        const runIn = ports.portsFor.mock.calls[0]?.[0]
        await expect(runIn?.((tx) => Promise.resolve(tx.workspaceId))).resolves.toBe(WS)
        expect(engine.scoped.mock.calls[0]?.[0]).toBe(WS)
        expect(calling.run.mock.calls[0]?.slice(0, 2)).toEqual([{ handle: "ports" }, { orderId: "o-1" }])
    })
})

describe("ModuleJobRunnerService park", () => {
    it("parks a delivery that does not address a job, with the class of its failure", async () => {
        const { runner, plain, claims } = await build("build-1")
        claims.park.mockResolvedValue(false)

        await runner.run(claimed({ workspaceId: WS }))

        expect(claims.park).toHaveBeenCalledWith({
            jobId: "j-1",
            expectedFencingToken: 2,
            failureClass: "input",
            reason: "ENTITY_ENGINE_JOB_PAYLOAD_INVALID",
            build: "build-1",
            queue: "module_jobs",
        })
        expect(plain.run).not.toHaveBeenCalled()
    })

    it("parks a job no module declares and raises the one alert of the park", async () => {
        const { runner, claims, alerts } = await build("build-1")
        claims.park.mockResolvedValue(true)

        await runner.run(claimed(payloadOf("sales.nothing")))

        expect(alerts.raise).toHaveBeenCalledWith({
            kind: "flow-parked",
            jobId: "j-1",
            flowKind: "module-jobs.run",
            failureClass: "input",
            reason: "ENTITY_ENGINE_JOB_UNKNOWN",
            correlationId: "j-1",
            build: "build-1",
            action: "resume",
        })
    })

    it("parks a job whose input the declaration rejects and raises no second alert", async () => {
        const { runner, claims, alerts, plainInput, engine } = await build()
        claims.park.mockResolvedValue(false)
        plainInput.safeParse.mockReturnValue({ success: false, error: mock<ParseFailure>() })

        await runner.run(claimed(payloadOf("sales.confirmNotice")))

        expect(claims.park.mock.calls[0]?.[0]).toMatchObject({
            failureClass: "input",
            reason: "ENTITY_ENGINE_JOB_INPUT_INVALID",
            build: "unknown",
        })
        expect(alerts.raise).not.toHaveBeenCalled()
        expect(engine.scoped).not.toHaveBeenCalled()
    })
})

describe("ModuleJobRunnerService park on failure", () => {
    it("parks a job that fails with a bug, naming the failure", async () => {
        const { runner, plain, claims } = await build()
        claims.park.mockResolvedValue(false)
        plain.run.mockRejectedValue(new Error("boom"))

        await runner.run(claimed(payloadOf("sales.confirmNotice")))

        expect(claims.park.mock.calls[0]?.[0]).toMatchObject({ failureClass: "code", reason: "boom" })
    })

    it("parks a job that throws something that is not an error", async () => {
        const { runner, plain, claims } = await build()
        claims.park.mockResolvedValue(false)
        plain.run.mockRejectedValue("oops")

        await runner.run(claimed(payloadOf("sales.confirmNotice")))

        expect(claims.park.mock.calls[0]?.[0]).toMatchObject({ failureClass: "code", reason: "unknown" })
    })

    it("lets a transient failure reach the runner so the queue retries it", async () => {
        const { runner, plain, claims } = await build()
        const cause = Object.assign(new Error("reset"), { code: "ECONNRESET" })
        plain.run.mockRejectedValue(cause)

        await expect(runner.run(claimed(payloadOf("sales.confirmNotice")))).rejects.toBe(cause)
        expect(claims.park).not.toHaveBeenCalled()
    })
})
