import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InstanceOfRecordHandler } from "./instance-of-record.handler"
import { InstanceOfRecordQuery } from "./instance-of-record.query"
import { InstanceOfRecordService } from "./instance-of-record.service"

describe("InstanceOfRecordHandler", () => {
    it("hands the principal, workspace and record to the lookup and answers it", async () => {
        const records = mock<InstanceOfRecordService>()
        records.installationOfRecord.mockResolvedValue({ installationId: "inst-1" })
        const moduleRef = await Test.createTestingModule({
            providers: [
                InstanceOfRecordHandler,
                { provide: LOGGER, useValue: mock<Logger>() },
                { provide: InstanceOfRecordService, useValue: records },
            ],
        }).compile()
        const query = new InstanceOfRecordQuery({
            principal: { id: "u1", role: "authenticated" },
            request: { workspaceId: "ws-1", recordId: "rec-1" },
        })

        await expect(moduleRef.get(InstanceOfRecordHandler).execute(query)).resolves.toEqual({
            installationId: "inst-1",
        })
        expect(records.installationOfRecord).toHaveBeenCalledWith("u1", "ws-1", "rec-1")
    })
})
