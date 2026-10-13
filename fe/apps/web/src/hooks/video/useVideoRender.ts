import { useLocale } from "next-intl"
import { request } from "@/modules/api"
import type { Outcome } from "@/modules/api"
import { createBrowserDbClient } from "@/modules/db/browser"
import { isRecord } from "@/modules/video"

const decodeRender = (body: string): Outcome<string> => {
    try {
        const parsed: unknown = JSON.parse(body)
        if (isRecord(parsed) && typeof parsed.renderId === "string") return { kind: "ok", value: parsed.renderId }
    } catch {
        return { kind: "unavailable", code: "decode", retryable: false }
    }
    return { kind: "unavailable", code: "decode", retryable: false }
}

/** The error code a refused render request maps to in the video catalog (err_<code>). */
const codeOf = (outcome: Exclude<Outcome<string>, { kind: "ok" }>): string => {
    if (outcome.kind === "refused") return "render-refused"
    if (outcome.kind === "not-found") return "render-project"
    return outcome.kind === "invalid" ? "render-rejected" : "render-unavailable"
}

/**
 * Asks the back end to render a project: it builds the spec from the saved script and brand kit, validates it, puts the project in
 * "rendering" and queues the job. Resolves to null when accepted, else the error code to show.
 */
export const useVideoRender = (): ((projectId: string) => Promise<string | null>) => {
    const locale = useLocale()
    return async (projectId) => {
        const session = await createBrowserDbClient().auth.getSession()
        const token = session.data.session?.access_token
        if (token === undefined) return "render-refused"
        const answer = await request(
            { path: "/video/renders", token, locale, method: "POST", body: { projectId } },
            decodeRender,
        )
        return answer.kind === "ok" ? null : codeOf(answer)
    }
}
