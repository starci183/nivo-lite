import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { RECORD_INSTALLATION_SOURCES } from "./modules.decorators"
import type { RecordInstallationSource } from "./modules.port"
import { RecordInstallationService } from "./record-installation.service"

const RECORD_ID = "0b6c5d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e"

const build = async () => {
    const sources = [mock<RecordInstallationSource>(), mock<RecordInstallationSource>(), mock<RecordInstallationSource>()]
    for (const source of sources) {
        source.installationIdOf.mockResolvedValue(null)
    }
    const moduleRef = await Test.createTestingModule({
        providers: [RecordInstallationService, { provide: RECORD_INSTALLATION_SOURCES, useValue: sources }],
    }).compile()
    return { service: moduleRef.get(RecordInstallationService), sources }
}

describe("RecordInstallationService", () => {
    it("answers no installation for an id that is not a record id, without asking anyone", async () => {
        const { service, sources } = await build()

        await expect(service.installationOfRecord("ws-1", "not-a-uuid")).resolves.toEqual({ installationId: null })

        for (const source of sources) {
            expect(source.installationIdOf).not.toHaveBeenCalled()
        }
    })

    it("asks every source and answers the installation of the first that names one", async () => {
        const { service, sources } = await build()
        const [, second, third] = sources
        second.installationIdOf.mockResolvedValue("inst-second")
        third.installationIdOf.mockResolvedValue("inst-third")

        await expect(service.installationOfRecord("ws-1", RECORD_ID)).resolves.toEqual({
            installationId: "inst-second",
        })

        for (const source of sources) {
            expect(source.installationIdOf).toHaveBeenCalledWith("ws-1", RECORD_ID)
        }
    })

    it("answers none when no source names an installation", async () => {
        const { service } = await build()

        await expect(service.installationOfRecord("ws-1", RECORD_ID)).resolves.toEqual({ installationId: null })
    })
})
