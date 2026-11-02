"use client"

import { useContext } from "react"
import { ConsoleSessionContext } from "@/modules/console-session"
import type { ConsoleSession } from "@/modules/types"

/** Reads the current workspace session supplied by the console's bootstrap provider. */
export const useConsoleSession = (): ConsoleSession | undefined => useContext(ConsoleSessionContext)
