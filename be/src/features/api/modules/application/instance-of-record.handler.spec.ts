import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ModuleInstallService } from "@modules/domain/modules"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InstanceOfRecordHandler } from "./instance-of-record.handler"
import { InstanceOfRecordQuery } from "./instance-of-record.query"

describe("InstanceOfRecordHandler", () => {
    it("hands the principal, workspace and record to the install service and answers it", async () => {
        const installs = mock<ModuleInstallService>()
        installs.installationOfRecord.mockResolvedValue({ installationId: "inst-1" })
        const moduleRef = await Test.createTestingModule({
            providers: [
                InstanceOfRecordHandler,
                { provide: LOGGER, useValue: mock<Logger>() },
                { provide: ModuleInstallService, useValue: installs },
            ],
        }).compile()
        const query = new InstanceOfRecordQuery({
            principal: { id: "u1", role: "authenticated" },
            request: { workspaceId: "ws-1", recordId: "rec-1" },
        })

        await expect(moduleRef.get(InstanceOfRecordHandler).execute(query)).resolves.toEqual({
            installationId: "inst-1",
        })
        expect(installs.installationOfRecord).toHaveBeenCalledWith("u1", "ws-1", "rec-1")
    })
})
