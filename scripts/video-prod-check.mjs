#!/usr/bin/env node
// Production check of video.render. Needs the service role (run through scripts/with-secrets.mjs).
//   node scripts/with-secrets.mjs node scripts/video-prod-check.mjs <imagesDir> <outDir> [--spec spec.json]
// 1. finds or creates the workspace "Kiểm thử · Video"  2. uploads the two test images to the `media` bucket  3. inserts a video_renders row + engine job
// 4. polls it, printing progress  5. downloads the MP4 + poster with a signed URL into <outDir> (ffprobe/frames are done by the caller).
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [imagesDir, outDir, ...rest] = process.argv.slice(2);
const specFile = rest[0] === "--spec" ? rest[1] : null;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const NAME = "Kiểm thử · Video";
mkdirSync(outDir, { recursive: true });

// --- workspace
let ws = (await db.from("workspaces").select("id").eq("name", NAME).limit(1)).data?.[0]?.id;
if (!ws) {
  const email = process.env.READY_OWNER_EMAIL;
  const users = (await db.auth.admin.listUsers({ perPage: 200 })).data?.users ?? [];
  const owner = users.find((u) => u.email === email) ?? users[0];
  const ins = await db.from("workspaces").insert({ name: NAME, owner_id: owner.id }).select("id").single();
  if (ins.error) throw new Error(`workspace: ${ins.error.message}`);
  ws = ins.data.id;
  console.log("created workspace", ws);
} else console.log("workspace", ws);

// --- assets
const up = async (file, name, type) => {
  const path = `${ws}/${randomUUID()}-${name}`;
  const r = await db.storage.from("media").upload(path, readFileSync(join(imagesDir, file)), { contentType: type });
  if (r.error) throw new Error(`upload ${file}: ${r.error.message}`);
  return path;
};
const img1 = await up("img1.jpg", "anh-thu-1.jpg", "image/jpeg");
const img2 = await up("img2.jpg", "anh-thu-2.jpg", "image/jpeg");
const logo = await up("logo.png", "logo.png", "image/png");

// --- spec
let spec;
if (specFile) {
  spec = JSON.parse(readFileSync(specFile, "utf8").split("{{WS}}").join(ws));
  delete spec.__ws;
  const swap = (p) => (p === "11111111-1111-1111-1111-111111111111/img1.jpg" ? img1 : p === "11111111-1111-1111-1111-111111111111/img2.jpg" ? img2 : p === "11111111-1111-1111-1111-111111111111/logo.png" ? logo : p);
  for (const s of spec.scenes) if (s.background.src) s.background.src = swap(s.background.src);
  if (spec.brand.logo) spec.brand.logo = swap(spec.brand.logo);
} else throw new Error("--spec is required");

// --- enqueue (same two writes as src/lib/video/client.ts enqueueRender)
const ins = await db.from("video_renders").insert({ workspace_id: ws, spec }).select("id").single();
if (ins.error) throw new Error(`render row: ${ins.error.message}`);
const id = ins.data.id;
const job = await db.rpc("engine_enqueue", { p_workspace: ws, p_kind: "video.render", p_payload: { render_id: id }, p_dedupe_key: `video.render:${id}`, p_max_attempts: 2 });
if (job.error) throw new Error(`enqueue: ${job.error.message}`);
const t0 = Date.now();
console.log("render", id, "job", job.data);

// --- poll
let row;
let last = "";
for (;;) {
  row = (await db.from("video_renders").select("*").eq("id", id).single()).data;
  const line = `${row.status} ${row.progress}% ${row.stage ?? ""}`;
  if (line !== last) { console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s ${line}`); last = line; }
  if (row.status === "done" || row.status === "failed") break;
  if (Date.now() - t0 > 20 * 60_000) throw new Error("timeout waiting for the render");
  await new Promise((r) => setTimeout(r, 1000));
}
console.log("wall_s", ((Date.now() - t0) / 1000).toFixed(1));
if (row.status === "failed") { console.error("FAILED:", row.error); process.exit(1); }
console.log(JSON.stringify({ duration_ms: row.duration_ms, size_bytes: row.size_bytes, output_path: row.output_path, meta: row.meta }, null, 1));

// --- download via signed URLs
for (const [path, file] of [[row.output_path, "video.mp4"], [row.poster_path, "poster.jpg"]]) {
  const s = await db.storage.from("videos").createSignedUrl(path, 600);
  const res = await fetch(s.data.signedUrl);
  writeFileSync(join(outDir, file), Buffer.from(await res.arrayBuffer()));
  console.log("downloaded", file, res.status);
}
writeFileSync(join(outDir, "render.json"), JSON.stringify({ id, workspace: ws, row }, null, 2));
