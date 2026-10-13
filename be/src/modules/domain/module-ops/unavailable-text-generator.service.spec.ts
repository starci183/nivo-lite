import { Test } from "@nestjs/testing"
import { UnavailableTextGeneratorService } from "./unavailable-text-generator.service"

describe("UnavailableTextGeneratorService", () => {
    it("answers that no text was written", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [UnavailableTextGeneratorService] }).compile()

        await expect(moduleRef.get(UnavailableTextGeneratorService).generate()).resolves.toEqual({
            ok: false,
            output: "",
        })
    })
})
