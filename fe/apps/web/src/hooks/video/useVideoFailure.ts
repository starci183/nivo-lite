import { useTranslations } from "next-intl"
import { useCallback } from "react"

const FAILURE_KEYS: Readonly<Record<string, string>> = {
    VIDEO_SCRIPT_TIMEOUT: "lastError_scriptSlow",
    VIDEO_SCRIPT_FAILED: "lastError_scriptFailed",
    VIDEO_SCRIPT_FORMAT: "lastError_scriptFormat",
    VIDEO_SCRIPT_SUPERSEDED: "lastError_scriptBusy",
    VIDEO_RENDER_FAILED: "lastError_renderFailed",
}

/** Turns a failure code of a video action into a sentence of the video catalog (an unknown code gets the default sentence). */
export const useVideoFailure = (): ((code: string) => string) => {
    const t = useTranslations("video")
    return useCallback(
        (code: string) => {
            const key = FAILURE_KEYS[code]
            if (key) return t(key)
            if (t.has(`lastError_${code}`)) return t(`lastError_${code}`)
            return t.has(`err_${code}`) ? t(`err_${code}`) : t("err_default")
        },
        [t],
    )
}
