import type { ProviderTemplate } from "./installation.types"
import { defineInstallation } from "./installation"
import { defineProviderTemplate } from "./provider-template"

/** The error a call throws. */
function captured(call: () => unknown): unknown {
    try {
        call()
    } catch (error) {
        return error
    }
    return undefined
}

const DOCUMENT = { openapi: "3.1.0", info: { title: "Shop CRM", version: "1" }, paths: { "/products": { get: {} } } }

const template: ProviderTemplate = {
    kind: "crm",
    id: "shopcrm",
    label: { vi: "CRM c\u1eeda h\u00e0ng", en: "Shop CRM" },
    openapi: DOCUMENT,
    swaggerPath: "/openapi.json",
    auth: { type: "header", name: "X-Api-Key" },
    baseUrlHint: "https://crm.example.test/v1",
}

const refusal = (changed: Partial<ProviderTemplate>): unknown =>
    captured(() => defineProviderTemplate({ ...template, ...changed }))

describe("defineProviderTemplate", () => {
    it("answers a well-formed CRM template as given", () => {
        expect(defineProviderTemplate(template)).toBe(template)
        expect(
            defineProviderTemplate({ ...template, auth: { type: "bearer" }, docs: "https://docs.example.test" }),
        ).toMatchObject({ id: "shopcrm" })
    })

    it("refuses a malformed id, swagger path, header name, label or document, naming the template", () => {
        const at = "provider:crm:shopcrm"
        expect(refusal({ id: "Shop CRM" })).toMatchObject({
            code: "ID_MALFORMED",
            params: { at: "provider:crm:Shop CRM" },
        })
        expect(refusal({ swaggerPath: "openapi.json" })).toMatchObject({ code: "ID_MALFORMED", params: { at } })
        expect(refusal({ swaggerPath: "/openapi.json?x=1" })).toMatchObject({ code: "ID_MALFORMED", params: { at } })
        expect(refusal({ auth: { type: "header", name: "X Api Key" } })).toMatchObject({
            code: "ID_MALFORMED",
            params: { at },
        })
        expect(refusal({ label: { vi: " ", en: "Shop CRM" } })).toMatchObject({ code: "ID_MALFORMED", params: { at } })
        expect(refusal({ openapi: { swagger: "2.0", paths: {} } })).toMatchObject({
            code: "ID_MALFORMED",
            params: { at },
        })
        expect(refusal({ openapi: { openapi: "3.1.0" } })).toMatchObject({ code: "ID_MALFORMED", params: { at } })
    })
})

describe("an installation's provider templates", () => {
    it("lists each template once and names the plugin that declares it", () => {
        const installed = defineInstallation([{ key: "core" }, { key: "shop", providers: [template] }], "")

        expect(installed.providers).toEqual([template])
        expect(installed.plugins.map((plugin) => [plugin.key, plugin.providers])).toEqual([
            ["core", []],
            ["shop", ["shopcrm"]],
        ])
    })

    it("refuses one template id two plugins declare", () => {
        expect(
            captured(() =>
                defineInstallation(
                    [
                        { key: "one", providers: [template] },
                        { key: "two", providers: [template] },
                    ],
                    "",
                ),
            ),
        ).toMatchObject({
            code: "INSTALLATION_ID_DUPLICATE",
        })
    })
})
