import { useContentWorkbench } from "./useContentWorkbench"

/** The workbench data for a block below the content gate, which renders it only once the data is there. */
export const useContentData = () => {
    const { data } = useContentWorkbench()
    if (data === undefined) throw new Error("The content workbench was read before the gate let it through")
    return data
}
