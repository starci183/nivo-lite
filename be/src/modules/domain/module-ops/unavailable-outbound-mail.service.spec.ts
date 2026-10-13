import { Test } from "@nestjs/testing"
import { UnavailableOutboundMailService } from "./unavailable-outbound-mail.service"

describe("UnavailableOutboundMailService", () => {
    it("answers that the mail was not sent", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [UnavailableOutboundMailService] }).compile()

        await expect(moduleRef.get(UnavailableOutboundMailService).send()).resolves.toEqual({
            status: "failed",
            error: "unavailable",
        })
    })
})
