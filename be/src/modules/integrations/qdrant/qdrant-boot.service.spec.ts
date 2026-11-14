import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QdrantError, QdrantErrorCode } from "./errors/qdrant.error"
import { QdrantBootService } from "./qdrant-boot.service"
import { QdrantClient } from "./qdrant.client"
import { QdrantLogEvent } from "./qdrant.log-events"

const build = async () => {
    const client = mock<QdrantClient>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            QdrantBootService,
            { provide: QdrantClient, useValue: client },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { boot: moduleRef.get(QdrantBootService), client, logger }
}

describe("QdrantBootService", () => {
    it("prepares both collections once when the app starts", async () => {
        const { boot, client, logger } = await build()

        await boot.onApplicationBootstrap()
        await expect(boot.prepare()).resolves.toBe(true)

        expect(client.ensure.mock.calls.map(([kind]) => kind)).toEqual(["passage", "truth"])
        expect(logger.info).toHaveBeenCalledWith(QdrantLogEvent.Prepared, { kinds: 2 })
    })

    it("refuses to start on a collection of another vector size: the mismatch is thrown, never swallowed", async () => {
        const { boot, client } = await build()
        const mismatch = new QdrantError({
            code: QdrantErrorCode.Mismatch,
            params: { collection: "nivo_passages", expected: "1536 Cosine", found: "3072 Cosine" },
        })
        client.ensure.mockRejectedValue(mismatch)

        await expect(boot.onApplicationBootstrap()).rejects.toBe(mismatch)
    })

    it("boots when the service cannot be reached, says so, and prepares on the next ask", async () => {
        const { boot, client, logger } = await build()
        client.ensure.mockRejectedValueOnce(new QdrantError({ code: QdrantErrorCode.Unavailable }))

        await expect(boot.onApplicationBootstrap()).resolves.toBeUndefined()
        expect(logger.warn).toHaveBeenCalledWith(QdrantLogEvent.Unreachable, { reason: QdrantErrorCode.Unavailable })

        await expect(boot.prepare()).resolves.toBe(true)
        expect(client.ensure).toHaveBeenCalledTimes(3)
    })
})
