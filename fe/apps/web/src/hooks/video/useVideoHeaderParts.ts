import { useTranslations } from "next-intl"
import { useVideoLibrary } from "./useVideoLibrary"

/** The video part of a workbench header: the figures of the ribbon and the tabs. */
export const useVideoHeaderParts = () => {
    const t = useTranslations("video")
    const library = useVideoLibrary()
    return {
        figures: library.figures,
        figuresFailed: library.figuresFailed,
        isLoading: library.isLoading,
        tabs: [
            { id: "library", label: t("tabVideos") },
            { id: "brand", label: t("tabBrand") },
        ],
    }
}
