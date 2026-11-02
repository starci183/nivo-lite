import { createContext } from "react"
import type { ConsoleSession } from "@/modules/types"

/** The console's readonly SWR-derived session; it owns no state beyond the source read. */
export const ConsoleSessionContext = createContext<ConsoleSession | undefined>(undefined)
