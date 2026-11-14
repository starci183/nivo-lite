import { Test } from "@nestjs/testing"
import { ENTERPRISE_KEY_MAX, isEnterpriseKey } from "./workspace-enterprise.policy"

const SUBJECT = Symbol("workspace-enterprise.policy")

/** The functions of the policy under test, as Nest provides them. */
interface Subject {
    readonly isEnterpriseKey: typeof isEnterpriseKey
}

/** The subject, built the way Nest provides it. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isEnterpriseKey } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("isEnterpriseKey", () => {
    it.each(["nivo-web", "a", "shop2", "big-co-2026"])("takes the lowercase slug %s", async (key) => {
        const subject = await build()
        expect(subject.isEnterpriseKey(key)).toBe(true)
    })

    it.each(["", "Nivo-Web", "nivo web", "-nivo", "nivo-", "nivo--web", "9lives", "nivo_web"])("refuses %s", async (key) => {
        const subject = await build()
        expect(subject.isEnterpriseKey(key)).toBe(false)
    })

    it("refuses a slug longer than the bound", async () => {
        const subject = await build()
        expect(subject.isEnterpriseKey("a".repeat(ENTERPRISE_KEY_MAX))).toBe(true)
        expect(subject.isEnterpriseKey("a".repeat(ENTERPRISE_KEY_MAX + 1))).toBe(false)
    })
})
