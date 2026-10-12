import { Inject, Injectable } from "@nestjs/common";
import { BULLMQ_OPTIONS, type BullmqOptions } from "./bullmq.config";
import { WORKSPACE_SLOT_LEASE_MS } from "./bullmq.policy";
import { RedisConnection } from "./redis.connection";

/**
 * Per-workspace concurrency across every worker process: a Redis sorted set per workspace whose members are the running job ids and whose
 * scores are lease expiries. Acquire is one Lua script (drop expired leases, count, add), so two workers never both take the last slot.
 * BullMQ Pro has "groups" for this; the open-source edition does not, hence this small semaphore.
 */
const ACQUIRE = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZSCORE', KEYS[1], ARGV[3]) then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
  return 1
end
if redis.call('ZCARD', KEYS[1]) < tonumber(ARGV[4]) then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
  redis.call('PEXPIRE', KEYS[1], ARGV[5])
  return 1
end
return 0
`;

@Injectable()
export class WorkspaceSemaphore {
  constructor(private readonly redis: RedisConnection, @Inject(BULLMQ_OPTIONS) private readonly options: BullmqOptions) {}

  private key(workspaceId: string): string {
    return `${this.options.prefix}:ws-slots:${workspaceId}`;
  }

  /** Take one of the workspace's slots for `jobId` (re-entrant for the same job id). False = the workspace is at its limit. */
  async acquire(workspaceId: string, jobId: string): Promise<boolean> {
    const client = this.redis.client;
    if (!client) return true;
    const now = Date.now();
    const got = await client.eval(ACQUIRE, 1, this.key(workspaceId), String(now), String(now + WORKSPACE_SLOT_LEASE_MS), jobId, String(this.options.workspaceConcurrency), String(WORKSPACE_SLOT_LEASE_MS * 2));
    return got === 1;
  }

  /** Extend the lease of a running job (called every third of the lease). */
  async renew(workspaceId: string, jobId: string): Promise<void> {
    const client = this.redis.client;
    if (!client) return;
    await client.zadd(this.key(workspaceId), "XX", Date.now() + WORKSPACE_SLOT_LEASE_MS, jobId);
    await client.pexpire(this.key(workspaceId), WORKSPACE_SLOT_LEASE_MS * 2);
  }

  async release(workspaceId: string, jobId: string): Promise<void> {
    await this.redis.client?.zrem(this.key(workspaceId), jobId);
  }

  /** Jobs of the workspace holding a slot now (for ops). */
  async running(workspaceId: string): Promise<number> {
    const client = this.redis.client;
    if (!client) return 0;
    await client.zremrangebyscore(this.key(workspaceId), "-inf", Date.now());
    return client.zcard(this.key(workspaceId));
  }
}
