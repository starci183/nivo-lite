import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseJobsConfig } from "./jobs.config"

const JOBS_CONFIG = Symbol("JOBS_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: JOBS_CONFIG, useFactory: parseJobsConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(JOBS_CONFIG)
}

describe("parseJobsConfig", () => {
    it("uses the worker id and a one minute lease when they are not declared", async () => {
        await expect(read({})).resolves.toEqual({ workerId: "worker", leaseMs: 60_000 })
        await expect(read({ JOBS_WORKER_ID: "", JOBS_LEASE: "" })).resolves.toEqual({
            workerId: "worker",
            leaseMs: 60_000,
        })
    })

    it("reads a declared worker id and lease", async () => {
        await expect(read({ JOBS_WORKER_ID: "worker-2", JOBS_LEASE: "90s" })).resolves.toEqual({
            workerId: "worker-2",
            leaseMs: 90_000,
        })
    })
})
