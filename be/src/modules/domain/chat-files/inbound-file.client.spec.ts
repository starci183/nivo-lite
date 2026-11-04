import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatFilesLogEvent } from "./chat-files.log-events"
import { InboundFileReaderClient } from "./inbound-file.client"

const build = async () => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [InboundFileReaderClient, { provide: LOGGER, useValue: logger }],
    }).compile()
    return { reader: moduleRef.get(InboundFileReaderClient), logger }
}

describe("InboundFileReaderClient", () => {
    let folder = ""

    beforeAll(async () => {
        folder = await mkdtemp(join(tmpdir(), "inbound-reader-"))
        await writeFile(join(folder, "a.bin"), Buffer.from([1, 2, 3]))
    })

    afterAll(async () => {
        await rm(folder, { recursive: true, force: true })
    })

    it("reads a file within the limit", async () => {
        const { reader, logger } = await build()

        const bytes = await reader.read(join(folder, "a.bin"), 10)

        expect(bytes && [...bytes]).toEqual([1, 2, 3])
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("answers null for a file over the limit, a missing file and a folder, and logs the file it could not read", async () => {
        const { reader, logger } = await build()
        const missing = join(folder, "missing.bin")

        await expect(reader.read(join(folder, "a.bin"), 2)).resolves.toBeNull()
        await expect(reader.read(missing, 10)).resolves.toBeNull()
        await expect(reader.read(folder, 10)).resolves.toBeNull()

        expect(logger.warn.mock.calls).toEqual([[ChatFilesLogEvent.ImportFileUnreadable, { path: missing }]])
    })
})
