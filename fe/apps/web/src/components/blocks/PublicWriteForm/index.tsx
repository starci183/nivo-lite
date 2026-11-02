"use client"

import { useTranslations } from "next-intl"
import { usePublicWriteController } from "@/hooks/brain"
import { toast } from "@/modules/toast"
import { PublicWriteFormBase } from "./component"

/** Props for the connected write form: whether the address asks for it, and the title it starts with. */
interface PublicWriteFormProps {
    /** The `compose` of the address is `write`. */
    readonly isOpen: boolean
    /** The `title` of the address: the customer question being answered; empty when none. */
    readonly initialTitle: string
}

/**
 * The connected form in which the owner writes a public document by hand. It is written separately: it is never an internal document
 * made public. It is saved as a draft; customers read it only after the owner approves it.
 */
export const PublicWriteForm = (props: PublicWriteFormProps) => {
    const t = useTranslations("publicBrain")
    const feedback = useTranslations("toast")
    const controller = usePublicWriteController(props.initialTitle)
    if (!controller.canWrite) return null
    return (
        <PublicWriteFormBase
            props={{
                isOpen: props.isOpen,
                isPending: controller.isPending,
                title: t("writeTitle"),
                closeLabel: t("cancel"),
                cancelLabel: t("cancel"),
                submitLabel: t("writeSubmit"),
                note: t("writeNote"),
                titleLabel: t("writeTitleLabel"),
                bodyLabel: t("writeBodyLabel"),
                docTitle: controller.title,
                body: controller.body,
                error: controller.error,
                failTitle: t("loadFailed"),
            }}
            on={{
                close: controller.close,
                submit: () => {
                    controller.submit().catch(() => {
                        toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
                    })
                },
                setTitle: controller.setTitle,
                setBody: controller.setBody,
            }}
        />
    )
}
