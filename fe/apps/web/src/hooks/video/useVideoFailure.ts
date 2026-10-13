import { useTranslations } from "next-intl"

/** Turns a failure code of a video action into a sentence of the video catalog (an unknown code gets the default sentence). */
export const useVideoFailure = (): ((code: string) => string) => {
    const t = useTranslations("video")
    return (code) => (t.has(`err_${code}`) ? t(`err_${code}`) : t("err_default"))
}
