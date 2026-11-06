import { createContext } from "react"
import type { Context } from "react"
import type { FixtureTables } from "./fixture-state"
import { NO_FIXTURES } from "./fixture-state"

/** The fixtures the prototype data port answers from; the prototype layout provides them once, at the app root. */
export const FixtureTablesContext: Context<FixtureTables> = createContext<FixtureTables>(NO_FIXTURES)
