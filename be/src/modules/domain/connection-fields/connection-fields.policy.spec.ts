import { Test } from "@nestjs/testing"
import type { ConnectionRecord } from "@modules/domain/connections"
import { seededRecordOf } from "@tests/fixtures/builders/channel-connections.builder"
import type { ProviderFieldsDeclaration } from "./connection-fields.contracts"
import {
    actionInputsOf,
    actionOf,
    actionViewsOf,
    changeOf,
    declarationProblems,
    fieldViewsOf,
    isEmptyChange,
    needsStoredSecret,
    needsWebhookUrl,
    servedFormOf,
    throwFirstRefusal,
    writersProblems,
} from "./connection-fields.policy"
import { ConnectionFieldsErrorCode } from "./errors/connection-fields.error"

const SUBJECT = Symbol("connection-fields.policy")

/** The policy as Nest provides it. */
type Policy = Pick<
    typeof import("./connection-fields.policy"),
    | "actionInputsOf"
    | "actionOf"
    | "actionViewsOf"
    | "changeOf"
    | "declarationProblems"
    | "fieldViewsOf"
    | "isEmptyChange"
    | "needsStoredSecret"
    | "needsWebhookUrl"
    | "servedFormOf"
    | "writersProblems"
    | "throwFirstRefusal"
>

/** The policy as Nest provides it, built fresh for a describe block. */
const build = async (): Promise<Policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    actionInputsOf,
                    actionOf,
                    actionViewsOf,
                    changeOf,
                    declarationProblems,
                    fieldViewsOf,
                    isEmptyChange,
                    needsStoredSecret,
                    needsWebhookUrl,
                    servedFormOf,
                    throwFirstRefusal,
                    writersProblems,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Policy>(SUBJECT)
}

const WORDS = { vi: "v", en: "e" }

/** A bank-like form: a required text, an optional bounded text, a choice, an identity and two kinds of sealed secret. */
const FORM: ProviderFieldsDeclaration = {
    provider: "sepay",
    editableBy: ["owner"],
    canTest: false,
    fields: [
        { key: "bankCode", label: WORDS, kind: "text", required: true, maxLength: 5, choices: [], source: { kind: "meta", key: "bank_code" } },
        { key: "note", label: WORDS, kind: "text", required: false, maxLength: 10, choices: [], source: { kind: "meta", key: "note" } },
        {
            key: "environment",
            label: WORDS,
            kind: "choice",
            required: true,
            maxLength: null,
            choices: [
                { value: "test", label: WORDS },
                { value: "live", label: WORDS },
            ],
            source: { kind: "environment" },
        },
        { key: "oaId", label: WORDS, kind: "identity", required: false, maxLength: null, choices: [], source: { kind: "meta", key: "oa_id" } },
        {
            key: "apiKey",
            label: WORDS,
            kind: "secret",
            required: false,
            maxLength: 8,
            choices: [],
            source: { kind: "none" },
            sealedBy: { kind: "stored-secret" },
        },
        {
            key: "oaSecret",
            label: WORDS,
            kind: "secret",
            required: false,
            maxLength: 8,
            choices: [],
            source: { kind: "none" },
            sealedBy: { kind: "meta-flag", key: "oa_secret_saved" },
        },
    ],
}

const RECORD: ConnectionRecord = {
    ...seededRecordOf("c-1", "sepay", { bank_code: "VCB", oa_id: "42", oa_secret_saved: "true" }),
    name: "Vietcombank 4567",
    environment: "test",
}

describe("the connection form", () => {
    let policy: Policy

    beforeAll(async () => {
        policy = await build()
    })

    it("shows public values, never a secret, and whether each secret is sealed", () => {
        const views = policy.fieldViewsOf(FORM, RECORD, { storedSecret: false, webhookUrl: null }, true)

        expect(views.map((view) => [view.key, view.value, view.sealed, view.editable])).toEqual([
            ["bankCode", "VCB", null, true],
            ["note", null, null, true],
            ["environment", "test", null, true],
            ["oaId", "42", null, false],
            ["apiKey", null, false, true],
            ["oaSecret", null, true, true],
        ])
        expect(policy.fieldViewsOf(FORM, RECORD, { storedSecret: true, webhookUrl: null }, false).map((view) => [view.key, view.sealed, view.editable])).toContainEqual([
            "apiKey",
            true,
            false,
        ])
        expect(policy.needsStoredSecret(FORM)).toBe(true)
        expect(policy.needsStoredSecret({ ...FORM, fields: FORM.fields.slice(0, 2) })).toBe(false)
    })

    it("finds the writer that declares a provider, and none for a provider nobody declares", () => {
        const writer = { declarations: [FORM], write: () => Promise.resolve() }

        expect(policy.servedFormOf([writer], "sepay")?.declaration).toBe(FORM)
        expect(policy.servedFormOf([writer], "imap")).toBeNull()
    })
})

describe("a change checked against the form", () => {
    let policy: Policy

    beforeAll(async () => {
        policy = await build()
    })

    it("keeps only what changes: an unchanged value, an empty secret and the same name are dropped", () => {
        const change = policy.changeOf(FORM, RECORD, " Vietcombank 4567 ", [
            { key: "bankCode", value: " VCB " },
            { key: "environment", value: "live" },
            { key: "apiKey", value: "" },
            { key: "oaSecret", value: " s3cret " },
        ])

        expect(change).toEqual({ displayName: null, values: { environment: "live", oaSecret: "s3cret" } })
        expect(policy.isEmptyChange(policy.changeOf(FORM, RECORD, undefined, [{ key: "apiKey", value: "  " }]))).toBe(true)
        expect(policy.changeOf(FORM, RECORD, "ACB 9999", []).displayName).toBe("ACB 9999")
    })

    it("refuses an unknown or repeated key, an identity, an emptied required field, a value past its bound or outside its choices", () => {
        const refusalOf = (inputs: ReadonlyArray<{ key: string; value: string }>, name?: string) => {
            try {
                policy.changeOf(FORM, RECORD, name, inputs)
                return null
            } catch (refusal: unknown) {
                return refusal
            }
        }

        expect(refusalOf([{ key: "token", value: "x" }])).toMatchObject({ code: ConnectionFieldsErrorCode.FieldUnknown, params: { key: "token" } })
        expect(refusalOf([{ key: "oaId", value: "43" }])).toMatchObject({ code: ConnectionFieldsErrorCode.FieldReadOnly })
        expect(refusalOf([{ key: "bankCode", value: " " }])).toMatchObject({ code: ConnectionFieldsErrorCode.FieldRequired })
        expect(refusalOf([{ key: "note", value: "x".repeat(11) }])).toMatchObject({ params: { key: "note", reason: "too_long" } })
        expect(refusalOf([{ key: "apiKey", value: "x".repeat(9) }])).toMatchObject({ params: { key: "apiKey", reason: "too_long" } })
        expect(refusalOf([{ key: "environment", value: "prod" }])).toMatchObject({ params: { reason: "not_a_choice" } })
        expect(refusalOf([{ key: "note", value: "a" }, { key: "note", value: "b" }])).toMatchObject({ params: { reason: "twice" } })
        expect(refusalOf([], " ")).toMatchObject({ code: ConnectionFieldsErrorCode.NameInvalid })
        expect(refusalOf([{ key: "note", value: "" }])).toBeNull()
    })
})

/** A form with the declared parts the old setup steps had: a long picker, a confirmed choice, an address to copy and two actions. */
const RICH: ProviderFieldsDeclaration = {
    provider: "smtp",
    editableBy: ["owner"],
    canTest: false,
    guidance: { text: null, key: "connections.smtpPasswordStored" },
    fields: [
        { key: "hook", label: WORDS, kind: "identity", required: false, maxLength: null, choices: [], copyable: true, source: { kind: "webhook-url" } },
        {
            key: "bank",
            label: WORDS,
            kind: "choice",
            required: true,
            maxLength: null,
            choices: [{ value: "VCB", label: WORDS }],
            choiceSource: "banks",
            searchable: true,
            source: { kind: "meta", key: "bank_code" },
        },
        {
            key: "environment",
            label: WORDS,
            kind: "choice",
            required: true,
            maxLength: null,
            choices: [
                { value: "test", label: WORDS },
                { value: "live", label: WORDS, confirm: { text: null, key: "sepayConnection.liveConfirmBody" } },
            ],
            source: { kind: "environment" },
        },
        { key: "secret", label: WORDS, kind: "secret", required: false, minLength: 8, maxLength: 20, choices: [], source: { kind: "none" } },
    ],
    actions: [
        {
            key: "test_send",
            label: WORDS,
            runBy: ["owner"],
            inputs: [{ key: "to", label: WORDS, kind: "text", required: true, maxLength: 254, choices: [], source: { kind: "none" } }],
            results: [{ key: "to", label: WORDS }],
        },
        { key: "set_default", label: WORDS, runBy: ["owner", "manager"], inputs: [], results: [] },
    ],
}

/** The refusal a call throws, or null. */
const thrownBy = (call: () => unknown): unknown => {
    try {
        call()
        return null
    } catch (refusal: unknown) {
        return refusal
    }
}

describe("the declared parts of the one surface", () => {
    let policy: Policy

    beforeAll(async () => {
        policy = await build()
    })

    it("draws a searchable picker of its source, a confirmed choice, an address to copy, bounds and guidance", () => {
        const [hook, bank, environment, secret] = policy.fieldViewsOf(RICH, RECORD, { storedSecret: true, webhookUrl: "https://hook.example.test/c-1" }, true)

        expect(policy.needsWebhookUrl(RICH)).toBe(true)
        expect(hook).toMatchObject({ value: "https://hook.example.test/c-1", copyable: true, editable: false })
        expect(bank).toMatchObject({ choiceSource: "banks", searchable: true, value: "VCB" })
        expect(environment?.choices.map((choice) => choice.confirm)).toEqual([null, { text: null, key: "sepayConnection.liveConfirmBody" }])
        expect(secret).toMatchObject({ minLength: 8, maxLength: 20, sealed: true, guidance: null })
    })

    it("refuses a secret below its minimum, and a value sent back as shown changes nothing even outside the list", () => {
        const stale: ConnectionRecord = { ...RECORD, meta: { bank_code: "OLDBANK" } }

        expect(thrownBy(() => policy.changeOf(RICH, RECORD, undefined, [{ key: "secret", value: "short" }]))).toMatchObject({
            params: { key: "secret", reason: "too_short" },
        })
        expect(policy.changeOf(RICH, stale, undefined, [{ key: "bank", value: "OLDBANK" }]).values).toEqual({})
        expect(thrownBy(() => policy.changeOf(RICH, stale, undefined, [{ key: "bank", value: "XYZ" }]))).toMatchObject({
            params: { key: "bank", reason: "not_a_choice" },
        })
    })

    it("turns the first refusal of the provider's own rules into the form's error, and none into nothing", () => {
        expect(thrownBy(() => policy.throwFirstRefusal([{ key: "accountNumber", reason: "not_an_account_number" }]))).toMatchObject({
            code: ConnectionFieldsErrorCode.FieldInvalid,
            params: { key: "accountNumber", reason: "not_an_account_number" },
        })
        expect(thrownBy(() => policy.throwFirstRefusal([]))).toBeNull()
    })

    it("lists the actions with who may run them, and checks a run's inputs against the action", () => {
        const views = policy.actionViewsOf(RICH, "manager")
        const testSend = policy.actionOf(RICH, "test_send")

        expect(views.map((view) => [view.key, view.canRun, view.inputs.map((input) => input.editable)])).toEqual([
            ["test_send", false, [false]],
            ["set_default", true, []],
        ])
        expect(policy.actionInputsOf(testSend, [{ key: "to", value: " a@b.test " }])).toEqual({ to: "a@b.test" })
        expect(thrownBy(() => policy.actionInputsOf(testSend, []))).toMatchObject({ code: ConnectionFieldsErrorCode.FieldRequired, params: { key: "to" } })
        expect(thrownBy(() => policy.actionInputsOf(testSend, [{ key: "cc", value: "x" }]))).toMatchObject({ code: ConnectionFieldsErrorCode.FieldUnknown })
        expect(thrownBy(() => policy.actionOf(RICH, "rotate"))).toMatchObject({ code: ConnectionFieldsErrorCode.ActionUnknown, params: { action: "rotate" } })
    })
})

describe("the secret check of a declaration", () => {
    let policy: Policy

    beforeAll(async () => {
        policy = await build()
    })

    it("passes a form whose secrets are write-only and whose actions answer no secret", () => {
        expect(policy.declarationProblems(FORM)).toEqual([])
        expect(policy.declarationProblems(RICH)).toEqual([])
    })

    it("refuses a secret with a readable source, and an action result named like a secret field or a secret input", () => {
        const leaky: ProviderFieldsDeclaration = {
            ...RICH,
            fields: [
                ...RICH.fields,
                { key: "token", label: WORDS, kind: "secret", required: false, maxLength: 9, choices: [], source: { kind: "meta", key: "token" } },
            ],
            actions: [
                {
                    key: "reveal",
                    label: WORDS,
                    runBy: ["owner"],
                    inputs: [{ key: "otp", label: WORDS, kind: "secret", required: true, maxLength: 9, choices: [], source: { kind: "none" } }],
                    results: [
                        { key: "secret", label: WORDS },
                        { key: "otp", label: WORDS },
                        { key: "at", label: WORDS },
                    ],
                },
            ],
        }

        expect(policy.declarationProblems(leaky)).toEqual([
            { provider: "smtp", code: "secret_source_readable", key: "token" },
            { provider: "smtp", code: "action_result_secret", key: "reveal.secret" },
            { provider: "smtp", code: "action_result_secret", key: "reveal.otp" },
        ])
        expect(policy.writersProblems([{ declarations: [FORM, leaky], write: () => Promise.resolve() }]).map((problem) => problem.key)).toEqual([
            "token",
            "reveal.secret",
            "reveal.otp",
        ])
    })
})
