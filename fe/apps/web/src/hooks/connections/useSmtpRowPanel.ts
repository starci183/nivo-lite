"use client"

import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { useSmtpRowPasswordForm, useSmtpRowTestForm } from "@/hooks/rhf"
import { useMutateChangeSmtpPasswordSwr, useMutateSendSmtpTestSwr, useMutateSetDefaultSmtpSwr } from "@/hooks/swr"
import type { Connection, RowSmtpView } from "@/modules/types"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useConnectionsRefresh } from "./useConnectionsRefresh"

/** The SMTP part of a row: what it shows and the commands behind its buttons. */
export interface SmtpRowPanel {
    readonly view: RowSmtpView
    readonly setTo: (value: string) => void
    readonly setPassword: (value: string) => void
    readonly toggle: (panel: "test" | "password") => void
    readonly close: () => void
    readonly test: () => void
    readonly savePassword: () => void
    readonly makeDefault: () => void
}

/**
 * The panel state (which form is open, its fields, its result) and the three mailbox commands of an SMTP connection row.
 * The row calls those mutations itself. The outgoing-email wizard keeps its own copy for the connect flow, so the two
 * hook domains do not import each other.
 */
export const useSmtpRowPanel = (connection: Connection, ownerEmail: string): SmtpRowPanel => {
    const t = useTranslations("connections")
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger: sendTest } = useMutateSendSmtpTestSwr()
    const { trigger: changePassword } = useMutateChangeSmtpPasswordSwr()
    const { trigger: setDefault } = useMutateSetDefaultSmtpSwr()
    const testForm = useSmtpRowTestForm(ownerEmail)
    const passwordForm = useSmtpRowPasswordForm()
    const [isPending, startTransition] = useTransition()
    const [panel, setPanel] = useState<"test" | "password" | null>(null)
    const [note, setNote] = useState<RowSmtpView["note"]>(null)
    const to = testForm.watch("to")
    const password = passwordForm.watch("password")

    const close = () => {
        setPanel(null)
        passwordForm.reset({ password: "" })
    }
    const test = testForm.handleSubmit(
        (values) =>
            startTransition(async () => {
                setNote(null)
                const result = await settle(() =>
                    sendTest({ connectionId: connection.id, to: values.to, makeDefault: false }),
                )
                if (result.kind !== "ok") return setNote({ tone: "negative", text: result.message })
                await refresh()
                setNote({ tone: "affirmative", text: t("smtpTestOk", { to: result.value.to }) })
            }),
        (errors) => setNote({ tone: "negative", text: errors.to?.message ?? "" }),
    )
    const savePassword = passwordForm.handleSubmit(
        (values) =>
            startTransition(async () => {
                setNote(null)
                const result = await settle(() =>
                    changePassword({ connectionId: connection.id, password: values.password }),
                )
                if (result.kind !== "ok") return setNote({ tone: "negative", text: result.message })
                await refresh()
                close()
                setNote({ tone: "affirmative", text: t("smtpPasswordChanged") })
            }),
        (errors) => setNote({ tone: "negative", text: errors.password?.message ?? "" }),
    )
    const makeDefault = () =>
        startTransition(async () => {
            setNote(null)
            const result = await settle(() => setDefault({ connectionId: connection.id }))
            if (result.kind !== "ok") return setNote({ tone: "negative", text: result.message })
            await refresh()
        })

    return {
        view: {
            labels: {
                ...labelsOf(t),
            },
            isDefault: connection.isDefault && connection.status === "connected",
            canSetDefault: connection.status === "connected" && !connection.isDefault,
            panel,
            to,
            password,
            isPending,
            note,
        },
        setTo: (value) => testForm.setValue("to", value),
        setPassword: (value) => passwordForm.setValue("password", value),
        toggle: (next) => {
            setNote(null)
            setPanel(panel === next ? null : next)
        },
        close,
        test: () => void test(),
        savePassword: () => void savePassword(),
        makeDefault,
    }
}

/** Resolves the action labels for the current locale. */
const labelsOf = (t: ReturnType<typeof useTranslations<"connections">>) => ({
    defaultBadge: t("smtpDefault"),
    test: t("smtpTest"),
    changePassword: t("smtpChangePassword"),
    setDefault: t("smtpSetDefault"),
    testTo: t("smtpTestTo"),
    testSend: t("smtpTestSend"),
    newPassword: t("smtpNewPassword"),
    passwordStored: t("smtpPasswordStored"),
    savePassword: t("smtpSavePassword"),
    cancel: t("cancel"),
})
