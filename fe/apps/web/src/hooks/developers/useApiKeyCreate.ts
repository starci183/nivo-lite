"use client"

import { useState } from "react"
import { useApiKeyForm } from "@/hooks/rhf"
import { FRESH_NONE, freshShown, type FreshKeyState, type KeyKind } from "./developers.shared"
import type { CreatedKey } from "./useApiKeys"

/** What the create drawer reads: the open state and the form values it draws. */
export interface ApiKeyCreateView {
    readonly isOpen: boolean
    readonly name: string
    readonly kind: KeyKind
    /** The agent the key names; `""` is none. */
    readonly agentId: string
    readonly isValid: boolean
    /** The secret just made, until it is dismissed. */
    readonly fresh: FreshKeyState
    readonly open: () => void
    readonly close: () => void
    readonly setName: (value: string) => void
    /** Picks the kind; the agent choice starts again because its meaning differs per kind. */
    readonly setKind: (value: string) => void
    readonly setAgent: (agentId: string) => void
    readonly submit: () => void
    readonly dismissFresh: () => void
}

/**
 * The create flow of an API key: the form, the drawer state and the shown-once secret. Only an owner or manager reaches it (the
 * section hides from staff and the API refuses them).
 */
export const useApiKeyCreate = (
    create: (name: string, kind: KeyKind, agentId: string | undefined) => Promise<CreatedKey | undefined>,
): ApiKeyCreateView => {
    const form = useApiKeyForm()
    const [isOpen, setIsOpen] = useState(false)
    const [fresh, setFresh] = useState<FreshKeyState>(FRESH_NONE)
    const close = () => {
        setIsOpen(false)
        form.reset()
    }
    const submit = form.handleSubmit(async (values) => {
        const created = await create(values.name, values.kind, values.agentId !== "" ? values.agentId : undefined)
        if (created === undefined) return
        setFresh(freshShown(created.secret, created.endpointUrl, created.kind))
        close()
    })
    return {
        isOpen,
        name: form.watch("name"),
        kind: form.watch("kind"),
        agentId: form.watch("agentId"),
        isValid: form.formState.isValid,
        fresh,
        open: () => setIsOpen(true),
        close,
        setName: (value) => form.setValue("name", value, { shouldValidate: true }),
        setKind: (value) => {
            form.setValue("kind", value === "public_api" ? "public_api" : "mcp")
            form.setValue("agentId", "")
        },
        setAgent: (agentId) => form.setValue("agentId", agentId),
        submit: () => void submit(),
        dismissFresh: () => setFresh(FRESH_NONE),
    }
}
