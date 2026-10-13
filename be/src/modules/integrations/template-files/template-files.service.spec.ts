import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TemplateFilesErrorCode } from "./errors/template-files.error"
import { TemplateFilesService } from "./template-files.service"

describe("TemplateFilesService", () => {
    let root: string
    let service: TemplateFilesService

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), "template-files-"))
        service = new TemplateFilesService({ root })
        await mkdir(join(root, "automation-templates"))
        await mkdir(join(root, "n8n-templates"))
        await writeFile(join(root, "automation-templates", "b.json"), '{"key":"b"}')
        await writeFile(join(root, "automation-templates", "a.json"), '{"key":"a"}')
        await writeFile(join(root, "automation-templates", "readme.txt"), "not json")
        await writeFile(join(root, "n8n-templates", "mail.meta.json"), '{"key":"mail"}')
        await writeFile(join(root, "n8n-templates", "mail.json"), '{"name":"Mail","nodes":[]}')
    })

    afterEach(async () => {
        await rm(root, { recursive: true, force: true })
    })

    describe("readDefinitions", () => {
        it("reads the automation files and the n8n meta files, each folder in name order", async () => {
            await expect(service.readDefinitions()).resolves.toEqual([{ key: "a" }, { key: "b" }, { key: "mail" }])
        })

        it("names the file that is not valid json", async () => {
            await writeFile(join(root, "automation-templates", "c.json"), "{broken")

            await expect(service.readDefinitions()).rejects.toMatchObject({
                code: TemplateFilesErrorCode.FileInvalid,
                params: { file: "c.json" },
            })
        })
    })
})
