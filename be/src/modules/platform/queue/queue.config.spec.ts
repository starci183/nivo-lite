import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EnvSource } from "@modules/platform/config"
import { parseQueueConfig } from "./queue.config"

const QUEUE_CONFIG = Symbol("QUEUE_CONFIG")

describe("parseQueueConfig", () => {
    it("passes the exact defaults to the environment readers, including a 500 ms polling interval", async () => {
        const env = mock<EnvSource>()
        env.bool.mockReturnValue(true)
        env.int.mockReturnValueOnce(4).mockReturnValueOnce(2)
        env.duration.mockReturnValueOnce(500).mockReturnValueOnce(60000).mockReturnValueOnce(30000)
        const moduleRef = await Test.createTestingModule({
            providers: [
                { provide: EnvSource, useValue: env },
                { provide: QUEUE_CONFIG, useFactory: parseQueueConfig, inject: [EnvSource] },
            ],
        }).compile()

        expect(moduleRef.get(QUEUE_CONFIG)).toEqual({
            enabled: true,
            concurrency: 4,
            workspaceConcurrency: 2,
            pollIntervalMs: 500,
            visibilityTimeoutMs: 60000,
            shutdownGraceMs: 30000,
        })
        expect(env.bool.mock.calls).toEqual([["QUEUE_ENABLED", true]])
        expect(env.int.mock.calls).toEqual([
            ["QUEUE_CONCURRENCY", 4],
            ["QUEUE_WORKSPACE_CONCURRENCY", 2],
        ])
        expect(env.duration.mock.calls).toEqual([
            ["QUEUE_POLL_INTERVAL", 500],
            ["QUEUE_VISIBILITY_TIMEOUT", 60000],
            ["QUEUE_SHUTDOWN_GRACE", 30000],
        ])
    })

    it("returns every configured queue option from the environment readers", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                {
                    provide: EnvSource,
                    useValue: new EnvSource({
                        QUEUE_ENABLED: "false",
                        QUEUE_CONCURRENCY: "8",
                        QUEUE_WORKSPACE_CONCURRENCY: "3",
                        QUEUE_POLL_INTERVAL: "250ms",
                        QUEUE_VISIBILITY_TIMEOUT: "90s",
                        QUEUE_SHUTDOWN_GRACE: "2m",
                    }),
                },
                { provide: QUEUE_CONFIG, useFactory: parseQueueConfig, inject: [EnvSource] },
            ],
        }).compile()

        expect(moduleRef.get(QUEUE_CONFIG)).toEqual({
            enabled: false,
            concurrency: 8,
            workspaceConcurrency: 3,
            pollIntervalMs: 250,
            visibilityTimeoutMs: 90000,
            shutdownGraceMs: 120000,
        })
    })
})
