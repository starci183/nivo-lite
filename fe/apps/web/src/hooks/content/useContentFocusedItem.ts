import { useContentData } from "./useContentData"

/** The post named by `?focus=` for the editor below the gate, which opens it only when the post exists. */
export const useContentFocusedItem = (focus: string | null) => {
    const data = useContentData()
    const item = data.items.find((entry) => entry.id === focus || entry.work_item_id === focus)
    if (item === undefined) throw new Error("The post was opened before the gate let it through")
    return { data, item }
}
