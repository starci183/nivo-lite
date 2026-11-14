import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ModuleInstallService } from "@modules/domain/modules"
import { RecordTypesPageService } from "./record-types-page.service"

describe("RecordTypesPageService", () => {
    it("lists the modules the workspace installed, once each, and nothing for a module no installed plugin declares", async () => {
        const installs = mock<ModuleInstallService>()
        installs.list.mockResolvedValue([])
        const moduleRef = await Test.createTestingModule({
            providers: [RecordTypesPageService, { provide: ModuleInstallService, useValue: installs }],
        }).compile()

        await expect(moduleRef.get(RecordTypesPageService).list("user-1", "ws-1")).resolves.toEqual([])
        expect(installs.list).toHaveBeenCalledWith("user-1", "ws-1")
    })
})
