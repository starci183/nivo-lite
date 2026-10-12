import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SeedSecretsFileClient } from "./seed-secrets-file.client"

describe("SeedSecretsFileClient", () => {
    let folder: string

    beforeEach(async () => {
        folder = await mkdtemp(join(tmpdir(), "seed-secrets-"))
    })

    afterEach(async () => {
        await rm(folder, { recursive: true, force: true })
    })

    it("reads an empty text while the file does not exist", async () => {
        await expect(new SeedSecretsFileClient(join(folder, "none.env")).read()).resolves.toBe("")
    })

    it("writes the file, creating its folder, and reads it back", async () => {
        const client = new SeedSecretsFileClient(join(folder, "nested", "secrets.env"))

        await client.write("A=1\n")

        await expect(client.read()).resolves.toBe("A=1\n")
        await expect(readFile(client.location, "utf8")).resolves.toBe("A=1\n")
    })

    it("reads what is already there", async () => {
        const location = join(folder, "secrets.env")
        await writeFile(location, "B=2\n", "utf8")

        await expect(new SeedSecretsFileClient(location).read()).resolves.toBe("B=2\n")
    })

    it("rethrows any other failure of the disk, such as reading a folder", async () => {
        await expect(new SeedSecretsFileClient(folder).read()).rejects.toMatchObject({ code: "EISDIR" })
    })
})
