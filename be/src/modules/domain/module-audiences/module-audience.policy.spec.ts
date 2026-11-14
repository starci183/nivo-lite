import { Test } from "@nestjs/testing"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { catalogAudienceOf as realCatalogAudienceOf } from "./module-audience.policy"

const SUBJECT = Symbol("module-audience.policy")
type Subject = { catalogAudienceOf: typeof realCatalogAudienceOf }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { catalogAudienceOf: realCatalogAudienceOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("catalogAudienceOf", () => {
    it("answers the audience each installed module's template declares", async () => {
        const subject = await buildSubject()

        for (const server of INSTALLED.servers()) {
            expect(subject.catalogAudienceOf(server.key)).toBe(server.template.audience)
        }
    })

    it("answers null for a key no installed module carries", async () => {
        const subject = await buildSubject()

        expect(subject.catalogAudienceOf("nonsense")).toBeNull()
    })
})
