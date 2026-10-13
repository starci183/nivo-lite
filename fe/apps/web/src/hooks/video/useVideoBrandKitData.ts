import { useVideoBrandKit } from "./useVideoBrandKit"

/** The brand kit for a block below a gate that lets it through only once the kit is read. */
export const useVideoBrandKitData = () => {
    const kit = useVideoBrandKit()
    if (!kit.isReady || kit.brand === null) throw new Error("The brand kit was read before the gate let it through")
    return { ...kit, brand: kit.brand }
}
