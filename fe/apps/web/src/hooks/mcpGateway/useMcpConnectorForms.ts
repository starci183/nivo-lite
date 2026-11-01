"use client"

import { useMutateRegisterMcpConnectorSwr, useMutateSetMcpConnectorCredentialSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import type { useQueryMcpConnectorsSwr } from "@/hooks/swr"
import type { McpTranslator } from "@/modules/mcpGateway/mcpGateway.words"

/** A text field of the register form. */
export type McpRegisterField = "key" | "name" | "url" | "contractVersion" | "credential"

/** The values of the register form; the credential is held only until it is sent, then cleared. */
type McpRegisterValues = Readonly<Record<McpRegisterField, string>>

const EMPTY: McpRegisterValues = { key: "", name: "", url: "", contractVersion: "", credential: "" }

/** The register form and the credential form of the remote MCP connectors (owner | manager). */
interface McpConnectorFormsState {
    /** The register form: its values, whether it is sending, how to change a field and how to send it. */
    readonly register: {
        readonly values: McpRegisterValues
        readonly isPending: boolean
        readonly change: (field: McpRegisterField) => (value: string) => void
        readonly submit: () => Promise<void>
    }
    /** The credential form of one connector (set or rotate), or null when none is open. */
    readonly credential: {
        readonly key: string | null
        readonly value: string
        readonly isPending: boolean
        readonly open: (key: string) => void
        readonly close: () => void
        readonly change: (value: string) => void
        readonly submit: () => Promise<void>
    }
}

/** The state of the connector forms: what is typed, what is sending, and how to send it. */
const useConnectorFormsState = (reload: () => Promise<unknown>): McpConnectorFormsState => {
    const t = useTranslations("mcpGateway")
    const runGraphQL = useGraphQLWithToast()
    const registerSwr = useMutateRegisterMcpConnectorSwr()
    const credentialSwr = useMutateSetMcpConnectorCredentialSwr()
    const [values, setValues] = useState<McpRegisterValues>(EMPTY)
    const [credentialKey, setCredentialKey] = useState<string | null>(null)
    const [credentialValue, setCredentialValue] = useState("")
    const registerTrigger = registerSwr.trigger
    const credentialTrigger = credentialSwr.trigger

    const change = useCallback(
        (field: McpRegisterField) => (value: string) => {
            setValues((current) => ({ ...current, [field]: value }))
        },
        [],
    )
    const submitRegister = useCallback(async () => {
        const credential = values.credential.trim() === "" ? null : values.credential
        setValues((current) => ({ ...current, credential: "" }))
        const done = await runGraphQL(
            () =>
                registerTrigger({
                    key: values.key.trim(),
                    name: values.name.trim(),
                    url: values.url.trim(),
                    contractVersion: values.contractVersion.trim(),
                    credential,
                }),
            { successMessage: t("registerDone") },
        )
        if (done === undefined) return
        setValues(EMPTY)
        await reload()
    }, [registerTrigger, reload, runGraphQL, t, values])
    const submitCredential = useCallback(async () => {
        if (credentialKey === null) return
        setCredentialValue("")
        const count = await runGraphQL(() => credentialTrigger({ key: credentialKey, credential: credentialValue }), {
            successMessage: t("credentialDone"),
        })
        if (count === undefined) return
        setCredentialKey(null)
        await reload()
    }, [credentialKey, credentialTrigger, credentialValue, reload, runGraphQL, t])
    const open = useCallback((key: string) => {
        setCredentialKey(key)
        setCredentialValue("")
    }, [])
    const close = useCallback(() => {
        setCredentialKey(null)
        setCredentialValue("")
    }, [])

    return {
        register: { values, isPending: registerSwr.isMutating, change, submit: submitRegister },
        credential: {
            key: credentialKey,
            value: credentialValue,
            isPending: credentialSwr.isMutating,
            open,
            close,
            change: setCredentialValue,
            submit: submitCredential,
        },
    }
}

/** One gateway connector as the `mcpConnectors` read answers it. */
type McpConnectorType = NonNullable<ReturnType<typeof useQueryMcpConnectorsSwr>["data"]>[number]

/** The words of the register form. */
const registerTextOf = (t: McpTranslator) => ({
    title: t("registerTitle"),
    hint: t("registerHint"),
    key: t("fieldKey"),
    keyHint: t("fieldKeyHint"),
    name: t("fieldName"),
    url: t("fieldUrl"),
    urlHint: t("fieldUrlHint"),
    contractVersion: t("fieldContract"),
    credential: t("fieldCredential"),
    credentialHint: t("fieldCredentialHint"),
    submit: t("register"),
})

/**
 * The connector forms as drawn: the register form, and the credential form of the connector being edited (null when none is
 * open). The credential form says Set for a connector without a stored credential and Rotate for one that has it; it never shows
 * the stored value.
 */
const formsViewOf = (t: McpTranslator, forms: McpConnectorFormsState, connectors: ReadonlyArray<McpConnectorType>) => {
    const editing = connectors.find((connector) => connector.key === forms.credential.key)
    const isSet = editing?.credentialState === "set"
    return {
        register: { values: forms.register.values, isPending: forms.register.isPending, text: registerTextOf(t) },
        credential:
            editing === undefined
                ? null
                : {
                      value: forms.credential.value,
                      isPending: forms.credential.isPending,
                      text: {
                          title: t("credentialTitle", { name: editing.name }),
                          hint: isSet ? t("rotateHint") : t("credentialHint"),
                          label: t("fieldCredential"),
                          submit: isSet ? t("rotateCredential") : t("setCredential"),
                          cancel: t("cancel"),
                      },
                  },
    }
}

/** What the connector forms report, wired to the form state. */
const formsOnOf = (forms: McpConnectorFormsState) => ({
    registerField: forms.register.change,
    register: () => void forms.register.submit(),
    credentialChange: forms.credential.change,
    credentialSubmit: () => void forms.credential.submit(),
    credentialClose: forms.credential.close,
})

/**
 * The forms of the gateway connectors, as drawn and as they report. A credential is typed once, sent once and cleared from the form
 * whatever the answer: the server seals it and never sends it back, so the console only shows whether one is set. Each send
 * reloads the connector list.
 */
export const useMcpConnectorForms = (reload: () => Promise<unknown>, connectors: ReadonlyArray<McpConnectorType>) => {
    const t = useTranslations("mcpGateway")
    const state = useConnectorFormsState(reload)
    return { openCredential: state.credential.open, view: formsViewOf(t, state, connectors), on: formsOnOf(state) }
}
