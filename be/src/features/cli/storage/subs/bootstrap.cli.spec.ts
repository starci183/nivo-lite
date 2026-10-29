import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { StorageBootstrapService } from "@modules/integrations/object-storage"
import { BootstrapStorageCli } from "./bootstrap.cli"

describe("BootstrapStorageCli", () => {
    it("asks the storage integration to ensure every bucket", async () => {
        const bootstrap = mock<StorageBootstrapService>()
        const moduleRef = await Test.createTestingModule({
            providers: [BootstrapStorageCli, { provide: StorageBootstrapService, useValue: bootstrap }],
        }).compile()

        await expect(moduleRef.get(BootstrapStorageCli).run()).resolves.toBeUndefined()

        expect(bootstrap.bootstrap).toHaveBeenCalledTimes(1)
    })
})
