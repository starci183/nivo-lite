import type { ConsoleSession } from "@/modules/types"
import { NO_CONSOLE_SESSION } from "./console.shared"
import { useConsoleSession } from "./useConsoleSession"

/** The signed-in person's console session for the blocks of the console frame (an empty one until it is read: the frame waits for it). */
export const useCurrentConsoleSession = (): ConsoleSession => useConsoleSession() ?? NO_CONSOLE_SESSION
