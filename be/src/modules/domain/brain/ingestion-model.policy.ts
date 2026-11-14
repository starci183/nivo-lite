import type { AiTarget } from "@modules/integrations/ai"
import { MODEL_PROFILES, profileWireOf } from "@modules/integrations/ai-gateway"

/**
 * The model of the Second Brain's ingestion DECISIONS: which passages state a rule (triage), the truths a rule passage states
 * (extraction), and whether a new truth is the same truth as a known one (the same-meaning judge). Owner 2026-11-12: these are
 * chosen by quality, not price ("200 USD of credits for this work"); round A showed the cheap model (Claude Haiku 5.5) wrong on exactly
 * them (reference text and rule lists, windows, wrong merges). They go to the strong default model, Claude Sonnet 5.5, on its own
 * gateway profile (an explicit choice that never switches model), with the stable head of each prompt marked for the provider's cache.
 */
export const INGESTION_TARGET: AiTarget = { name: MODEL_PROFILES.sonnet, ...profileWireOf(MODEL_PROFILES.sonnet) }
