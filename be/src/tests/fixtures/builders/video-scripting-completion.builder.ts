import { builder } from "@starci/jest-preset"
import type { GenerationState } from "@modules/domain/ai-generations"

/** The workspace of the scripting specs. */
export const WS = "workspace-1"
/** The instant the scripting specs run at. */
export const NOW = "2026-10-13T09:00:00.000Z"
/** The model answer: a title and two scenes. */
export const ANSWER = JSON.stringify({
    title: "Spring  sale",
    scenes: [
        { caption: "Fresh", voiceover: "Hi" },
        { caption: "Visit", voiceover: "Bye" },
    ],
})
/** The prompt the generation was made from. */
export const PROMPT = [
    { role: "system", content: "Write a script" },
    { role: "tool", content: "dropped" },
]

/** The scripting metadata of a project waiting for its generation. */
export const META = {
    generation_id: "generation-1",
    script_request_id: "generation-1",
    attempts: 1,
    auto_title: true,
    started_at: "2026-10-13T08:59:58.000Z",
}

/** A finished video-script generation of the workspace, with the answer the model gave. */
export const stateOf = builder<GenerationState>({
    id: "generation-1",
    workspaceId: WS,
    purpose: "video_script",
    status: "done",
    text: ANSWER,
    errorCode: null,
    input: { context: { projectId: "project-1" }, messages: PROMPT },
    output: {},
    timings: { total_ms: 5 },
    createdAt: "2026-10-13T08:59:58.000Z",
    finishedAt: NOW,
    messages: [],
})

/** The delivery key the bus hands the `video` reactor. */
export const CLAIM = { consumer: "ai_generation_completed__video", dedupeKey: "generation-1" }
