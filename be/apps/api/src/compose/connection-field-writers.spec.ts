import { Test } from "@nestjs/testing"
import { declarationProblems, type ConnectionFieldWriter, type ProviderFieldsDeclaration } from "@modules/domain/connection-fields"
import { CONNECTION_FIELD_WRITER_CLASSES } from "./connections"

/** Every form the api registers, read from the writers themselves (their services doubled: only the declarations are read). */
const installedForms = async (): Promise<ReadonlyArray<ProviderFieldsDeclaration>> => {
    const app = await Test.createTestingModule({ providers: [...CONNECTION_FIELD_WRITER_CLASSES] })
        .useMocker(() => ({}))
        .compile()
    return CONNECTION_FIELD_WRITER_CLASSES.flatMap((writer) => app.get<ConnectionFieldWriter>(writer).declarations)
}

/** A fixture form that answers a secret from an action: never installed, it proves the assertion below turns red. */
const PLANTED: ProviderFieldsDeclaration = {
    provider: "planted",
    editableBy: ["owner"],
    canTest: false,
    fields: [{ key: "token", label: { vi: "v", en: "e" }, kind: "secret", required: false, maxLength: 9, choices: [], source: { kind: "none" } }],
    actions: [{ key: "reveal", label: { vi: "v", en: "e" }, runBy: ["owner"], inputs: [], results: [{ key: "token", label: { vi: "v", en: "e" } }] }],
}

describe("the connection forms the api registers", () => {
    it("every installed provider form passes the secret check (this spec, in the tests block of app check, is the release gate)", async () => {
        const forms = await installedForms()

        expect(forms.map((form) => form.provider)).toEqual(["sepay", "casso", "payos", "zalo_oa", "smtp", "elevenlabs", "veo", "tiktok", "shotstack", "creatomate", "json2video"])
        expect(forms.flatMap((form) => declarationProblems(form))).toEqual([])
    })

    it("turns red on a bad form: the same assertion over the installed forms plus a planted one finds its problem", async () => {
        const forms = [...(await installedForms()), PLANTED]

        expect(forms.flatMap((form) => declarationProblems(form))).toEqual([
            { provider: "planted", code: "action_result_secret", key: "reveal.token" },
        ])
    })
})
