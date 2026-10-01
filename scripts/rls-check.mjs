#!/usr/bin/env node
// RLS + membership check against the LOCAL Supabase stack (run through with-secrets: `npm run db:test`).
// Creates throw-away users/workspaces, asserts what owner | manager | staff may read and write, then deletes them.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) { console.error("missing Supabase env (run through scripts/with-secrets.mjs)"); process.exit(1); }
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) { console.error("refusing to run against a non-local Supabase"); process.exit(1); }

const admin = createClient(url, service, { auth: { persistSession: false } });
const tag = randomBytes(4).toString("hex");
const password = `Rls-${randomBytes(9).toString("base64url")}`;
const users = [];
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${extra}`}`); if (!ok) failed++; };
const rows = async (q) => (await q).data ?? [];
const msg = async (q) => (await q).error?.message ?? "";

const mkUser = async (label) => {
  const email = `rls-${label}-${tag}@nivo.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `RLS ${label}` } });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const s = await client.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  return { id: data.user.id, email, db: client };
};

try {
  const [ownerA, ownerB, manager, staffU, outsider] = await Promise.all(["ownerA", "ownerB", "manager", "staff", "outsider"].map(mkUser));

  // Workspaces are created by their owners; the trigger makes them owner members.
  const wsA = (await ownerA.db.from("workspaces").insert({ owner_id: ownerA.id, name: `A ${tag}` }).select().single()).data;
  const wsB = (await ownerB.db.from("workspaces").insert({ owner_id: ownerB.id, name: `B ${tag}` }).select().single()).data;
  const ownerRow = (await admin.from("workspace_members").select("*").eq("workspace_id", wsA.id).eq("user_id", ownerA.id).single()).data;
  check("workspace creator becomes an active owner member", ownerRow?.role === "owner" && ownerRow.status === "active" && ownerRow.display_name === "RLS ownerA");

  const staffRowA = (await admin.from("staff").insert({ workspace_id: wsA.id, name: "Chi Staff", role: "Tu van vien" }).select().single()).data;
  const staffRowA2 = (await admin.from("staff").insert({ workspace_id: wsA.id, name: "Other Staff", role: "Sales" }).select().single()).data;
  await admin.from("workspace_members").insert([
    { workspace_id: wsA.id, user_id: manager.id, role: "manager", display_name: "RLS manager" },
    { workspace_id: wsA.id, user_id: staffU.id, role: "staff", staff_id: staffRowA.id, display_name: "Chi Staff" },
  ]);
  await admin.from("authority").insert({ workspace_id: wsA.id, goal_note: "original" });
  await admin.from("authority").insert({ workspace_id: wsB.id, goal_note: "original" });
  await admin.from("leads").insert([
    { workspace_id: wsA.id, contact_name: "Lead A", company: "A", channel: "web", need: "x" },
    { workspace_id: wsB.id, contact_name: "Lead B", company: "B", channel: "web", need: "x" },
  ]);
  const wi = (extra) => ({ workspace_id: wsA.id, department: "chatbot", action: "reply_customer", subject_type: "conversation", status: "waiting_decision", ...extra });
  const itemMine = (await admin.from("work_items").insert(wi({ dedupe_key: `mine-${tag}`, assigned_staff_id: staffRowA.id })).select().single()).data;
  const itemOther = (await admin.from("work_items").insert(wi({ dedupe_key: `other-${tag}`, assigned_staff_id: staffRowA2.id })).select().single()).data;
  const itemFree = (await admin.from("work_items").insert(wi({ dedupe_key: `free-${tag}` })).select().single()).data;
  const statusOf = async (id) => (await admin.from("work_items").select("status").eq("id", id).single()).data?.status;

  // ---- staff: read inside the workspace, nothing outside it
  const s = staffU.db;
  check("staff reads leads of own workspace", (await rows(s.from("leads").select("id").eq("workspace_id", wsA.id))).length === 1);
  check("staff cannot read another workspace's leads", (await rows(s.from("leads").select("id").eq("workspace_id", wsB.id))).length === 0);
  check("staff cannot read another workspace row", (await rows(s.from("workspaces").select("id").eq("id", wsB.id))).length === 0);
  check("staff cannot read another workspace's authority", (await rows(s.from("authority").select("*").eq("workspace_id", wsB.id))).length === 0);
  check("staff cannot insert into another workspace", !!(await msg(s.from("messages").insert({ workspace_id: wsB.id, author_kind: "human", author_name: "x", body: "x" }))));
  check("staff can write a message in own workspace", !(await msg(s.from("messages").insert({ workspace_id: wsA.id, author_kind: "human", author_name: "Chi Staff", body: "hi" }))));

  // ---- staff: no governance
  await s.from("authority").update({ goal_note: "hacked" }).eq("workspace_id", wsA.id);
  check("staff cannot edit authority", (await admin.from("authority").select("goal_note").eq("workspace_id", wsA.id).single()).data?.goal_note === "original");
  check("staff cannot add authority rules", !!(await msg(s.from("authority_rules").insert({ workspace_id: wsA.id, department: "chatbot", action: "reply_customer", mode: "auto" }))));
  check("staff cannot add staff rows", !!(await msg(s.from("staff").insert({ workspace_id: wsA.id, name: "Ghost" }))));
  await s.from("staff").update({ name: "Renamed" }).eq("id", staffRowA.id);
  check("staff cannot rename staff rows", (await admin.from("staff").select("name").eq("id", staffRowA.id).single()).data?.name === "Chi Staff");
  check("staff cannot add members", !!(await msg(s.from("workspace_members").insert({ workspace_id: wsA.id, user_id: outsider.id, role: "staff", display_name: "x" }))));
  await s.from("workspace_members").update({ role: "owner" }).eq("user_id", staffU.id);
  check("staff cannot promote self", (await admin.from("workspace_members").select("role").eq("user_id", staffU.id).single()).data?.role === "staff");
  check("staff cannot create invites", !!(await msg(s.from("workspace_invites").insert({ workspace_id: wsA.id, email: "x@y.z", role: "staff", token_hash: `t1${tag}` }))));
  check("staff cannot read invites", (await rows(s.from("workspace_invites").select("id").eq("workspace_id", wsA.id))).length === 0);
  await s.from("workspaces").update({ name: "pwned" }).eq("id", wsA.id);
  check("staff cannot rename the workspace", (await admin.from("workspaces").select("name").eq("id", wsA.id).single()).data?.name === `A ${tag}`);
  const dir = await s.rpc("workspace_members_directory", { ws: wsA.id });
  check("staff sees the member directory without emails", !dir.error && dir.data.length === 3 && dir.data.every((r) => r.email === null));
  const dirOut = await s.rpc("workspace_members_directory", { ws: wsB.id });
  check("staff gets an empty directory for another workspace", !dirOut.error && dirOut.data.length === 0);

  // ---- staff: decisions only on items assigned to them
  await s.from("work_items").update({ status: "done" }).eq("id", itemOther.id);
  check("staff cannot decide an item assigned to someone else", (await statusOf(itemOther.id)) === "waiting_decision");
  await s.from("work_items").update({ status: "done" }).eq("id", itemFree.id);
  check("staff cannot decide an unassigned item", (await statusOf(itemFree.id)) === "waiting_decision");
  await s.from("work_items").update({ status: "done" }).eq("id", itemMine.id);
  check("staff can decide an item assigned to them", (await statusOf(itemMine.id)) === "done");

  // ---- manager: governs, but cannot create owners
  const m = manager.db;
  await m.from("authority").update({ goal_note: "by manager" }).eq("workspace_id", wsA.id);
  check("manager can edit authority", (await admin.from("authority").select("goal_note").eq("workspace_id", wsA.id).single()).data?.goal_note === "by manager");
  check("manager can invite", !(await msg(m.from("workspace_invites").insert({ workspace_id: wsA.id, email: `inv-${tag}@nivo.test`, role: "staff", token_hash: `t2${tag}` }))));
  check("manager cannot invite an owner", !!(await msg(m.from("workspace_invites").insert({ workspace_id: wsA.id, email: "o@nivo.test", role: "owner", token_hash: `t3${tag}` }))));
  check("manager cannot create an owner member", !!(await msg(m.from("workspace_members").insert({ workspace_id: wsA.id, user_id: outsider.id, role: "owner", display_name: "x" }))));
  await m.from("workspace_members").update({ status: "disabled" }).eq("workspace_id", wsA.id).eq("user_id", ownerA.id);
  check("manager cannot disable an owner", (await admin.from("workspace_members").select("status").eq("id", ownerRow.id).single()).data?.status === "active");
  check("manager sees emails in the directory", (await rows(m.rpc("workspace_members_directory", { ws: wsA.id }))).every((r) => !!r.email));

  // ---- owner: the last owner is protected
  check("the last active owner cannot be demoted", !!(await msg(admin.from("workspace_members").update({ role: "manager" }).eq("id", ownerRow.id))));
  check("the last active owner cannot be deleted", !!(await msg(admin.from("workspace_members").delete().eq("id", ownerRow.id))));

  // ---- invites: preview, accept, mismatch, reuse
  const token = randomBytes(24).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  await ownerA.db.from("workspace_invites").insert({ workspace_id: wsA.id, email: outsider.email, role: "staff", staff_id: staffRowA2.id, token_hash: hash });
  const anonDb = createClient(url, anon, { auth: { persistSession: false } });
  const prev = await anonDb.rpc("invite_preview", { token });
  check("invite preview works before sign-in", prev.data?.[0]?.state === "pending" && prev.data[0].email === outsider.email);
  check("a different user cannot accept the invite", /invite_email_mismatch/.test(await msg(ownerB.db.rpc("accept_invite", { token }))));
  const ok = await outsider.db.rpc("accept_invite", { token });
  const joined = (await admin.from("workspace_members").select("role,staff_id").eq("workspace_id", wsA.id).eq("user_id", outsider.id).single()).data;
  check("the invited user accepts and becomes a staff member", ok.data === wsA.id && joined?.role === "staff");
  check("the accepted member is linked to the staff row", joined?.staff_id === staffRowA2.id);
  check("an invite cannot be used twice", /invite_used/.test(await msg(outsider.db.rpc("accept_invite", { token }))));
  check("a stale token is invalid", /invite_invalid/.test(await msg(outsider.db.rpc("accept_invite", { token: "nope" }))));
  check("anon cannot accept invites", !!(await msg(anonDb.rpc("accept_invite", { token }))));

  // ---- disabled members lose access at once
  await admin.from("workspace_members").update({ status: "disabled" }).eq("workspace_id", wsA.id).eq("user_id", staffU.id);
  check("a disabled member reads nothing", (await rows(s.from("leads").select("id").eq("workspace_id", wsA.id))).length === 0);
  check("a disabled member still sees their own membership row", (await rows(s.from("workspace_members").select("status").eq("user_id", staffU.id)))[0]?.status === "disabled");

  // ---- the owner of B is isolated from A
  check("another workspace's owner cannot read workspace A", (await rows(ownerB.db.from("leads").select("id").eq("workspace_id", wsA.id))).length === 0);
} catch (e) {
  console.error("check crashed:", e?.message ?? e);
  failed++;
} finally {
  await admin.from("workspaces").delete().like("name", `% ${tag}`);
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => {});
}
console.log(failed ? `\n${failed} check(s) FAILED` : "\nall RLS checks passed");
process.exit(failed ? 1 : 0);
