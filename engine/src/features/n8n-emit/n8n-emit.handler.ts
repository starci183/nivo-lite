import { Inject, Injectable, Logger } from "@nestjs/common";
import { NIVO_OPTIONS, type NivoOptions } from "../../platform/nivo/nivo.config";
import { deriveKey, signBody } from "../../platform/nivo/signing";
import { PermanentJobError, RetryJobError, type EngineJob, type JobHandler, type JobResult } from "../../platform/queue/queue.types";
import { N8N_OPTIONS, type N8nOptions } from "./n8n.config";
import { assertAllowedTarget } from "./target-guard";

type Delivery = { readonly url: string; readonly ok: boolean; readonly status?: number; readonly error?: string; readonly transient?: boolean };

const MAX_URLS = 5;

/**
 * n8n.emit: POST one signed NIVO event to a workspace outgoing webhook URLs (n8n, or any HTTP receiver).
 *   payload: { event: "lead.created", data: {...}, urls?: ["https://n8n.example.com/webhook/..."] }  (urls default to N8N_DEFAULT_WEBHOOK_URL)
 * Headers: x-nivo-event, x-nivo-delivery (the job id, the receiver dedupe key: a retry resends the SAME id), x-nivo-timestamp and
 * x-nivo-signature = hex HMAC-SHA256(workspace key, "<timestamp>.<body>"). The workspace key is derived from ENGINE_SHARED_SECRET and the
 * workspace id, so one tenant key verifies nothing of another tenant. Minimal on purpose: where the URLs are stored, and the connection UI
 * around them, come later.
 */
@Injectable()
export class N8nEmitHandler implements JobHandler {
  readonly kind = "n8n.emit";
  private readonly log = new Logger(N8nEmitHandler.name);

  constructor(@Inject(NIVO_OPTIONS) private readonly nivo: NivoOptions, @Inject(N8N_OPTIONS) private readonly options: N8nOptions) {}

  async run(job: EngineJob, signal: AbortSignal): Promise<JobResult> {
    if (!job.workspace_id) throw new PermanentJobError("n8n.emit needs a workspace");
    const event = typeof job.payload.event === "string" ? job.payload.event.slice(0, 80) : "";
    if (!/^[a-z][a-z0-9_.-]*$/i.test(event)) throw new PermanentJobError("payload.event is required (for example lead.created)");
    const requested = Array.isArray(job.payload.urls) ? job.payload.urls.filter((u): u is string => typeof u === "string") : [];
    const urls = (requested.length ? requested : this.options.defaultWebhookUrl ? [this.options.defaultWebhookUrl] : []).slice(0, MAX_URLS);
    if (urls.length === 0) throw new PermanentJobError("no webhook URL: set payload.urls or N8N_DEFAULT_WEBHOOK_URL");

    const body = JSON.stringify({ id: job.id, event, workspace_id: job.workspace_id, occurred_at: new Date().toISOString(), data: job.payload.data ?? {} });
    const timestamp = String(Date.now());
    const signature = signBody(deriveKey(this.nivo.sharedSecret, `n8n:${job.workspace_id}`), timestamp, body);
    const deliveries: Delivery[] = [];
    for (const raw of urls) deliveries.push(await this.deliver(raw, event, job.id, timestamp, signature, body, signal));

    const failed = deliveries.filter((d) => !d.ok);
    if (failed.some((d) => d.transient)) throw new RetryJobError(`delivery failed: ${failed.map((d) => `${d.url} ${d.status ?? d.error}`).join("; ").slice(0, 300)}`, 30);
    if (failed.length === deliveries.length) throw new PermanentJobError(`every target refused the event: ${failed.map((d) => d.error ?? d.status).join(", ")}`);
    return { deliveries: deliveries.map(({ url, ok, status, error }) => ({ url: new URL(url).origin, ok, status, error })) };
  }

  private async deliver(raw: string, event: string, id: string, timestamp: string, signature: string, body: string, signal: AbortSignal): Promise<Delivery> {
    try {
      const url = await assertAllowedTarget(raw, this.options.allowedHosts);
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-nivo-event": event, "x-nivo-delivery": id, "x-nivo-timestamp": timestamp, "x-nivo-signature": signature },
        body,
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(this.options.timeoutMs)]),
      });
      if (res.ok) return { url: raw, ok: true, status: res.status };
      return { url: raw, ok: false, status: res.status, transient: res.status >= 500 || res.status === 408 || res.status === 429 };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.log.warn(`n8n.emit ${event} to ${safeHost(raw)}: ${message}`);
      // A refused target (SSRF guard) is permanent; a network error or timeout is worth a retry.
      const refused = /private address|only http|credentials|not a URL/.test(message);
      return { url: raw, ok: false, error: message.slice(0, 120), transient: !refused };
    }
  }
}

const safeHost = (raw: string): string => {
  try {
    return new URL(raw).host;
  } catch {
    return "invalid-url";
  }
};
