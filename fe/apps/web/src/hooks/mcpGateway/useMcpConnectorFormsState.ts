"use client"

import { useMutateRegisterMcpConnectorSwr, useMutateSetMcpConnectorCredentialSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

/** A text field of the register form. */
export type McpRegisterField = "key" | "name" | "url" | "contractVersion" | "credential"

/** The values of the register form; the credential is held only until it is sent, then cleared. */
export type McpRegisterValues = Readonly<Record<McpRegisterField, string>>

const EMPTY: McpRegisterValues = { key: "", name: "", url: "", contractVersion: "", credential: "" }

/** The register form and the credential form of the remote MCP connectors (owner | manager). */
export interface McpConnectorFormsState {
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
export const useMcpConnectorFormsState = (reload: () => Promise<unknown>): McpConnectorFormsState => {
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
