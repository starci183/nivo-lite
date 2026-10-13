import { writeRenderVideo } from "@/modules/db/video/write-render"
import type { DbOutcome } from "@/modules/db/outcome"

/** The error code a refused render request maps to in the video catalog (err_<code>). */
const codeOf = (outcome: Exclude<DbOutcome<unknown>, { kind: "ok" }>): string => {
    if (outcome.kind === "refused") return "render-refused"
    if (outcome.kind === "not-found") return "render-project"
    return outcome.kind === "invalid" ? "render-rejected" : "render-unavailable"
}

/**
 * Asks the back end to render a project: it builds the spec from the saved script and brand kit, validates it, puts the project in
 * "rendering" and queues the job. Resolves to null when accepted, else the error code to show.
 */
export const useVideoRender = (): ((projectId: string) => Promise<string | null>) => async (projectId) => {
    const answer = await writeRenderVideo(projectId)
    return answer.kind === "ok" ? null : codeOf(answer)
}
