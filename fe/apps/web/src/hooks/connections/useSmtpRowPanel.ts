import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { navigation } from "@/modules/i18n"
import type { Connection, RowSmtpView } from "@/modules/types"
import { useLegacyConnectionCommands } from "./useLegacyConnectionCommands"

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

/** The panel state (which form is open, its fields, its result) and the three mailbox commands of an SMTP connection row. */
export const useSmtpRowPanel = (connection: Connection, ownerEmail: string): SmtpRowPanel => {
    const t = useTranslations("connections")
    const router = navigation.useRouter()
    const commands = useLegacyConnectionCommands()
    const [isPending, startTransition] = useTransition()
    const [panel, setPanel] = useState<"test" | "password" | null>(null)
    const [to, setTo] = useState(ownerEmail)
    const [password, setPassword] = useState("")
    const [note, setNote] = useState<RowSmtpView["note"]>(null)

    const close = () => {
        setPanel(null)
        setPassword("")
    }
    const test = () =>
        startTransition(async () => {
            setNote(null)
            const result = await commands.sendSmtpTest(connection.id, to)
            if (!result.ok) return setNote({ tone: "negative", text: result.error })
            setNote({ tone: "affirmative", text: t("smtpTestOk", { to: result.data.to }) })
            router.refresh()
        })
    const savePassword = () =>
        startTransition(async () => {
            setNote(null)
            const result = await commands.changeSmtpPassword(connection.id, password)
            if (!result.ok) return setNote({ tone: "negative", text: result.error })
            close()
            setNote({ tone: "affirmative", text: t("smtpPasswordChanged") })
            router.refresh()
        })
    const makeDefault = () =>
        startTransition(async () => {
            setNote(null)
            const result = await commands.setDefaultSmtp(connection.id)
            if (!result.ok) return setNote({ tone: "negative", text: result.error })
            router.refresh()
        })

    return {
        view: {
            labels: {
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
            },
            isDefault: connection.isDefault && connection.status === "connected",
            canSetDefault: connection.status === "connected" && !connection.isDefault,
            panel,
            to,
            password,
            isPending,
            note,
        },
        setTo,
        setPassword,
        toggle: (next) => {
            setNote(null)
            setPanel(panel === next ? null : next)
        },
        close,
        test,
        savePassword,
        makeDefault,
    }
}
