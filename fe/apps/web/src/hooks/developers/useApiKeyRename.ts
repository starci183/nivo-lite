"use client"

import { useState } from "react"
import { useApiKeyRenameForm } from "@/hooks/rhf"
import type { ApiKeyWire } from "./developers.shared"

/** What the rename drawer reads: the key being renamed, if any, and the one field. */
export interface ApiKeyRenameView {
    /** The key being renamed; the drawer is open while there is one. */
    readonly key: ApiKeyWire | undefined
    readonly name: string
    readonly isValid: boolean
    readonly ask: (keyId: string) => void
    readonly setName: (value: string) => void
    readonly close: () => void
    readonly submit: () => void
}

/** The rename flow of an API key: which key, the form and the commit; the drawer closes when the rename was saved. */
export const useApiKeyRename = (
    items: ReadonlyArray<ApiKeyWire>,
    rename: (keyId: string, name: string) => Promise<boolean>,
): ApiKeyRenameView => {
    const form = useApiKeyRenameForm()
    const [keyId, setKeyId] = useState<string>()
    const close = () => {
        setKeyId(undefined)
        form.reset()
    }
    const submit = form.handleSubmit(async (values) => {
        if (keyId !== undefined && (await rename(keyId, values.name))) close()
    })
    return {
        key: items.find((item) => item.id === keyId),
        name: form.watch("name"),
        isValid: form.formState.isValid,
        ask: (id) => {
            setKeyId(id)
            form.reset({ name: items.find((item) => item.id === id)?.name ?? "" })
        },
        setName: (value) => form.setValue("name", value, { shouldValidate: true }),
        close,
        submit: () => void submit(),
    }
}
