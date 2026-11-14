import type { ComposeSpec } from "./video-compose.contracts"
import { COMPOSE_MUSIC_MAX } from "./video-compose.schema"

/*
 * The rules of a compose spec ACROSS its members, which the structural schema cannot state: each a fact of format, never a business
 * choice. A spec that breaks one is refused `invalid_spec` before any provider is asked. Pure.
 */

/** Every rule the spec breaks, as short codes with the member they point at; empty when it is sound. */
export const composeSpecProblems = (spec: ComposeSpec): ReadonlyArray<string> => [
    ...spec.clips.flatMap((clip, index) =>
        clip.trimMs?.toMs !== undefined && clip.trimMs.toMs <= clip.trimMs.fromMs ? [`clips.${index}.trimMs: toMs not after fromMs`] : [],
    ),
    ...((spec.audio ?? []).filter((track) => track.role === "music").length > COMPOSE_MUSIC_MAX
        ? [`audio: more than ${COMPOSE_MUSIC_MAX} music track`]
        : []),
    ...(spec.captions ?? []).flatMap((caption, index) =>
        caption.toMs <= caption.fromMs ? [`captions.${index}: toMs not after fromMs`] : [],
    ),
]
