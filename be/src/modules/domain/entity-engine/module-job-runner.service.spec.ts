import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import { Secret } from "@modules/platform/config"
import type { JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import { ENTITY_ENGINE_OPTIONS } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import { EntityEngineService } from "./entity-engine.service"
import { EntityPortsService } from "./entity-ports.service"
import { EntityEngineErrorCode } from "./errors/entity-engine.error"
import { ModuleJobRunnerService } from "./module-job-runner.service"
import { mintScopedTx } from "./policies/scoped-tx.policy"

type ParseFailure = Extract<ReturnType<JobDefinition["input"]["safeParse"]>, { success: false }>["error"]

const WS = "11111111-1111-4111-8111-111111111111"
const TX = mintScopedTx(mockEntityManager(), WS)

const claimed = (payload: object): ClaimedJob => ({
    jobId: "j-1",
    kind: "module-jobs.run",
    fencingToken: 2,
    currentStep: null,
    payload,
})

const payloadOf = (job: string) => ({ workspaceId: WS, job, input: { orderId: "o-1" } })

const build = async () => {
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
    const options: EntityEngineOptions = { entities: [], jobs: [plain, calling], cursorKey: new Secret("a2V5") }
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleJobRunnerService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
            { provide: ENTITY_ENGINE_OPTIONS, useValue: options },
        ],
    }).compile()
    return { runner: moduleRef.get(ModuleJobRunnerService), engine, ports, plain, plainInput, calling }
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

    it("refuses a delivery that does not address a job", async () => {
        const { runner, plain } = await build()

        await expect(runner.run(claimed({ workspaceId: WS }))).rejects.toMatchObject({
            code: EntityEngineErrorCode.JobPayloadInvalid,
            params: { jobId: "j-1" },
        })
        expect(plain.run).not.toHaveBeenCalled()
    })

    it("refuses a job no module declares", async () => {
        const { runner } = await build()

        await expect(runner.run(claimed(payloadOf("sales.nothing")))).rejects.toMatchObject({
            code: EntityEngineErrorCode.JobUnknown,
            params: { job: "sales.nothing" },
        })
    })

    it("refuses an input the job's declaration rejects", async () => {
        const { runner, engine, plainInput } = await build()
        plainInput.safeParse.mockReturnValue({ success: false, error: mock<ParseFailure>() })

        await expect(runner.run(claimed(payloadOf("sales.confirmNotice")))).rejects.toMatchObject({
            code: EntityEngineErrorCode.JobInputInvalid,
            params: { job: "sales.confirmNotice" },
        })
        expect(engine.scoped).not.toHaveBeenCalled()
    })

    it("lets a failure of the job reach the runner", async () => {
        const { runner, plain } = await build()
        plain.run.mockRejectedValue(new Error("boom"))

        await expect(runner.run(claimed(payloadOf("sales.confirmNotice")))).rejects.toThrow("boom")
    })
})
