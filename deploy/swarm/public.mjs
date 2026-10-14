#!/usr/bin/env node
// Prints `KEY=value` for the two public web build values held in the sealed `web` member (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).
// They are public by design (the browser receives them) and become build arguments of the web image; the workflow masks them in the log anyway.
//   SOPS_AGE_KEY=... node deploy/swarm/public.mjs [--secrets-dir <dir>]
import { join, resolve } from "node:path"
import { ROOT, fail, openMember } from "./lib.mjs"

const at = process.argv.indexOf("--secrets-dir")
const secretsDir = resolve(at < 0 ? join(ROOT, ".starcistacks", "production", "secrets") : process.argv[at + 1])
const web = openMember(secretsDir, "web")
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
    if (!web[key]) fail(`web.enc has no ${key}`)
    if (/[\r\n]/u.test(web[key])) fail(`${key} must be one line`)
    process.stdout.write(`${key}=${web[key]}\n`)
}
