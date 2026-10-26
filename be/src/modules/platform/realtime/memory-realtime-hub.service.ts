import { Injectable } from "@nestjs/common"
import type { OnModuleDestroy } from "@nestjs/common"
import type { Entry, Replay } from "./realtime-subscriptions.policy"
import { REPLAY_FRAMES, REPLAY_TOPICS } from "./realtime.contracts"
import type { RealtimeTopic } from "./realtime.port"
import { SubscribedRealtimeHub } from "./subscribed-realtime-hub.service"

/** The string `id` a frame carries, or undefined: only a frame with an id can be resumed after. */
const idOf = (frame: object): string | undefined => {
    const id: unknown = Reflect.get(frame, "id")
    return typeof id === "string" ? id : undefined
}

@Injectable()
/**
 * The non-scale push hub, for tests and a single-replica dev run: a frame published to a topic reaches every subscription open on
 * that topic in this process in order, and is retained in a bounded buffer so a client that reconnects with its last id receives
 * what it missed. Another process has its own subscriptions and its own buffer, so a deploy with more than one api replica runs a
 * shared hub instead (the stack check refuses the memory hub there).
 */
export class MemoryRealtimeHubService extends SubscribedRealtimeHub implements OnModuleDestroy {
    private readonly retained = new Map<string, Array<Entry>>()

    /** Ends every open subscription, so no reader waits on a hub that is gone. */
    onModuleDestroy(): void {
        this.subscriptions.close()
    }

    /** Retains the frame (bounded), then pushes it to every subscription of the topic open now. */
    override publish<T extends object>(topic: RealtimeTopic<T>, frame: T): Promise<void> {
        const position = idOf(frame)
        if (position !== undefined && topic.accepts(frame)) this.retain({ topic: topic.name, frame, position })
        return super.publish(topic, frame)
    }

    protected override replay(topic: string, after: string | undefined): Promise<Replay> {
        if (after === undefined) return Promise.resolve({ entries: [] })
        const kept = this.retained.get(topic) ?? []
        return Promise.resolve({ entries: kept.slice(kept.findIndex((entry) => entry.position === after) + 1) })
    }

    private retain(entry: Entry): void {
        const kept = this.retained.get(entry.topic) ?? []
        this.retained.delete(entry.topic)
        kept.push(entry)
        if (kept.length > REPLAY_FRAMES) kept.shift()
        this.retained.set(entry.topic, kept)
        if (this.retained.size <= REPLAY_TOPICS) return
        this.retained.delete(String(this.retained.keys().next().value))
    }
}
