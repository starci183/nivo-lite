"use client"

import { useContext } from "react"
import { ConsoleSessionContext } from "@/modules/console-session"
import type { ConsoleSessionView } from "@/modules/types"

/** Reads the current workspace session supplied by the console's bootstrap provider. */
export const useConsoleSession = (): ConsoleSessionView | undefined => useContext(ConsoleSessionContext)
