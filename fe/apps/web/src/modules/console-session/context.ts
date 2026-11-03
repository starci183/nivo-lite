import { createContext } from "react"
import type { ConsoleSessionView } from "@/modules/types"
import type { Context } from "react"

/** The console's readonly SWR-derived session; it owns no state beyond the source read. */
export const ConsoleSessionContext: Context<ConsoleSessionView | undefined> = createContext<
    ConsoleSessionView | undefined
>(undefined)
