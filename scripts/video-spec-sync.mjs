#!/usr/bin/env node
// The web app keeps the constants the video screens need (frame shapes, music ids, voices, bucket names, limits) in
// fe/apps/web/src/modules/video/video.constants.ts. The back end owns the policy they mirror
// (be/src/modules/domain/video/video-spec.policy.ts). Fails when a shared constant drifts.
import { readFileSync } from "node:fs"

const web = readFileSync(new URL("../fe/apps/web/src/modules/video/video.constants.ts", import.meta.url), "utf8")
const policy = readFileSync(new URL("../be/src/modules/domain/video/video-spec.policy.ts", import.meta.url), "utf8")

const SHARED = [
    "ASPECTS",
    "TRANSITIONS",
    "MOTIONS",
    "MUSIC_TRACKS",
    "TTS_VOICES",
    "MEDIA_BUCKET",
    "VIDEOS_BUCKET",
    "MEDIA_MAX_BYTES",
    "VIDEO_MAX_SECONDS",
]

/** The initializer of `export const NAME`, without the `as const` tail, whitespace and trailing commas. */
const valueOf = (source, name) => {
    const match = new RegExp(`export const ${name}(?::[^=]+)? = ([\\s\\S]*?)(?:\\n\\n|\\n/\\*\\*|$)`).exec(source)
    if (match === null) return null
    return match[1]
        .replace(/\s+as const\s*$/, "")
        .replace(/\s+/g, "")
        .replace(/,([\]}])/g, "$1")
        .replace(/'/g, '"')
}

const drift = SHARED.flatMap((name) => {
    const mine = valueOf(web, name)
    const theirs = valueOf(policy, name)
    if (mine === null || theirs === null)
        return [`${name}: missing in ${mine === null ? "web constants" : "back end policy"}`]
    return mine === theirs ? [] : [`${name}: web ${mine} differs from back end ${theirs}`]
})

if (drift.length > 0) {
    console.error(`video constants drifted from the back end policy:\n  ${drift.join("\n  ")}`)
    process.exit(1)
}
console.log(`video constants match the back end policy (${SHARED.length} checked)`)
