"use client"

import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import type { HiringOwner } from "./useHiringRun"
import { useCallback, useState } from "react"

/** Copies a link to the clipboard and remembers which row it was for, so that row can say "copied". */
export const useHiringCopy = (owner?: HiringOwner) => {
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const lifetime = useFeatureLifetime(owner?.isActive ?? true, owner?.scope ?? "")
    useFeatureReset({
        isActive: owner?.isActive ?? true,
        isReady: true,
        scope: owner?.scope ?? "",
        onReset: () => setCopiedId(null),
    })
    const copy = useCallback(
        (id: string, text: string) => {
            const isCurrent = lifetime.capture()
            if (!isCurrent()) return
            Promise.resolve()
                .then(() => navigator.clipboard.writeText(text))
                .then(
                    () => {
                        if (isCurrent()) setCopiedId(id)
                    },
                    () => {
                        if (isCurrent()) setCopiedId(null)
                    },
                )
        },
        [lifetime],
    )
    return { copiedId, copy }
}
