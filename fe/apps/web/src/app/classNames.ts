/**
 * App-owned layout of the public route pages under src/app (booking, invitation, hiring links). Faces, edges, type
 * and colour belong to Grammar (PageContainer, SurfaceCard, Heading, Text, Button, List). No literal colour.
 */

/** The `main` of a public routed page: block inset only, the inline inset is PageContainer's (PADDING-9, MEASURE-1). */
export const PUBLIC_MAIN = "min-h-dvh py-6 sm:py-8"
/** Page regions: header, then cards (GAP-5). */
export const PUBLIC_STACK = "flex min-w-0 flex-col gap-6"
/** Page heading group: qualifier, title, facts (GAP-1 case-1). */
export const PUBLIC_HEAD = "flex min-w-0 flex-col gap-1"
/** Blocks inside one card (GAP-4 case-1). */
export const CARD_STACK = "flex min-w-0 flex-col gap-4"
/** Peer actions or notes inside one card (GAP-3). */
export const ACTION_STACK = "flex min-w-0 flex-col gap-3"
/** A titled list: title over its rows (GAP-2). */
export const LIST_BLOCK = "flex min-w-0 flex-col gap-2"
/**
 * Author-written text whose own line breaks must survive (a job description, an offer letter).
 * grammar gap: `Text` publishes no preserve-line-breaks overflow, so the wrapper keeps `whitespace-pre-wrap`.
 */
export const PRESERVE_BREAKS = "whitespace-pre-wrap break-words"
/** The "operated by NIVO" line closes the column (FLOW-1 case-3: one short centred line in a symmetric column). */
export const FOOT_LINE = "text-center"
/** Invitation page: one centred task column on the canvas (MEASURE-4 case-3: a capped form region, `mx-auto`). */
export const INVITE_MAIN = "flex min-h-dvh items-center py-10"
/** The invitation column: logo, then the card (GAP-5). */
export const INVITE_COLUMN = "mx-auto flex w-full max-w-md flex-col gap-6"
/** A row of short fact Badges (GAP-2 case-4). */
export const FACTS = "flex flex-wrap items-center gap-2"
