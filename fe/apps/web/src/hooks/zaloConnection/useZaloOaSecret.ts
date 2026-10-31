"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useSettledGraphQL, useZaloFailureLabel } from "@/hooks/connection-wizard"
import { useMutateSaveZaloOaSecretSwr } from "@/hooks/swr"
import { useZaloPage } from "./useZaloPage"

/**
 * The OA Secret Key of the second setup step: the key typed on the page, and the save that stores it and reads the page again. Without
 * it the back end refuses every Zalo webhook, whose signature it checks with this key.
 */
export const useZaloOaSecret = (connectionId: string) => {
    const t = useTranslations("zaloConnection")
    const settle = useSettledGraphQL()
    const labelOf = useZaloFailureLabel()
    const { reload } = useZaloPage(connectionId)
    const { trigger, isMutating } = useMutateSaveZaloOaSecretSwr()
    const [value, setValue] = useState("")
    const [error, setError] = useState("")

    const change = useCallback((next: string) => {
        setValue(next)
        setError("")
    }, [])

    const save = useCallback(async (): Promise<void> => {
        const oaSecret = value.trim()
        if (oaSecret === "") return setError(t("oaSecretRequired"))
        const result = await settle(() => trigger({ connectionId, oaSecret }), t("toastOaSecretSaved"))
        if (result.kind !== "ok") return setError(labelOf(result.code, result.message))
        setValue("")
        reload()
    }, [value, settle, trigger, connectionId, t, labelOf, reload])

    return { value, change, save, error, isSaving: isMutating }
}
