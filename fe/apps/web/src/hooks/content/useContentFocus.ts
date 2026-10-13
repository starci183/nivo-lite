import { navigation } from "@/modules/i18n"

/** Opens and closes the post editor through the shared `?focus=` address of a workbench. */
export interface ContentFocus {
    /** Opens the post with this id (keeps the tab in the address). */
    readonly open: (id: string) => void
    /** Closes the editor (removes the focus from the address). */
    readonly close: () => void
}

const addressWith = (focus: string | null): string => {
    const query = new URLSearchParams(window.location.search)
    if (focus === null) query.delete("focus")
    else query.set("focus", focus)
    const text = query.toString()
    return text === "" ? window.location.pathname : `${window.location.pathname}?${text}`
}

/** The editor is part of the address, so the server renders it with fresh data after every change. */
export const useContentFocus = (): ContentFocus => {
    const router = navigation.useRouter()
    return {
        open: (id) => router.replace(addressWith(id), { scroll: false }),
        close: () => router.replace(addressWith(null), { scroll: false }),
    }
}
