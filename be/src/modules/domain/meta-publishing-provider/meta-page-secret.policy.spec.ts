import { Test } from "@nestjs/testing"
import { metaPageSecretOf as realPageSecretOf } from "./meta-page-secret.policy"

const SUBJECT = Symbol("meta-page-secret.policy")

const buildSubject = async (): Promise<typeof realPageSecretOf> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: realPageSecretOf }] }).compile()
    return moduleRef.get<typeof realPageSecretOf>(SUBJECT)
}

describe("metaPageSecretOf", () => {
    it("reads the chosen Page and its token from the sealed credential, the Page list left out", async () => {
        const pageSecretOf = await buildSubject()

        expect(pageSecretOf(JSON.stringify({ pages: [{ id: "p-1" }], pageId: "p-1", pageToken: "tok" }))).toEqual({
            pageId: "p-1",
            pageToken: "tok",
        })
    })

    it("chose no Page for an empty, unreadable or not-yet-chosen secret", async () => {
        const pageSecretOf = await buildSubject()

        for (const plain of ["", "not json", "[]", "null", JSON.stringify({ pages: [] }), JSON.stringify({ pageId: 7 })]) {
            expect(pageSecretOf(plain)).toEqual({})
        }
    })
})
