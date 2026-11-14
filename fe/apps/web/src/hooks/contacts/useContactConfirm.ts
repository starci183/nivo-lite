"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { ContactCommands } from "./useContactCommands"
import type { ContactConfirmView, ContactDetailView, ContactsPanesBaseProps } from "@/modules/types"

/** A question waiting for the yes of the person: what it is about decides the words and the command. */
export type ContactAsking =
    | { readonly kind: "delete" }
    | { readonly kind: "unlink"; readonly identityId: string; readonly title: string }
    | { readonly kind: "merge"; readonly fromId: string; readonly from: string }

/** What the person is asked before an irreversible change and the commands that answer it. */
export interface ContactConfirmState {
    readonly confirm: ContactConfirmView | undefined
    /** Asks the question; the page shows it until it is accepted or cancelled. */
    readonly ask: (asking: ContactAsking) => void
    readonly on: Pick<ContactsPanesBaseProps["on"], "acceptConfirm" | "cancelConfirm">
}

/** What the commands behind each question need to know of the page. */
interface ContactConfirmInput {
    readonly detail: ContactDetailView | undefined
    readonly commands: ContactCommands
    /** Opens a person's page (the survivor of a merge). */
    readonly open: (contactId: string) => void
    /** Goes back to the list (after a delete). */
    readonly openList: () => void
}

/** The question asked for what waits for a yes, in the words of the person. */
const confirmOf = (
    asking: ContactAsking | undefined,
    detail: ContactDetailView | undefined,
    isPending: boolean,
    t: ReturnType<typeof useTranslations<"contacts">>,
): ContactConfirmView | undefined => {
    if (asking === undefined || detail === undefined) return undefined
    if (asking.kind === "delete") {
        return {
            title: t("deleteTitle", { name: detail.name }),
            description: t("deleteBody"),
            confirmLabel: t("deleteConfirm"),
            kind: "danger",
            isPending,
        }
    }
    if (asking.kind === "unlink") {
        return {
            title: t("unlinkTitle", { identity: asking.title, name: detail.name }),
            description: t("unlinkBody"),
            confirmLabel: t("unlinkConfirm"),
            kind: "danger",
            isPending,
        }
    }
    return {
        title: t("mergeConfirmTitle", { from: asking.from, into: detail.name }),
        description: t("mergeConfirmBody"),
        confirmLabel: t("mergeConfirm"),
        kind: "danger",
        isPending,
    }
}

/** The questions before a delete, an unlink and a merge: what is asked, and what runs when the person says yes. */
export const useContactConfirm = (input: ContactConfirmInput): ContactConfirmState => {
    const t = useTranslations("contacts")
    const [asking, setAsking] = useState<ContactAsking>()
    const { detail, commands } = input
    const answer = async (): Promise<void> => {
        if (asking === undefined || detail === undefined) return
        if (asking.kind === "delete" && (await commands.remove(detail.id))) input.openList()
        if (asking.kind === "unlink") await commands.unlink(detail.id, asking.identityId)
        if (asking.kind === "merge") {
            const survivor = await commands.merge(asking.fromId, detail.id)
            if (survivor !== undefined && survivor !== detail.id) input.open(survivor)
        }
        setAsking(undefined)
    }
    return {
        confirm: confirmOf(asking, detail, commands.isPending, t),
        ask: setAsking,
        on: { acceptConfirm: () => void answer(), cancelConfirm: () => setAsking(undefined) },
    }
}
