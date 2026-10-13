import { videoRecord } from "./video-workbench.policy"

/** The configuration instructions that affect a marketing video. */
const VIDEO_SETUP_GATES = ["tone", "claims_limits", "video_goals", "formats", "brand_assets", "approval"]

const text = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

/** Renders the owner's approved summary, brand instructions and configured facts within a fixed prompt budget. */
export const videoScriptSetupText = (raw: unknown): string => {
    const snapshot = videoRecord(raw)
    const gates = videoRecord(snapshot.gates)
    const evidence = VIDEO_SETUP_GATES.map((key) => {
        const line = text(videoRecord(gates[key]).evidence, 500)
        return line === "" ? "" : `${key}: ${line}`
    })
    const facts = Array.isArray(snapshot.facts)
        ? snapshot.facts.slice(0, 12).flatMap((entry: unknown) => {
              const fact = text(videoRecord(entry).text, 200)
              return fact === "" ? [] : [`- ${fact}`]
          })
        : []
    return [text(snapshot.summary, 1500), ...evidence, ...facts]
        .filter((line) => line !== "")
        .join("\n")
        .slice(0, 3000)
}
