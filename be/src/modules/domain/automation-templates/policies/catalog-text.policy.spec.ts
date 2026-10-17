import { Test } from "@nestjs/testing"
import { AutomationTemplatesErrorCode } from "../errors/automation-templates.error"
import { AUTOMATION_TEMPLATES_MESSAGES } from "../messages/automation-templates.messages"
import { translate as translateImplementation } from "./catalog-text.policy"

const SUBJECT = Symbol("subject")
type Subject = { translate: typeof translateImplementation }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { translate: translateImplementation } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("translate", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("reads the same catalog key in Vietnamese and English", async () => {
        const subject = await buildSubject()

        expect(subject.translate("errors.AUTOMATION_TEMPLATES_TEMPLATE_UNKNOWN")).toEqual({
            vi: "Kh\u00f4ng c\u00f3 m\u1eabu t\u1ef1 \u0111\u1ed9ng ho\u00e1 n\u00e0y.",
            en: "There is no such automation template.",
        })
    })

    it("identifies an unknown catalog key as invalid template text", async () => {
        const subject = await buildSubject()

        expect(() => subject.translate("automationTemplates.missing.name")).toThrow(
            expect.objectContaining({
                code: AutomationTemplatesErrorCode.DefinitionInvalid,
                params: { key: "automationTemplates.missing.name", field: "text" },
            }),
        )
    })

    it.each(["vi", "en"] as const)("refuses a catalog key without its %s translation", async (locale) => {
        const subject = await buildSubject()

        jest.replaceProperty(AUTOMATION_TEMPLATES_MESSAGES, locale, {})

        expect(() => subject.translate("errors.AUTOMATION_TEMPLATES_TEMPLATE_UNKNOWN")).toThrow(
            expect.objectContaining({
                code: AutomationTemplatesErrorCode.DefinitionInvalid,
                params: { key: "errors.AUTOMATION_TEMPLATES_TEMPLATE_UNKNOWN", field: "text" },
            }),
        )
    })
})
