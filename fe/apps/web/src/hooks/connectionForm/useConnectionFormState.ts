"use client"

import { useLocale, useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { useSettledGraphQL, type Settled } from "@/hooks/connection-wizard"
import { useConnectionsRefresh } from "@/hooks/connections"
import { connectionCheckOf } from "@/hooks/connection-wire"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import {
    QUERY_SEPAY_CONNECTION_SWR_KEY,
    QUERY_TELEGRAM_CONNECTION_PAGE_SWR_KEY,
    QUERY_ZALO_CONNECTION_PAGE_SWR_KEY,
    QUERY_ZALO_CONNECTION_SWR_KEY,
    useMutateCheckConnectionSwr,
    useMutateRunConnectionActionSwr,
    useMutateUpdateConnectionSwr,
    useQueryConnectionFieldsSwr,
} from "@/hooks/swr"
import { graphQLErrorParams } from "@/modules/failure"
import { matchesSwrKey } from "@/modules/utils"
import { mutate as mutateAll } from "@/modules/viewer-cache"
import type { ConnectionCheck, ConnectionFormView, DataSlot } from "@/modules/types"
import {
    CONNECTION_FORM_ERROR_KEYS,
    CONNECTION_FORM_PLACEHOLDER,
    EMPTY_DRAFT,
    NO_ERRORS,
    actionInputsOf,
    canRunOf,
    canSaveOf,
    changedFieldsOf,
    confirmOfChange,
    connectionFormViewOf,
    nameChangedOf,
    type ConnectionActionResults,
    type ConnectionFormData,
    type ConnectionFormDraft,
    type ConnectionFormErrors,
    type ConnectionFormWords,
} from "./connectionForm.shared"

/** The question a change or an action asks before it goes: its words, and what it does when answered yes. */
export interface ConnectionFormQuestion {
    readonly description: string
    readonly isPending: boolean
}

/** What the "Ket noi" card draws and what the page head's two commands read and do. */
export interface ConnectionFormState {
    readonly slot: DataSlot<ConnectionFormView>
    readonly placeholder: ConnectionFormView
    /** The viewer may save: the head shows "Luu" (it is enabled only when something valid changed). */
    readonly canEdit: boolean
    readonly isSaveEnabled: boolean
    readonly isSaving: boolean
    /** The provider has a connection check: the head shows "Kiem tra ket noi". */
    readonly canTest: boolean
    readonly isTesting: boolean
    /** The action that is running, if one is. */
    readonly runningAction: string | null
    /** The question open before a save or an action goes; null when none. */
    readonly question: ConnectionFormQuestion | null
    readonly retry: () => void
    readonly on: {
        readonly name: (value: string) => void
        readonly field: (key: string, value: string) => void
        readonly input: (action: string, key: string, value: string) => void
        readonly save: () => void
        readonly test: () => void
        readonly run: (action: string) => void
        readonly answerYes: () => void
        readonly answerNo: () => void
    }
}

/** What waits for the answer to a question: the save, or one action. */
type Asked = { readonly kind: "save"; readonly description: string } | { readonly kind: "action"; readonly key: string; readonly description: string }

/** The verdict of a check as a sentence: the last error, the local-development note, or that the connection answers. */
const verdictOf = (check: ConnectionCheck, say: (key: string, values?: Record<string, string>) => string): string => {
    if (check.lastError !== null) return say("formCheckError", { error: check.lastError })
    if (check.localOnly) return say("formCheckLocal")
    return say("formCheckOk")
}

/** The line a refused field shows: required, outside the API's limits, not a choice, sent twice, not an account number or key, unknown or read-only. */
const fieldMessageOf = (
    code: string,
    params: Readonly<Record<string, string>>,
    data: ConnectionFormData | undefined,
    t: (key: string, values?: Record<string, string | number>) => string,
): string | null => {
    switch (code) {
        case "CONNECTION_FIELDS_FIELD_REQUIRED":
            return t("formRequired")
        case "CONNECTION_FIELDS_FIELD_INVALID": {
            const field = data?.fields.find((candidate) => candidate.key === params.key)
            const max = field?.maxLength
            const min = field?.minLength
            switch (params.reason) {
                case "too_long":
                    return max !== null && max !== undefined ? t("formTooLong", { max }) : t("formErrorInvalid")
                case "too_short":
                    return min !== null && min !== undefined ? t("formTooShort", { min }) : t("formErrorInvalid")
                case "not_a_choice":
                    return t("formErrorNotChoice")
                case "not_an_account_number":
                    return t("formErrorNotAccount")
                case "not_a_key":
                    return t("formErrorNotKey")
                case "twice":
                    return t("formErrorTwice")
                case undefined:
                    return t("formErrorInvalid")
                default:
                    return t("formErrorInvalid")
            }
        }
        case "CONNECTION_FIELDS_FIELD_READ_ONLY":
            return t("formErrorFieldReadOnly")
        case "CONNECTION_FIELDS_FIELD_UNKNOWN":
            return t("formErrorFieldUnknown")
        default:
            return null
    }
}

/** Fills the `{name}` tokens of a catalogue sentence from known values; null when a token has no value (the sentence is not ready). */
const filledOf = (sentence: string, values: Readonly<Record<string, string>>): string | null => {
    let missing = false
    const text = sentence.replaceAll(/\{(\w+)\}/g, (_token, name: string) => {
        const value = values[name]
        if (value === undefined) missing = true
        return value ?? ""
    })
    return missing ? null : text
}

/**
 * The form of the account the address names: the `connectionFields` read, the draft the member types, the one save that sends only
 * what changed (a secret only when typed), the question a chosen option asks first, the account's declared actions, the re-read after
 * a save, errors put on the field the back end names, and the connection check. The page head and the card share this state through
 * one context. The back end checks the whole change before it writes anything, so a refused save wrote nothing.
 */
export const useConnectionFormState = (connectionId: string): ConnectionFormState => {
    const t = useTranslations("providerPage")
    const catalogue = useTranslations()
    const locale = useLocale()
    const read = useQueryConnectionFieldsSwr(connectionId === "" ? null : connectionId)
    const settle = useSettledGraphQL()
    const update = useMutateUpdateConnectionSwr()
    const run = useMutateRunConnectionActionSwr()
    const check = useMutateCheckConnectionSwr()
    const [draft, setDraft] = useState<ConnectionFormDraft>(EMPTY_DRAFT)
    const [errors, setErrors] = useState<ConnectionFormErrors>(NO_ERRORS)
    const [notice, setNotice] = useState<string | null>(null)
    const [results, setResults] = useState<ConnectionActionResults>({})
    const [runningAction, setRunningAction] = useState<string | null>(null)
    const [asked, setAsked] = useState<Asked | null>(null)
    const refreshList = useConnectionsRefresh()
    const { mutate } = read

    /** What other parts of the page read about the account (its name and status in the band, a provider's own steps) is read again after a change. */
    const refreshAround = useCallback(
        (): Promise<unknown> =>
            Promise.all([
                refreshList(),
                ...[
                    QUERY_SEPAY_CONNECTION_SWR_KEY,
                    QUERY_ZALO_CONNECTION_SWR_KEY,
                    QUERY_ZALO_CONNECTION_PAGE_SWR_KEY,
                    QUERY_TELEGRAM_CONNECTION_PAGE_SWR_KEY,
                ].map((key) => mutateAll(matchesSwrKey(key))),
            ]),
        [refreshList],
    )
    const data: ConnectionFormData | undefined = read.data

    const words: ConnectionFormWords = useMemo(() => {
        const values: Record<string, string> = {}
        for (const field of data?.fields ?? []) if (field.kind !== "secret" && field.value !== null) values[field.key] = field.value
        for (const list of Object.values(results)) for (const result of list) if (result.value !== null) values[result.key] = result.value
        return {
            locale,
            required: t("formRequired"),
            tooLong: (max: number) => t("formTooLong", { max }),
            tooShort: (min: number) => t("formTooShort", { min }),
            catalogue: (key: string) => (catalogue.has(key) ? filledOf(catalogue.raw(key) as string, values) : null),
        }
    }, [locale, t, catalogue, data, results])

    const failed = useCallback(
        (outcome: Extract<Settled<unknown>, { kind: "failed" }>, params: Readonly<Record<string, string>>, scope: string): void => {
            const code = outcome.code
            const key = code === undefined ? undefined : CONNECTION_FORM_ERROR_KEYS[code]
            const fieldKey = params.key
            const fieldLine = code === undefined || fieldKey === undefined ? null : fieldMessageOf(code, params, data, t)
            const generalOf = (): string | null => {
                if (fieldLine !== null) return null
                if (key === undefined) return outcome.message
                return t(key)
            }
            setErrors({
                name: code === "CONNECTION_FIELDS_NAME_INVALID" ? t("formErrorName") : null,
                fields: fieldLine === null || fieldKey === undefined ? {} : { [scope === "" ? fieldKey : `${scope}.${fieldKey}`]: fieldLine },
                general: generalOf(),
            })
        },
        [data, t],
    )

    const doSave = useCallback((): void => {
        if (data === undefined || !canSaveOf(data, draft, words)) return
        const fields = changedFieldsOf(data, draft)
        const renamed = nameChangedOf(data, draft)
        let params: Readonly<Record<string, string>> = {}
        setErrors(NO_ERRORS)
        setNotice(null)
        void settle(async () => {
            try {
                return await update.trigger({
                    connectionId,
                    ...(renamed ? { displayName: (draft.name ?? "").trim() } : {}),
                    fields: [...fields],
                })
            } catch (error) {
                params = graphQLErrorParams(error)
                throw error
            }
        }, t("formSaved")).then(async (outcome) => {
            if (outcome.kind === "ok") {
                await mutate(outcome.value, { revalidate: false })
                setDraft(EMPTY_DRAFT)
                await refreshAround()
                return
            }
            failed(outcome, params, "")
        })
    }, [data, draft, words, settle, update, connectionId, t, mutate, refreshAround, failed])

    const doRun = useCallback(
        (key: string): void => {
            const action = data?.actions.find((candidate) => candidate.key === key)
            if (data === undefined || action === undefined || !canRunOf(action, draft, words)) return
            let params: Readonly<Record<string, string>> = {}
            setErrors(NO_ERRORS)
            setNotice(null)
            setRunningAction(key)
            void settle(async () => {
                try {
                    return await run.trigger({ connectionId, action: key, fields: [...actionInputsOf(action, draft)] })
                } catch (error) {
                    params = graphQLErrorParams(error)
                    throw error
                }
            }).then(async (outcome) => {
                setRunningAction(null)
                if (outcome.kind === "ok") {
                    setResults((current) => ({ ...current, [key]: outcome.value.results }))
                    await mutate(outcome.value.form, { revalidate: false })
                    await refreshAround()
                    return
                }
                failed(outcome, params, key)
            })
        },
        [data, draft, words, settle, run, connectionId, mutate, refreshAround, failed],
    )

    const save = useCallback((): void => {
        if (data === undefined || !canSaveOf(data, draft, words)) return
        const question = confirmOfChange(data, draft, words)
        if (question === null) doSave()
        else setAsked({ kind: "save", description: question })
    }, [data, draft, words, doSave])

    const runAction = useCallback(
        (key: string): void => {
            const action = data?.actions.find((candidate) => candidate.key === key)
            if (action === undefined) return
            const lang = locale === "en" ? "en" : "vi"
            const question =
                action.confirm === null ? null : (words.catalogue(action.confirm.key ?? "") ?? action.confirm.text?.[lang] ?? null)
            if (question === null) doRun(key)
            else setAsked({ kind: "action", key, description: question })
        },
        [data, words, locale, doRun],
    )

    const test = useCallback((): void => {
        setErrors(NO_ERRORS)
        setNotice(null)
        void settle(() => check.trigger({ connectionId })).then((outcome) => {
            if (outcome.kind === "ok") {
                setNotice(verdictOf(connectionCheckOf(outcome.value), (key, values) => t(key, values)))
                return
            }
            setErrors({ ...NO_ERRORS, general: outcome.message })
        })
    }, [settle, check, connectionId, t])

    return {
        slot: mapSlot(slotOfSwr(read), (form) => connectionFormViewOf(form, draft, errors, notice, results, words)),
        placeholder: CONNECTION_FORM_PLACEHOLDER,
        canEdit: data !== undefined && data.canEdit && data.writable,
        isSaveEnabled: data !== undefined && canSaveOf(data, draft, words) && !update.isMutating,
        isSaving: update.isMutating,
        canTest: data !== undefined && data.canTest && data.canEdit,
        isTesting: check.isMutating,
        runningAction,
        question: asked === null ? null : { description: asked.description, isPending: update.isMutating || runningAction !== null },
        retry: () => void read.mutate(),
        on: {
            name: (value) => {
                setErrors((current) => ({ ...current, name: null, general: null }))
                setDraft((current) => ({ ...current, name: value }))
            },
            field: (key, value) => {
                setErrors((current) => ({
                    ...current,
                    general: null,
                    fields: Object.fromEntries(Object.entries(current.fields).filter(([k]) => k !== key)),
                }))
                setDraft((current) => ({ ...current, values: { ...current.values, [key]: value } }))
            },
            input: (action, key, value) => {
                setDraft((current) => ({
                    ...current,
                    inputs: { ...current.inputs, [action]: { ...current.inputs[action], [key]: value } },
                }))
            },
            save,
            test,
            run: runAction,
            answerYes: () => {
                setAsked(null)
                if (asked === null) return
                if (asked.kind === "save") doSave()
                else doRun(asked.key)
            },
            answerNo: () => setAsked(null),
        },
    }
}
