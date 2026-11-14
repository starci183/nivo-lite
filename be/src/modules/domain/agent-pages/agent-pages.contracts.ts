import type { AgentRunDetail } from "@modules/domain/agent-work"
import type { Locale } from "@modules/platform/i18n"

/** A text a caller may leave out (a language, a step, a cursor, words). */
export type OptionalText = string | null | undefined

/** A count a caller may leave out (a page size). */
export type OptionalCount = number | null | undefined

/** A language a caller may leave out. */
export type OptionalLocale = Locale | undefined

/** One run with its steps, or null when the instance or the run is not there. */
export type OptionalAgentRunDetail = AgentRunDetail | null
