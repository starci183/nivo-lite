import type { GuidelineKit, ImageJob, ImageStyle } from "./content-agent.contracts"

/** The size of a composed brand image (Facebook landscape). */
export const IMAGE_WIDTH = 1200
export const IMAGE_HEIGHT = 800

const HALF = IMAGE_WIDTH / 2
const FALLBACK = { light: "#fbf7f1", dark: "#5a4632", accent: "#c2996b" }

/** The relative luminance of a `#rrggbb` color, 0..1. */
export const luminanceOf = (hex: string): number => {
    const channel = (at: number): number => Number.parseInt(hex.slice(at, at + 2), 16) / 255
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/**
 * The two styles of a post's images from the brand palette: the first on the lightest color with the darkest ink, the second
 * inverted, both with the most saturated remaining color as accent. A palette without enough colors falls back to warm neutrals.
 */
export const imageStylesOf = (kit: GuidelineKit | null): readonly [ImageStyle, ImageStyle] => {
    const hexes = (kit?.colors ?? []).map((color) => color.hex)
    const sorted = [...hexes].sort((a, b) => luminanceOf(b) - luminanceOf(a))
    const [first, ...rest] = sorted
    const last = rest.at(-1)
    const paired = first !== undefined && last !== undefined
    const light = paired ? first : FALLBACK.light
    const dark = paired ? last : FALLBACK.dark
    const accent = hexes.find((hex) => hex !== light && hex !== dark) ?? FALLBACK.accent
    return [
        { background: light, ink: dark, accent, photoLeft: false },
        { background: dark, ink: light, accent, photoLeft: true },
    ]
}

const color = (hex: string): string => `0x${hex.slice(1)}`

/** The ffmpeg arguments that compose one brand image: canvas, photo half, accent bar, headline, subline and the logo. */
export const imageArgs = (job: ImageJob): ReadonlyArray<string> => {
    const { style } = job
    const textX = style.photoLeft ? HALF + 64 : 64
    const photoX = style.photoLeft ? 0 : HALF
    const inputs: Array<string> = [
        "-f",
        "lavfi",
        "-i",
        `color=c=${color(style.background)}:s=${IMAGE_WIDTH}x${IMAGE_HEIGHT}:d=1`,
    ]
    const graph: Array<string> = []
    let last = "0:v"
    let next = 1
    if (job.photo !== null) {
        inputs.push("-i", job.photo)
        graph.push(
            `[${next}:v]scale=${HALF}:${IMAGE_HEIGHT}:force_original_aspect_ratio=increase,crop=${HALF}:${IMAGE_HEIGHT}[photo]`,
            `[${last}][photo]overlay=${photoX}:0[canvas]`,
        )
        last = "canvas"
        next += 1
    }
    graph.push(
        `[${last}]drawbox=x=${textX}:y=300:w=96:h=6:color=${color(style.accent)}:t=fill,` +
            `drawtext=fontfile=${job.boldFont}:textfile=${job.headlineFile}:fontcolor=${color(style.ink)}:fontsize=64:` +
            `line_spacing=12:x=${textX}:y=340,` +
            `drawtext=fontfile=${job.regularFont}:textfile=${job.sublineFile}:fontcolor=${color(style.accent)}:fontsize=34:` +
            `x=${textX}:y=${IMAGE_HEIGHT - 180}[texted]`,
    )
    last = "texted"
    if (job.logo !== null) {
        inputs.push("-i", job.logo)
        graph.push(`[${next}:v]scale=-1:96[logo]`, `[${last}][logo]overlay=${textX}:96[out]`)
        last = "out"
    }
    return ["-y", ...inputs, "-filter_complex", graph.join(";"), "-map", `[${last}]`, "-frames:v", "1", job.output]
}

/** Wraps a headline at about `width` characters a line, keeping words whole (drawtext does not wrap). */
export const wrapText = (text: string, width: number): string => {
    const lines: Array<string> = []
    let line = ""
    for (const word of text.split(/\s+/u).filter((part) => part !== "")) {
        if (line !== "" && line.length + word.length + 1 > width) {
            lines.push(line)
            line = word
        } else {
            line = line === "" ? word : `${line} ${word}`
        }
    }
    if (line !== "") lines.push(line)
    return lines.join("\n")
}
