/**
 * The reaction kinds this design system can draw.
 *
 * In `starci-academy-fe` this vocabulary sat under `modules/api/graphql/queries/types`, which made it
 * look like transport. It is not: the six values are a PRESENTATION vocabulary - the set of faces
 * the picker has drawings for. A seventh value arriving from the API would not draw itself, so the
 * closed set belongs beside the leaf that owns the drawings.
 *
 * It lives with `ReactionPicker` rather than in a shared folder because that leaf is what fixes the
 * meaning; `ActivityRow` consumes the vocabulary but does not define it.
 *
 * The string values match the API's wire values exactly, so a caller may pass a server value
 * straight through. That is a deliberate coupling, and the reason it is safe is that the values are
 * checked here: a wire value outside this union does not compile at the call site.
 */
/** The positive acknowledgement reaction. */
export const REACTION_LIKE = "like" as const;
/** The affection reaction. */
export const REACTION_LOVE = "love" as const;
/** The laughter reaction. */
export const REACTION_HAHA = "haha" as const;
/** The surprise reaction. */
export const REACTION_WOW = "wow" as const;
/** The sadness reaction. */
export const REACTION_SAD = "sad" as const;
/** The anger reaction. */
export const REACTION_ANGRY = "angry" as const;

/** One value from the presentation vocabulary owned by this module. */
export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";
