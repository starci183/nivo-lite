import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NodeInboundFileReader } from "./inbound-file.reader"

describe("NodeInboundFileReader", () => {
    let folder = ""

    beforeAll(async () => {
        folder = await mkdtemp(join(tmpdir(), "inbound-reader-"))
        await writeFile(join(folder, "a.bin"), Buffer.from([1, 2, 3]))
    })

    afterAll(async () => {
        await rm(folder, { recursive: true, force: true })
    })

    it("reads a file within the limit", async () => {
        const bytes = await new NodeInboundFileReader().read(join(folder, "a.bin"), 10)

        expect(bytes && [...bytes]).toEqual([1, 2, 3])
    })

    it("answers null for a file over the limit, a missing file and a folder", async () => {
        const reader = new NodeInboundFileReader()

        await expect(reader.read(join(folder, "a.bin"), 2)).resolves.toBeNull()
        await expect(reader.read(join(folder, "missing.bin"), 10)).resolves.toBeNull()
        await expect(reader.read(folder, 10)).resolves.toBeNull()
    })
})
