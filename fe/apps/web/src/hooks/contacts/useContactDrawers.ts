"use client"

import { useState } from "react"
import { useContactEditForm, useContactLinkForm } from "@/hooks/rhf"
import { tagsOfText } from "@/modules/contacts"
import type { ContactCommands } from "./useContactCommands"
import type { ContactDetailView, ContactEditView, ContactLinkView, ContactsPanesBaseProps } from "@/modules/types"

/** The edit and link drawers: what they show and the commands that drive them. */
export interface ContactDrawersState {
    readonly edit: ContactEditView
    readonly link: ContactLinkView
    readonly on: Pick<
        ContactsPanesBaseProps["on"],
        | "openEdit"
        | "closeEdit"
        | "setEditName"
        | "setEditTags"
        | "submitEdit"
        | "openLink"
        | "closeLink"
        | "setLinkKind"
        | "setLinkValue"
        | "submitLink"
    >
}

/** What the drawers need of the page. */
interface ContactDrawersInput {
    readonly detail: ContactDetailView | undefined
    readonly commands: ContactCommands
    /** Opens a person's page (the survivor when linking an identity merged two people). */
    readonly open: (contactId: string) => void
}

/**
 * The drawers that edit the open person and link a phone or an e-mail to them: each is a form, validated before it asks the back end,
 * closed once the command worked. A link that merged two people opens the person who survived.
 */
export const useContactDrawers = (input: ContactDrawersInput): ContactDrawersState => {
    const [isEditing, setIsEditing] = useState(false)
    const [isLinking, setIsLinking] = useState(false)
    const { detail, commands } = input
    const editStart = { name: detail?.displayName ?? "", tags: detail?.tags.join(", ") ?? "" }
    const editForm = useContactEditForm(editStart)
    const linkForm = useContactLinkForm()
    const submitEdit = editForm.handleSubmit(async (values) => {
        const done = await commands.update(detail?.id ?? "", {
            displayName: values.name,
            tags: tagsOfText(values.tags),
        })
        if (done) setIsEditing(false)
    })
    const submitLink = linkForm.handleSubmit(async (values) => {
        const survivor = await commands.link(detail?.id ?? "", values)
        if (survivor === undefined) return
        setIsLinking(false)
        linkForm.reset()
        if (survivor !== detail?.id) input.open(survivor)
    })
    return {
        edit: {
            isOpen: isEditing,
            name: editForm.watch("name"),
            tags: editForm.watch("tags"),
            isPending: commands.isPending,
            error: editForm.formState.errors.name?.message ?? editForm.formState.errors.tags?.message,
        },
        link: {
            isOpen: isLinking,
            kind: linkForm.watch("kind"),
            value: linkForm.watch("value"),
            isPending: commands.isPending,
            error: linkForm.formState.errors.value?.message,
        },
        on: {
            openEdit: () => {
                editForm.reset(editStart)
                setIsEditing(true)
            },
            closeEdit: () => setIsEditing(false),
            setEditName: (value) => editForm.setValue("name", value, { shouldDirty: true }),
            setEditTags: (value) => editForm.setValue("tags", value, { shouldDirty: true }),
            submitEdit: () => void submitEdit(),
            openLink: () => setIsLinking(true),
            closeLink: () => {
                setIsLinking(false)
                linkForm.reset()
            },
            setLinkKind: (value) => {
                if (value === "phone" || value === "email") linkForm.setValue("kind", value)
            },
            setLinkValue: (value) =>
                linkForm.setValue("value", value, { shouldValidate: linkForm.formState.isSubmitted }),
            submitLink: () => void submitLink(),
        },
    }
}
