import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MODEL_PROFILES } from "@modules/integrations/ai-gateway"
import { INGESTION_TARGET } from "./ingestion-model.policy"

const SUBJECT = Symbol("ingestion-model.policy")

describe("ingestion-model.policy: the decisions of the ingestion run on the strong model (owner 2026-11-12)", () => {
    it("names the Sonnet 5.5 profile and the Anthropic wire (no sampling, no forced tool choice): the effort policy builds the body", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: mock<typeof import("./ingestion-model.policy")>({ INGESTION_TARGET }) }] }).compile()
        expect(moduleRef.get<typeof import("./ingestion-model.policy")>(SUBJECT).INGESTION_TARGET).toEqual({
            name: MODEL_PROFILES.sonnet,
            sampling: false,
            forcedToolChoice: false,
            upstreamFields: false,
        })
    })
})
