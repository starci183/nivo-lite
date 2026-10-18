import type { GenMessage } from "@modules/domain/ai-generations"
import type { VideoScriptSourceRow, VideoScriptingRow } from "./persistence/video-scripting.rows"
import { videoInputsOf } from "./video-workbench.policy"
import { VIDEO_SCRIPT_GOALS, VIDEO_SCRIPT_SYSTEM } from "./video-scripting.templates"
import { videoScriptRoleAt } from "./video-scripting.policy"

/** Bounded public document text, preserving the source title. */
export const videoScriptSourcesText = (sources: ReadonlyArray<VideoScriptSourceRow>): string => {
    let remaining = 5200
    const selected: Array<string> = []
    for (const source of sources) {
        const body = source.content
            .replace(/[ \t]+/gu, " ")
            .replace(/\n{3,}/gu, "\n\n")
            .trim()
            .slice(0, Math.min(1600, remaining))
        if (body === "") continue
        remaining -= body.length
        const topic = source.topic === null ? "" : `${source.topic} / `
        selected.push(`### ${topic}${source.title}\n${body}`)
        if (remaining <= 0) break
    }
    return selected.join("\n\n")
}

/** Builds a short Vietnamese marketing prompt entirely from public business knowledge. */
export const videoScriptMessages = (
    project: VideoScriptingRow,
    workspaceId: string,
    sources: string,
    publicFacts: string,
): ReadonlyArray<GenMessage> => {
    const goal = VIDEO_SCRIPT_GOALS[project.goal] ?? VIDEO_SCRIPT_GOALS.custom
    const inputs = videoInputsOf(project.inputs, workspaceId)
    const count = Math.min(8, Math.max(3, Math.round(project.target_seconds / 6)))
    const voiceChars = Math.max(40, Math.round((project.target_seconds / count - 0.8) * 14))
    const bodies = goal.scenes.filter((scene) => scene.role === "body")
    const outline = Array.from({ length: count }, (_, index) => {
        const role = videoScriptRoleAt(index, count)
        const brief =
            role === "body"
                ? bodies[(index - 1) % Math.max(1, bodies.length)]?.brief
                : goal.scenes.find((scene) => scene.role === role)?.brief
        return `${index + 1}. ${role.toUpperCase()}: ${brief ?? ""}`
    }).join("\n")
    return [
        { role: "system", content: `${VIDEO_SCRIPT_SYSTEM}\n\nPUBLIC SHOP CONTEXT:\n${publicFacts}` },
        {
            role: "user",
            content: [
                `SHOP: ${project.shop_name?.trim() || project.workspace_name.trim()}`,
                `GOAL: ${goal.label.vi}. ${goal.hint.vi}`,
                `FORMAT: ${project.aspect}, about ${project.target_seconds} seconds in total.`,
                `SCENES: exactly ${count}. Each voiceover about ${voiceChars} characters, never above ${voiceChars + 30}.`,
                `OUTLINE:\n${outline}`,
                inputs.notes === "" ? "" : `THE OWNER WANTS TO STRESS: ${inputs.notes}`,
                sources === "" ? "No selected public facts: keep claims general." : `INFORMATION:\n${sources}`,
                `The owner supplied ${inputs.media.length} images or clips. Suggest what to show in each scene.`,
                "Return the JSON object now.",
            ]
                .filter((line) => line !== "")
                .join("\n\n"),
        },
    ]
}
