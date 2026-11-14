import { Test } from "@nestjs/testing"
import { crmProviderKeyOf } from "@nivo-lite/agent-sdk/names"
import { INSTALLED } from "@modules/domain/installed-plugins"
import {
    INSTALLED_OPENAPI_ABILITIES,
    OPENAPI_PROVIDER,
    CRM_TEMPLATES,
    crmTemplateOf,
    crmTemplateOpenTo,
    OPENAPI_SOURCE_KEYS,
    declarationsOf,
    installedDeclarationsOf,
    openApiAbilitiesOf,
} from "./openapi-declaration.policy"

const SUBJECT = Symbol("openapi-declaration.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { declarationsOf, openApiAbilitiesOf } }],
    }).compile()
    return moduleRef.get<typeof import("./openapi-declaration.policy")>(SUBJECT)
}

const KEY = "crm.nivoweb"

const TOOLS = [
    { id: "nivo.api.crm.nivoweb.get.customers.code", mutates: false },
    { id: "nivo.api.crm.nivoweb.post.services.code.reminders", mutates: true },
    { id: "nivo.api.crm.nivoweb.post.services.code.renewals", mutates: true },
    { id: "nivo.api.crm.nivoweb.get.invoice-drafts.id", mutates: false },
    { id: "nivo.api.crm.nivoweb.delete.customers.code", mutates: true },
    { id: "nivo.api.crm.shopcrm.get.customers", mutates: false },
    { id: "nivo.api.crm.nivowebx.get.customers", mutates: false },
    { id: "nivo.tool.team.message.post", mutates: true },
    { id: "nivo.tool.invoice.create", mutates: true },
]

describe("declarationsOf", () => {
    it("selects only the operations under nivo.api.<provider key>., each named by the rest of its name", async () => {
        const subject = await build()
        const declarations = subject.declarationsOf(KEY, TOOLS)

        expect(declarations.map((declaration) => declaration.name)).toEqual([
            "get.customers.code",
            "post.services.code.reminders",
            "post.services.code.renewals",
            "get.invoice-drafts.id",
            "delete.customers.code",
        ])
        expect(declarations[0]).toEqual({
            tool: "nivo.api.crm.nivoweb.get.customers.code",
            connector: KEY,
            name: "get.customers.code",
            reads: true,
        })
        expect(declarations[2]).toMatchObject({ reads: false })
    })

    it("keeps one CRM's operations apart from another's, a CRM id that only starts like it included", async () => {
        const subject = await build()

        expect(subject.declarationsOf("crm.shopcrm", TOOLS).map((declaration) => declaration.tool)).toEqual(["nivo.api.crm.shopcrm.get.customers"])
        expect(subject.declarationsOf("crm.nivowebx", TOOLS).map((declaration) => declaration.tool)).toEqual(["nivo.api.crm.nivowebx.get.customers"])
        expect(subject.declarationsOf("crm.erp", TOOLS)).toEqual([])
    })

    it("lists no purpose: a tool outside a CRM's operations is no declaration of any CRM", async () => {
        const subject = await build()

        expect(subject.declarationsOf(KEY, TOOLS).some((declaration) => declaration.tool.startsWith("nivo.tool."))).toBe(false)
        expect(subject.declarationsOf("invoice", TOOLS)).toEqual([])
    })
})

describe("openApiAbilitiesOf", () => {
    it("gives every declared operation an ability of its own, named by the operation: a read, or a write when it writes", async () => {
        const subject = await build()
        expect(subject.openApiAbilitiesOf(subject.declarationsOf(KEY, TOOLS))).toEqual([
            { id: "nivo.api.crm.nivoweb.get.customers.code", scope: "read", tools: ["nivo.api.crm.nivoweb.get.customers.code"] },
            {
                id: "nivo.api.crm.nivoweb.post.services.code.reminders",
                scope: "write",
                tools: ["nivo.api.crm.nivoweb.post.services.code.reminders"],
            },
            {
                id: "nivo.api.crm.nivoweb.post.services.code.renewals",
                scope: "write",
                tools: ["nivo.api.crm.nivoweb.post.services.code.renewals"],
            },
            { id: "nivo.api.crm.nivoweb.get.invoice-drafts.id", scope: "read", tools: ["nivo.api.crm.nivoweb.get.invoice-drafts.id"] },
            { id: "nivo.api.crm.nivoweb.delete.customers.code", scope: "write", tools: ["nivo.api.crm.nivoweb.delete.customers.code"] },
        ])
        expect(subject.openApiAbilitiesOf([])).toEqual([])
    })
})

describe("the installed declarations", () => {
    it("serve exactly the CRMs the installed plugins declare, by their provider key (`crm.<id>`), never nivo", () => {
        expect(OPENAPI_PROVIDER).toBe("openapi")
        expect(CRM_TEMPLATES).toEqual(INSTALLED.providers().filter((template) => template.kind === "crm"))
        expect(OPENAPI_SOURCE_KEYS).toEqual(CRM_TEMPLATES.map((template) => crmProviderKeyOf(template.id)))
        expect(crmTemplateOf(KEY)?.id).toBe("nivoweb")
        expect(crmTemplateOf("crm.own-shop")).toBeNull()
        expect(OPENAPI_SOURCE_KEYS).toContain(KEY)
        expect(OPENAPI_SOURCE_KEYS).not.toContain("nivo")
    })

    it("are exactly the operations the installed plugins declare under the served CRMs, each under its CRM's own prefix", () => {
        const declarations = OPENAPI_SOURCE_KEYS.flatMap((source) => installedDeclarationsOf(source))
        const tools = declarations.map((declaration) => declaration.tool)

        expect(INSTALLED_OPENAPI_ABILITIES.flatMap((ability) => ability.tools).toSorted()).toEqual(tools.toSorted())
        expect(declarations.length).toBeGreaterThan(0)
        expect(declarations.filter((declaration) => !declaration.tool.startsWith(`nivo.api.${declaration.connector}.`))).toEqual([])
        expect(new Set(tools).size).toBe(tools.length)
    })
})

describe("crmTemplateOpenTo: a CRM template is open where the plugin that declares it is", () => {
    it("opens a private plugin's template only to the enterprises it names, and no template no plugin declares", () => {
        // nivo-web-core is private to the enterprise `nivo-web` and declares the template `nivoweb`.
        expect(crmTemplateOpenTo("nivoweb", "nivo-web")).toBe(true)
        expect(crmTemplateOpenTo("nivoweb", null)).toBe(false)
        expect(crmTemplateOpenTo("nivoweb", "other-enterprise")).toBe(false)
        expect(crmTemplateOpenTo("own-shop", "nivo-web")).toBe(false)
    })
})
