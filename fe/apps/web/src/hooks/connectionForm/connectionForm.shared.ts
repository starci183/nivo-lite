import type { useQueryConnectionFieldsSwr } from "@/hooks/swr"
import { registryWordsOf } from "@/hooks/providerOffer"
import type {
    ConnectionFormActionView,
    ConnectionFormFieldView,
    ConnectionFormResultView,
    ConnectionFormView,
} from "@/modules/types"

/** The form of one account as the back end answers it (the read, the save and an action answer this shape). */
export type ConnectionFormData = Exclude<ReturnType<typeof useQueryConnectionFieldsSwr>["data"], undefined>

/** One declared field, and one declared action. */
export type ConnectionFieldData = ConnectionFormData["fields"][number]
type ActionData = ConnectionFormData["actions"][number]

/** A text of the API: its own words in two languages, or the key of an entry of the web catalogue (`namespace.key`). */
type DeclaredText = { readonly key?: string | null; readonly text?: { readonly vi: string; readonly en: string } | null } | null | undefined

/** What the member typed and not saved yet: the display name (null = untouched), the fields by key, and each action's inputs. */
export interface ConnectionFormDraft {
    readonly name: string | null
    readonly values: Readonly<Record<string, string>>
    readonly inputs: Readonly<Record<string, Readonly<Record<string, string>>>>
}

/** No change yet. */
export const EMPTY_DRAFT: ConnectionFormDraft = { name: null, values: {}, inputs: {} }

/** The errors the last save or the typing left: per field, on the name, and one general line. */
export interface ConnectionFormErrors {
    readonly name: string | null
    readonly fields: Readonly<Record<string, string>>
    readonly general: string | null
}

/** No error. */
export const NO_ERRORS: ConnectionFormErrors = { name: null, fields: {}, general: null }

/** The results of each action's last run, by action key. */
export type ConnectionActionResults = Readonly<Record<string, ReadonlyArray<{ readonly key: string; readonly label: { readonly vi: string; readonly en: string }; readonly value: string | null }>>>

/** The words the pure checks need. */
export interface ConnectionFormWords {
    readonly locale: string
    readonly required: string
    readonly tooLong: (max: number) => string
    readonly tooShort: (min: number) => string
    /** A catalogue entry by its `namespace.key`; null when the web has none. */
    readonly catalogue: (key: string) => string | null
}

/** A declared text in the reader's language: the API's words, else the web catalogue entry the key names; null when there is none. */
export const declaredTextOf = (text: DeclaredText, words: ConnectionFormWords): string | null => {
    if (text === null || text === undefined) return null
    const own = text.text === null || text.text === undefined ? null : registryWordsOf(text.text, words.locale)
    if (own !== null) return own
    return text.key === null || text.key === undefined ? null : words.catalogue(text.key)
}

/** Whether the viewer may edit this field of this account. */
const isEditableField = (data: ConnectionFormData, field: ConnectionFieldData): boolean =>
    data.canEdit && data.writable && field.editable && field.kind !== "identity"

/** The text a field shows: the draft; else what the API read (never for a secret, which stays empty until typed). */
const shownValueOf = (field: ConnectionFieldData, typed: string | undefined): string =>
    typed ?? (field.kind === "secret" ? "" : (field.value ?? ""))

/** The fields whose draft differs from what was read: a secret counts once something is typed; an empty secret keeps the sealed one. */
export const changedFieldsOf = (
    data: ConnectionFormData,
    draft: ConnectionFormDraft,
): ReadonlyArray<{ readonly key: string; readonly value: string }> =>
    data.fields.flatMap((field) => {
        if (!isEditableField(data, field)) return []
        const typed = draft.values[field.key]
        if (typed === undefined) return []
        const changed = field.kind === "secret" ? typed !== "" : typed !== (field.value ?? "")
        return changed ? [{ key: field.key, value: typed }] : []
    })

/** The question a change asks first: the `confirm` of the option the member chose, for a choice that changed; null when none asks. */
export const confirmOfChange = (data: ConnectionFormData, draft: ConnectionFormDraft, words: ConnectionFormWords): string | null => {
    for (const change of changedFieldsOf(data, draft)) {
        const field = data.fields.find((candidate) => candidate.key === change.key)
        const option = field?.choices.find((choice) => choice.value === change.value)
        const question = declaredTextOf(option?.confirm, words)
        if (question !== null) return question
    }
    return null
}

/** Whether the display name was changed to something else. */
export const nameChangedOf = (data: ConnectionFormData, draft: ConnectionFormDraft): boolean =>
    data.canEdit && data.writable && draft.name !== null && draft.name.trim() !== data.displayName

/** The error a typed value has on its own: required, shorter or longer than the API's limits. */
const limitErrorOf = (field: ConnectionFieldData, value: string, words: ConnectionFormWords): string | null => {
    if (field.required && field.kind !== "secret" && value.trim() === "") return words.required
    if (field.maxLength !== null && value.length > field.maxLength)
        return words.tooLong(field.maxLength)
    if (field.minLength !== null && value !== "" && value.length < field.minLength)
        return words.tooShort(field.minLength)
    return null
}

/** The error a field's draft has on its own, per key; empty when none. */
export const fieldErrorsOf = (
    data: ConnectionFormData,
    draft: ConnectionFormDraft,
    words: ConnectionFormWords,
): Readonly<Record<string, string>> =>
    Object.fromEntries(
        data.fields.flatMap((field): Array<[string, string]> => {
            const typed = draft.values[field.key]
            if (!isEditableField(data, field) || typed === undefined) return []
            const error = limitErrorOf(field, typed, words)
            return error === null ? [] : [[field.key, error]]
        }),
    )

/** What the member may save now: something changed and nothing typed is refused by the limits the API declared. */
export const canSaveOf = (data: ConnectionFormData, draft: ConnectionFormDraft, words: ConnectionFormWords): boolean => {
    if (!data.canEdit || !data.writable) return false
    const nameBlank = draft.name !== null && draft.name.trim() === ""
    const changed = nameChangedOf(data, draft) || changedFieldsOf(data, draft).length > 0
    return changed && !nameBlank && Object.keys(fieldErrorsOf(data, draft, words)).length === 0
}

/** The inputs an action sends: every declared input with the typed or read value (an empty one is left out). */
export const actionInputsOf = (
    action: ActionData,
    draft: ConnectionFormDraft,
): ReadonlyArray<{ readonly key: string; readonly value: string }> =>
    action.inputs.flatMap((input) => {
        const value = draft.inputs[action.key]?.[input.key] ?? (input.kind === "secret" ? "" : (input.value ?? ""))
        return value === "" ? [] : [{ key: input.key, value }]
    })

/** Whether every required input of an action has a value and none breaks its limits. */
export const canRunOf = (action: ActionData, draft: ConnectionFormDraft, words: ConnectionFormWords): boolean =>
    action.canRun &&
    action.inputs.every((input) => {
        const value = draft.inputs[action.key]?.[input.key] ?? (input.value ?? "")
        return limitErrorOf(input, value, words) === null
    })

/** One field of the card (or one input of an action) as the view draws it. */
const fieldViewOf = (
    field: ConnectionFieldData,
    typed: string | undefined,
    isReadOnly: boolean,
    error: string | null,
    words: ConnectionFormWords,
): ConnectionFormFieldView => ({
    key: field.key,
    kind: field.kind === "secret" || field.kind === "choice" || field.kind === "identity" ? field.kind : "text",
    label: registryWordsOf(field.label, words.locale) ?? field.key,
    value: shownValueOf(field, typed),
    isRequired: field.required,
    minLength: field.minLength ?? null,
    maxLength: field.maxLength ?? null,
    isReadOnly,
    isSealed: field.sealed === true,
    isSearchable: field.searchable,
    isCopyable: field.copyable,
    choiceSource: field.choiceSource ?? null,
    guidance: declaredTextOf(field.guidance, words),
    choices: field.choices.map((choice) => ({
        id: choice.value,
        label: registryWordsOf(choice.label, words.locale) ?? choice.value,
        confirm: declaredTextOf(choice.confirm, words),
    })),
    error,
})

/** The card's view from the read, the draft, the errors and the last results of each action. */
export const connectionFormViewOf = (
    data: ConnectionFormData,
    draft: ConnectionFormDraft,
    errors: ConnectionFormErrors,
    notice: string | null,
    results: ConnectionActionResults,
    words: ConnectionFormWords,
): ConnectionFormView => {
    const typedErrors = fieldErrorsOf(data, draft, words)
    const canEditName = data.canEdit && data.writable
    const nameBlank = draft.name !== null && draft.name.trim() === ""
    return {
        name: {
            value: draft.name ?? data.displayName,
            isReadOnly: !canEditName,
            error: nameBlank ? words.required : errors.name,
        },
        guidance: declaredTextOf(data.guidance, words),
        fields: data.fields.map((field) =>
            fieldViewOf(
                field,
                draft.values[field.key],
                !isEditableField(data, field),
                typedErrors[field.key] ?? errors.fields[field.key] ?? null,
                words,
            ),
        ),
        actions: data.actions.map(
            (action): ConnectionFormActionView => ({
                key: action.key,
                label: registryWordsOf(action.label, words.locale) ?? action.key,
                canRun: canRunOf(action, draft, words),
                guidance: declaredTextOf(action.guidance, words),
                confirm: declaredTextOf(action.confirm, words),
                inputs: action.inputs.map((input) =>
                    fieldViewOf(
                        input,
                        draft.inputs[action.key]?.[input.key],
                        !action.canRun,
                        errors.fields[`${action.key}.${input.key}`] ?? null,
                        words,
                    ),
                ),
                results: (results[action.key] ?? []).flatMap(
                    (result): ConnectionFormResultView[] =>
                        result.value === null
                            ? []
                            : [{ key: result.key, label: registryWordsOf(result.label, words.locale) ?? result.key, value: result.value }],
                ),
            }),
        ),
        notice: errors.general ?? notice,
    }
}

/** The same shape with no words: the skeleton keeps the ready tree (a name and two text fields). */
export const CONNECTION_FORM_PLACEHOLDER: ConnectionFormView = {
    name: { value: "-", isReadOnly: false, error: null },
    guidance: null,
    fields: ["a", "b"].map(
        (key): ConnectionFormFieldView => ({
            key,
            kind: "text",
            label: "-",
            value: "-",
            isRequired: false,
            minLength: null,
            maxLength: null,
            isReadOnly: false,
            isSealed: false,
            isSearchable: false,
            isCopyable: false,
            choiceSource: null,
            guidance: null,
            choices: [],
            error: null,
        }),
    ),
    actions: [],
    notice: null,
}

/** The message key (inside `providerPage`) of each refusal that is not about one field. */
export const CONNECTION_FORM_ERROR_KEYS: Readonly<Record<string, string>> = {
    CONNECTION_FIELDS_NOT_WRITABLE: "formErrorNotWritable",
    CONNECTION_FIELDS_FORBIDDEN: "formErrorForbidden",
    CONNECTION_FIELDS_FIELD_UNKNOWN: "formErrorFieldUnknown",
    CONNECTION_FIELDS_FIELD_READ_ONLY: "formErrorFieldReadOnly",
    CONNECTION_FIELDS_ACTION_UNKNOWN: "formErrorActionUnknown",
    CHANNEL_CONNECTIONS_ACCOUNT_INVALID: "formErrorAccountInvalid",
    CHANNEL_CONNECTIONS_API_KEY_INVALID: "formErrorApiKeyInvalid",
    CHANNEL_CONNECTIONS_BANK_FIELDS_MISSING: "formErrorBankFields",
    EMAIL_MESSAGES_SMTP_PASSWORD: "formErrorSmtpPassword",
    EMAIL_MESSAGES_SMTP_EMAIL: "formErrorSmtpEmail",
    EMAIL_MESSAGES_SMTP_NOT_CONNECTED: "formErrorSmtpNotConnected",
    CONNECTIONS_FORBIDDEN: "formErrorForbidden",
    CONNECTIONS_NOT_FOUND: "formErrorNotFound",
    WORKSPACE_MEMBERS_NOT_MEMBER: "formErrorNotMember",
}
