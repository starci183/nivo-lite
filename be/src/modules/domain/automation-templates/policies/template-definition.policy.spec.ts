import { Test } from "@nestjs/testing"
import { AutomationTemplatesErrorCode } from "../errors/automation-templates.error"
import { parseTemplateDefinition as parseTemplateDefinitionImplementation } from "./template-definition.policy"

const SUBJECT = Symbol("subject")
type Subject = { parseTemplateDefinition: typeof parseTemplateDefinitionImplementation }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parseTemplateDefinition: parseTemplateDefinitionImplementation } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const text = { vi: "Hello there", en: "Hello" }

const valid = () => ({
    key: "thank_payment",
    version: 1,
    position: 1,
    pack: "core",
    executor: "implemented",
    moduleKey: "accounting",
    icon: "payment",
    name: text,
    description: text,
    trigger: { kind: "event", event: "payment.received", line: text },
    requires: { modules: ["accounting"], channels: ["customer_chat"], connections: [], capabilities: [] },
    settings: [{ key: "minAmount", kind: "number", label: text, min: 0, max: 10 }],
    contentMode: "fixed",
    guardrails: [text],
    variables: ["ten_khach"],
    defaultBody: text,
    authority: { action: "send_care" },
    defaults: { minAmount: 0, offer: "", enabled: true },
})

describe("parseTemplateDefinition", () => {
    it("answers a valid definition as it is", async () => {
        const subject = await buildSubject()

        const definition = valid()
        expect(subject.parseTemplateDefinition(definition)).toBe(definition)
    })

    it("accepts a workspace-wide template with no body and no action, and an n8n template with its webhook", async () => {
        const subject = await buildSubject()

        const workspaceWide = { ...valid(), moduleKey: null, defaultBody: null, authority: { action: null } }
        expect(subject.parseTemplateDefinition(workspaceWide)).toBe(workspaceWide)
        const n8n = { ...valid(), executor: "n8n", n8n: { webhook: "nivo/email-daily-report", audience: "owner" } }
        expect(subject.parseTemplateDefinition(n8n)).toBe(n8n)
    })

    it.each([
        ["version", { version: -1 }],
        ["version", { version: 1.5 }],
        ["position", { position: "1" }],
        ["pack", { pack: "" }],
        ["executor", { executor: "robot" }],
        ["moduleKey", { moduleKey: 4 }],
        ["icon", { icon: undefined }],
        ["name", { name: { vi: "x" } }],
        ["description", { description: "plain" }],
        ["trigger", { trigger: { kind: "never", event: "x", line: text } }],
        ["trigger", { trigger: null }],
        ["requires", { requires: { modules: [], channels: [], connections: [] } }],
        ["requires", { requires: { modules: [1], channels: [], connections: [], capabilities: [] } }],
        ["settings", { settings: [{ key: "a", kind: "dial", label: text }] }],
        ["settings", { settings: "none" }],
        ["settings", { settings: [null] }],
        ["contentMode", { contentMode: "loud" }],
        ["guardrails", { guardrails: [{ vi: "only" }] }],
        ["variables", { variables: "ten_khach" }],
        ["defaultBody", { defaultBody: { vi: "x", en: "" } }],
        ["authority", { authority: { action: 3 } }],
        ["authority", { authority: null }],
        ["defaults", { defaults: { a: { nested: true } } }],
        ["defaults", { defaults: null }],
        ["n8n", { executor: "n8n" }],
        ["n8n", { executor: "n8n", n8n: { webhook: "x", audience: "world" } }],
    ])("names the field %s when it is wrong (%j)", async (field, patch) => {
        const subject = await buildSubject()

        expect(() => subject.parseTemplateDefinition({ ...valid(), ...patch })).toThrow(
            expect.objectContaining({
                code: AutomationTemplatesErrorCode.DefinitionInvalid,
                params: { key: "thank_payment", field },
            }),
        )
    })

    it.each([[{ ...valid(), key: "Bad Key" }], [{ ...valid(), key: undefined }], ["text"], [null]])(
        "refuses a definition whose key is not a template key (%j)",
        async (raw) => {
            const subject = await buildSubject()

            expect(() => subject.parseTemplateDefinition(raw)).toThrow(
                expect.objectContaining({ code: AutomationTemplatesErrorCode.DefinitionInvalid }),
            )
        },
    )

    it("names an unreadable key with a question mark", async () => {
        const subject = await buildSubject()

        expect(() => subject.parseTemplateDefinition(null)).toThrow(
            expect.objectContaining({ params: { key: "?", field: "key" } }),
        )
    })
})
