import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AppErrorsLogEvent } from "./app-errors.log-events"
import { STACK_MAX, clean } from "./app-errors.policy"
import { AppErrorsService } from "./app-errors.service"

/** The statement `callDbFunction` sends for the recording function. */
const RECORD_APP_ERROR = "SELECT * FROM public.app_errors_record($1, $2, $3, $4, $5, $6)"
const WS = "3f1c2b9e-1d2a-4c3b-9a8e-0f1e2d3c4b5a"
const CONNECTION = "4a2d3c0f-2e3b-4d4c-8b9f-1a2b3c4d5e6f"

const build = async () => {
    const em = mockEntityManager()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AppErrorsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(AppErrorsService), em, logger }
}

describe("AppErrorsService", () => {
    it("records a scrubbed failure with its workspace and plain facts", async () => {
        const { service, em } = await build()
        em.query.mockResolvedValue([])
        const failure = new Error("telegram sendMessage: token=abcdef123456 refused")

        await service.report("job.shifts_alerts", failure, { workspaceId: WS, job: "shifts.remind", apiKey: "k-1" })

        const [sql, params] = em.query.mock.calls[0] ?? []
        expect(sql).toBe(RECORD_APP_ERROR)
        expect(params).toEqual([
            "job.shifts_alerts",
            "telegram sendMessage: token=[redacted] refused",
            clean(failure.stack ?? "", STACK_MAX),
            WS,
            null,
            JSON.stringify({ job: "shifts.remind", apiKey: "[redacted]" }),
        ])
    })

    it("passes a connection for the database to resolve the workspace and keeps it in the facts", async () => {
        const { service, em } = await build()
        em.query.mockResolvedValue([])

        await service.report("http", "plain failure", {
            connectionId: CONNECTION,
            workspaceId: "not-a-uuid",
            route: "/hooks",
        })

        expect(em.query).toHaveBeenCalledWith(RECORD_APP_ERROR, [
            "http",
            "plain failure",
            null,
            null,
            CONNECTION,
            JSON.stringify({ route: "/hooks", connectionId: CONNECTION }),
        ])
    })

    it("never throws: a failed write is logged", async () => {
        const { service, em, logger } = await build()
        em.query.mockRejectedValue(new Error("db down"))

        await expect(service.report("graphql", { reason: "x" })).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledWith(AppErrorsLogEvent.ReportFailed, expect.any(Error), {
            scope: "graphql",
        })
    })
})
