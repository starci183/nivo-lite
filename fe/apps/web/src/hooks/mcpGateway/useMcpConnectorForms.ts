"use client"

import { useTranslations } from "next-intl"
import { useMcpConnectorFormsState } from "./useMcpConnectorFormsState"
import type { McpConnectorFormsState, McpRegisterField } from "./useMcpConnectorFormsState"
import type { useQueryMcpConnectorsSwr } from "@/hooks/swr"
import type { McpTranslator } from "@/modules/mcpGateway"

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

type UseMcpConnectorFormsResult = {
    openCredential: (key: string) => void
    view: {
        register: {
            values: Readonly<Record<McpRegisterField, string>>
            isPending: boolean
            text: {
                title: string
                hint: string
                key: string
                keyHint: string
                name: string
                url: string
                urlHint: string
                contractVersion: string
                credential: string
                credentialHint: string
                submit: string
            }
        }
        credential: {
            value: string
            isPending: boolean
            text: {
                title: string
                hint: string
                label: string
                submit: string
                cancel: string
            }
        } | null
    }
    on: {
        registerField: (field: McpRegisterField) => (value: string) => void
        register: () => undefined
        credentialChange: (value: string) => void
        credentialSubmit: () => undefined
        credentialClose: () => void
    }
}

/**
 * The forms of the gateway connectors, as drawn and as they report. A credential is typed once, sent once and cleared from the form
 * whatever the answer: the server seals it and never sends it back, so the console only shows whether one is set. Each send
 * reloads the connector list.
 */
export const useMcpConnectorForms = (
    reload: () => Promise<unknown>,
    connectors: ReadonlyArray<McpConnectorType>,
): UseMcpConnectorFormsResult => {
    const t = useTranslations("mcpGateway")
    const state = useMcpConnectorFormsState(reload)
    return { openCredential: state.credential.open, view: formsViewOf(t, state, connectors), on: formsOnOf(state) }
}
