import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Writable } from "node:stream"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { IDS } from "@modules/platform/ids"
import { MAIL_SETTINGS } from "./mail.decorators"
import type { MailOptions } from "./mail.options"
import { MailOutboxService } from "./mail-outbox.service"

const made: Array<string> = []

const workFolder = async (): Promise<string> => {
    const folder = await mkdtemp(join(tmpdir(), "mail-outbox-"))
    made.push(folder)
    return folder
}

afterEach(async () => {
    await Promise.all(made.splice(0).map((folder) => rm(folder, { recursive: true, force: true })))
})

const build = async (outboxDir: string | null, at = "2026-11-04T01:00:00.000Z") => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            MailOutboxService,
            { provide: MAIL_SETTINGS, useValue: mock<MailOptions>({ outboxDir }) },
            { provide: CLOCK, useValue: new FakeClock(at) },
            { provide: IDS, useValue: fakeIds() },
        ],
    }).compile()
    return moduleRef.get(MailOutboxService)
}

const sink = () => {
    const chunks: Array<string> = []
    const out = new Writable({
        write(chunk: Buffer, _encoding, done) {
            chunks.push(chunk.toString("utf8"))
            done()
        },
    })
    return { out, text: () => chunks.join("") }
}

describe("MailOutboxService", () => {
    it("keeps a held message as a file, creating the folder, and reads it back", async () => {
        const folder = await workFolder()
        const nested = join(folder, "deep", "outbox")
        const service = await build(nested)

        await service.record("ada@x.test", "Confirm", "Open https://app.test/c?t=1")

        expect(await readdir(nested)).toHaveLength(1)
        await expect(service.entries({})).resolves.toEqual([
            {
                at: "2026-11-04T01:00:00.000Z",
                to: "ada@x.test",
                subject: "Confirm",
                text: "Open https://app.test/c?t=1",
                links: ["https://app.test/c?t=1"],
            },
        ])
    })
    it("keeps nothing and finds nothing without a folder", async () => {
        const service = await build(null)

        await service.record("ada@x.test", "Confirm", "t")

        await expect(service.entries({})).resolves.toEqual([])
    })
    it("finds nothing in a folder that does not exist yet, and skips files that are no entry", async () => {
        const folder = await workFolder()
        await expect((await build(join(folder, "none"))).entries({})).resolves.toEqual([])

        const service = await build(folder)
        await writeFile(join(folder, "note.txt"), "x")
        await writeFile(join(folder, "bad.json"), JSON.stringify({ at: 1 }))
        await expect(service.entries({})).resolves.toEqual([])
    })
    it("skips a file that is no JSON, and refuses to read a folder that cannot be read", async () => {
        const folder = await workFolder()
        const service = await build(folder)
        await writeFile(join(folder, "broken.json"), "{not json")
        const blocked = await build(join(folder, "broken.json"))

        await expect(service.entries({})).resolves.toEqual([])
        await expect(blocked.entries({})).rejects.toMatchObject({ code: "ENOTDIR" })
    })
    it("reports the asked messages with their links, or says there is none", async () => {
        const folder = await workFolder()
        const service = await build(folder)
        await service.record("ada@x.test", "Confirm", "Open https://app.test/c?t=1")
        const found = sink()
        const empty = sink()

        await service.report({ to: "ADA@x.test", latest: true }, found.out)
        await service.report({ to: "bob@x.test" }, empty.out)

        expect(found.text()).toBe("2026-11-04T01:00:00.000Z ada@x.test Confirm\n  link https://app.test/c?t=1\n")
        expect(empty.text()).toBe("no message\n")
    })
})
