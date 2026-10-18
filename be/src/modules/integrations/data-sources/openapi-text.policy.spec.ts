import { Test } from "@nestjs/testing"
import { trimUrlSlashes } from "./openapi-text.policy"

const SUBJECT = Symbol("openapi-text.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { trimUrlSlashes } }],
    }).compile()
    return moduleRef.get<typeof import("./openapi-text.policy")>(SUBJECT)
}

describe("OpenAPI URL text", () => {
    it.each<[string, string]>([
        ["", ""],
        ["///", ""],
        ["https://api.example/a//b", "https://api.example/a//b"],
        ["https://api.example/a//b///", "https://api.example/a//b"],
        [`https://api.example${"/".repeat(100_000)}`, "https://api.example"],
    ])("removes only trailing URL slashes (%#)", async (input, expected) => {
        const subject = await buildSubject()
        expect(subject.trimUrlSlashes(input)).toBe(expected)
    })
})
