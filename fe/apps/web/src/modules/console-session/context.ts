import { createContext, type Context } from "react"
import type { ConsoleSessionView } from "@/modules/types"

/** The console's readonly SWR-derived session; it owns no state beyond the source read. */
export const ConsoleSessionContext: Context<ConsoleSessionView | undefined> = createContext<
    ConsoleSessionView | undefined
>(undefined)
