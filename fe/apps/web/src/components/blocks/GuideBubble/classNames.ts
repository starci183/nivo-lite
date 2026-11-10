/** The floating host of the guide button: position and stacking only; the face belongs to the grammar avatar button. */
export const BUBBLE_CLASS = "fixed bottom-2 right-2 z-50"
/**
 * The same host on a page whose composer and panes scroll on their own (a messenger, the Second Brain, an agent): from the tablet width up it is lifted
 * above the composer (about 5rem tall with its gap); on a phone it is not drawn, because those panes fill the screen to its foot, a spacer of the
 * shell cannot reach their own scroll areas, and the composer is the thing the member is using.
 */
export const BUBBLE_OVER_COMPOSER_CLASS = "fixed bottom-28 right-2 z-50 max-md:hidden"
/**
 * The scroll room the shell keeps under the routed page on a phone, so the last row of a card, an aside, a counter or a button scrolls clear of the
 * floating button: the button's height (about 3.8rem), its bottom offset (0.5rem) and a gap (about 0.7rem), shown only while the button is. From the tablet width up the button sits in the page margin and needs none.
 */
export const CLEARANCE_CLASS = "h-20 shrink-0 md:hidden"
/** The anchor of the badge dot over the button. */
export const ANCHOR_CLASS = "relative"
/** The badge dot sits on the button's top end corner. */
export const BADGE_CLASS = "absolute right-0 top-0 pointer-events-none"
/** The chat body fills the height of the sheet's body, so the pink well grows and the composer stays at the foot. */
export const SHEET_CLASS = "h-full min-h-0"
/** A block that is not a bubble (the suggestion pills) stands in the bubbles' column: the avatar (28) and its gap (8). */
export const COLUMN_CLASS = "ps-9"
