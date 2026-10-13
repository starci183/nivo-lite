import { useTranslations } from "next-intl"
import type { CopyLabels } from "@/modules/types"

/** The words of an in-field copy action, in the reader's language. */
export const useCopyLabels = (): CopyLabels => {
    const t = useTranslations("connectionWizard")
    return { copy: t("copy"), copied: t("copied"), reveal: t("reveal"), hide: t("hide") }
}
