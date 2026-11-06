import { createContext, useContext } from "react"
import type { Provider } from "react"

/** Whether the block is drawn inside the one surface card of its list pane: its rows then need no card of their own. */
const InSurface = createContext<boolean>(false)

/** Marks the blocks under it as drawn inside an existing surface card. */
export const InSurfaceProvider: Provider<boolean> = InSurface.Provider

/** Whether the block sits inside a surface card that its pane draws. */
export const useInSurface = (): boolean => useContext(InSurface)
