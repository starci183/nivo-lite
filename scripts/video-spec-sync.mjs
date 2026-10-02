#!/usr/bin/env node
// The video spec is one pure file kept in two places (the engine image only contains engine/). Fails when they differ.
import { readFileSync } from "node:fs";
const a = readFileSync(new URL("../src/lib/video/spec.ts", import.meta.url), "utf8");
const b = readFileSync(new URL("../engine/src/features/video-render/video-spec.ts", import.meta.url), "utf8");
if (a !== b) { console.error("video spec copies differ: edit src/lib/video/spec.ts then `cp` it to engine/src/features/video-render/video-spec.ts"); process.exit(1); }
console.log("video spec copies are identical");
