/** Client-safe shapes of the NIVO guide conversation. */

export type GuideLink = {
  readonly pageId: string;
  readonly label: string;
  readonly href: string;
  /** The `data-guide` element highlighted after the jump. */
  readonly target?: string;
};

export type GuideReply = {
  readonly answer: string;
  /** Short how-to steps (already in the reader's language). */
  readonly steps: ReadonlyArray<string>;
  readonly links: ReadonlyArray<GuideLink>;
  /** map: answered from the site map (no tokens); ai: written by the model; busy: the model could not answer. */
  readonly source: "map" | "ai" | "busy";
};

export type GuideTurn = { readonly role: "user" | "guide"; readonly text: string };
