import { Test } from "@nestjs/testing"
import { catalogAudienceOf as realCatalogAudienceOf, MODULE_AUDIENCES } from "./module-audience.policy"

const SUBJECT = Symbol("module-audience.policy")
type Subject = { catalogAudienceOf: typeof realCatalogAudienceOf }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { catalogAudienceOf: realCatalogAudienceOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("catalogAudienceOf", () => {
    it("answers the audience of a catalogued module", async () => {
        const subject = await buildSubject()

        expect(subject.catalogAudienceOf("chatbot")).toBe("customer")
        expect(subject.catalogAudienceOf("accounting")).toBe("internal")
    })

    it("answers null for a key the catalogue does not carry", async () => {
        const subject = await buildSubject()

        expect(subject.catalogAudienceOf("nonsense")).toBeNull()
    })

    it("carries one audience for each of the eleven modules", () => {
        expect(Object.keys(MODULE_AUDIENCES)).toHaveLength(11)
    })
})
