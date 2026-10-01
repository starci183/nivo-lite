import { Inject, Injectable, Logger } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NivoClient } from "../../platform/nivo/nivo-client.service";
import { agentIdFor, AgentRegistry } from "../../platform/openclaw/agent-registry.service";
import { PermanentJobError, type EngineJob } from "../../platform/queue/queue.types";
import { SUPABASE } from "../../platform/supabase/supabase.module";
import { TOOL_MANIFEST } from "../tools/tool-manifest";
import { contentHash, metaOf, workspaceMatches, writeWorkspace, type SyncFile } from "./workspace-writer";

/** What /api/engine/sync-bundle returns: the agent's files, built from Supabase (the source of truth). */
type Bundle = {
  readonly installation_id: string;
  readonly workspace_id: string;
  readonly module: string;
  readonly agent_id: string;
  readonly agent_name: string;
  readonly context_version: number | null;
  readonly audience: "customer" | "internal";
  readonly files: ReadonlyArray<SyncFile>;
};

export type SyncOutcome = {
  readonly agent_id: string;
  readonly context_version: number | null;
  readonly changed: boolean;
  readonly written: number;
  readonly removed: number;
  readonly registered: boolean;
  readonly files: number;
  readonly content_hash: string;
};

/** Gateway hot-reload debounce (300 ms) plus time to apply: wait this long after rewriting openclaw.json before anyone sends a turn to a new agent. */
const RELOAD_SETTLE_MS = 2000;

/** The part of AGENTS.md only the engine knows: the tools of the bridge and how a turn calls them. The per-turn bearer token is NOT here: it arrives in the turn itself. */
const toolsSection = (): string => [
  "## Công cụ NIVO (tuỳ chọn)",
  "Trả lời khách chủ yếu bằng JSON theo hợp đồng ở trên: các trường \"lead\", \"needs_human\", \"order\", \"payment_claim\" đã đủ để NIVO tạo khách tiềm năng, chuyển cho người hoặc xin duyệt. Mỗi lượt NIVO có thể kèm khối [OPTIONAL TOOLS] (địa chỉ và token chỉ dùng cho lượt đó). Chỉ khi khối đó có mặt VÀ runtime của bạn cho phép gọi HTTP thì mới gọi công cụ; nếu không thì bỏ qua, đừng bịa kết quả.",
  ...TOOL_MANIFEST.map((t) => `- ${t.name}: ${t.description} Tham số: ${JSON.stringify(t.args)}`),
].join("\n");

/**
 * One-way sync of an agent's OpenClaw workspace from Supabase. Used by the openclaw.sync_agent job and, for an agent with no copy yet, inline by chat.turn.
 * The copy is recorded in openclaw_agent_sync; when the hash, the files on disk and the registration are all current, only checked_at moves.
 */
@Injectable()
export class AgentSyncService {
  private readonly log = new Logger(AgentSyncService.name);
  private readonly inflight = new Map<string, Promise<SyncOutcome>>();

  constructor(private readonly nivo: NivoClient, private readonly registry: AgentRegistry, @Inject(SUPABASE) private readonly db: SupabaseClient) {}

  /** `job` is the RUNNING engine job (a sync job, or a chat.turn): it authorises the bundle call and fixes the tenant. */
  sync(job: EngineJob, signal: AbortSignal): Promise<SyncOutcome> {
    const key = `${job.workspace_id ?? ""}:${String(job.payload.installation_id ?? job.payload.conversation_id)}`;
    const running = this.inflight.get(key);
    if (running) return running;
    const p = this.run(job, signal).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private async run(job: EngineJob, signal: AbortSignal): Promise<SyncOutcome> {
    if (!job.workspace_id) throw new PermanentJobError("sync needs a workspace");
    const bundle = await this.nivo.call<Bundle>("/api/engine/sync-bundle", { job_id: job.id }, signal);
    try {
      return await this.apply(bundle);
    } catch (e) {
      await this.record(bundle, { status: "error", error: (e instanceof Error ? e.message : String(e)).slice(0, 500) }).catch(() => undefined);
      throw e;
    }
  }

  private async apply(bundle: Bundle): Promise<SyncOutcome> {
    const agentId = agentIdFor(bundle.workspace_id, bundle.module);
    if (agentId !== bundle.agent_id) throw new PermanentJobError("the app and the engine disagree on the agent id");
    const dirs = this.registry.workspaceDirs(agentId);
    if (!dirs) throw new PermanentJobError("OPENCLAW_CONFIG_DIR is not set: the engine cannot write the agent workspace");

    const files: ReadonlyArray<SyncFile> = bundle.files.map((f) => (f.path === "AGENTS.md" ? { ...f, content: `${f.content}\n${toolsSection()}\n` } : f));
    const hash = contentHash(files);
    const previous = (await this.db.from("openclaw_agent_sync").select("content_hash, status").eq("installation_id", bundle.installation_id).maybeSingle()).data as { content_hash: string | null; status: string } | null;

    const current = previous?.content_hash === hash && workspaceMatches(dirs.local, files) && this.registry.isCurrent(agentId, bundle.agent_name);
    if (current) {
      await this.record(bundle, { status: "ok", error: null, hash, meta: metaOf(files), touchOnly: true });
      return { agent_id: agentId, context_version: bundle.context_version, changed: false, written: 0, removed: 0, registered: false, files: files.length, content_hash: hash };
    }

    // Files first, registration after: the gateway only ever sees an agent whose workspace is complete.
    const { written, removed } = writeWorkspace(dirs.local, files);
    const registered = this.registry.register(agentId, bundle.agent_name);
    if (registered) await new Promise((resolve) => setTimeout(resolve, RELOAD_SETTLE_MS));
    await this.record(bundle, { status: "ok", error: null, hash, meta: metaOf(files) });
    this.log.log(`synced ${agentId}: v${bundle.context_version ?? "-"}, ${files.length} files (${written} written, ${removed} removed${registered ? ", registered" : ""})`);
    return { agent_id: agentId, context_version: bundle.context_version, changed: true, written, removed, registered, files: files.length, content_hash: hash };
  }

  /** Write the state row. checked_at always moves; synced_at only when the files were rewritten. */
  private async record(bundle: Bundle, r: { status: "ok" | "error"; error: string | null; hash?: string; meta?: ReturnType<typeof metaOf>; touchOnly?: boolean }): Promise<void> {
    const now = new Date().toISOString();
    const base = { installation_id: bundle.installation_id, workspace_id: bundle.workspace_id, agent_id: bundle.agent_id, checked_at: now, status: r.status, error: r.error };
    const row = r.status === "ok"
      ? { ...base, context_version: bundle.context_version, content_hash: r.hash, files: r.meta ?? [], ...(r.touchOnly ? {} : { synced_at: now }) }
      : base;
    const { error } = await this.db.from("openclaw_agent_sync").upsert(row, { onConflict: "installation_id" });
    if (error) throw new Error(`openclaw_agent_sync: ${error.message}`);
  }
}
