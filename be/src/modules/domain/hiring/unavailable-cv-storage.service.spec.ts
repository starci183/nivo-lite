import { Test } from "@nestjs/testing"
import { UnavailableCvStorageService } from "./unavailable-cv-storage.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [UnavailableCvStorageService],
    }).compile()
    return moduleRef.get(UnavailableCvStorageService)
}

describe("UnavailableCvStorageService", () => {
    it("reports that no files were removed", async () => {
        const service = await build()

        await expect(service.remove()).resolves.toBe(0)
    })

    it("has no signed download link", async () => {
        const service = await build()

        await expect(service.signedUrl()).resolves.toBeNull()
    })

    it("has no signed upload link", async () => {
        const service = await build()

        await expect(service.signedUpload()).resolves.toBeNull()
    })
})
