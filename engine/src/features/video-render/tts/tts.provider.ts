/**
 * A text-to-speech engine. Swap the implementation (a paid Vietnamese TTS: Azure, FPT.AI, ElevenLabs...) by providing another class and
 * selecting it in TtsService; nothing else in the renderer knows which one is used.
 */
export type TtsRequest = {
  readonly text: string;
  /** Provider-specific voice id (for Edge: vi-VN-HoaiMyNeural or vi-VN-NamMinhNeural). */
  readonly voice: string;
  /** Speaking rate relative to normal, in percent (-30..30). */
  readonly ratePct: number;
};

export interface TtsProvider {
  /** Stable id; part of the cache key so two providers never share a cached clip. */
  readonly id: string;
  /** MP3 bytes for the text. Throws on failure; a TtsRetryable means worth trying again. */
  synthesize(req: TtsRequest, signal: AbortSignal): Promise<Buffer>;
  /** Free any connection (called when the engine stops). */
  close?(): void;
}

/** A failure that may succeed on retry (throttling, a dropped socket). */
export class TtsRetryable extends Error {}
