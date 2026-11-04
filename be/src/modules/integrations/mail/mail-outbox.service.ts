import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Writable } from "node:stream"
import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { InjectMailSettings } from "./mail.decorators"
import type { MailOptions } from "./mail.options"
import { outboxEntryOf, parseOutboxEntry, selectEntries } from "./mail-outbox.policy"
import type { OutboxEntry, OutboxQuery } from "./mail-outbox.policy"

const EXTENSION = ".json"

@Injectable()
/**
 * The development outbox: every message the suppress list held is kept as one JSON file in the folder `MAIL_OUTBOX_DIR` names, so a
 * test run can read its confirmation link. With no folder configured (production) it keeps nothing. It is read through the cli only.
 */
export class MailOutboxService {
    constructor(
        @InjectMailSettings() private readonly settings: MailOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
    ) {}

    /** Keeps one held message; does nothing when the outbox is not configured. */
    async record(to: string, subject: string, text: string): Promise<void> {
        const dir = this.settings.outboxDir
        if (dir === null) return
        const at = this.clock.now()
        await mkdir(dir, { recursive: true })
        await writeFile(
            join(dir, `${String(at.getTime())}-${this.ids.next()}${EXTENSION}`),
            JSON.stringify(outboxEntryOf(at, to, subject, text)),
            "utf8",
        )
    }

    /** The kept messages the query asks for, oldest first. */
    async entries(query: OutboxQuery): Promise<ReadonlyArray<OutboxEntry>> {
        const dir = this.settings.outboxDir
        if (dir === null) return []
        const names = (await this.namesIn(dir)).filter((name) => name.endsWith(EXTENSION))
        const documents = await Promise.all(names.map((name) => this.entryIn(join(dir, name))))
        return selectEntries(
            documents.filter((entry): entry is OutboxEntry => entry !== undefined),
            query,
        )
    }

    private async namesIn(dir: string): Promise<ReadonlyArray<string>> {
        try {
            return await readdir(dir)
        } catch (cause) {
            if (isRecord(cause) && cause.code === "ENOENT") return []
            throw cause
        }
    }

    private async entryIn(path: string): Promise<OutboxEntry | undefined> {
        const read = parseJsonText(await readFile(path, "utf8"))
        return read.ok ? parseOutboxEntry(read.value) : undefined
    }

    /** Writes the asked messages to the stream: one line per message (time, recipient, subject) and one per link. */
    async report(query: OutboxQuery, out: Writable): Promise<void> {
        const found = await this.entries(query)
        for (const entry of found) {
            out.write(`${entry.at} ${entry.to} ${entry.subject}\n`)
            for (const link of entry.links) out.write(`  link ${link}\n`)
        }
        if (found.length === 0) out.write("no message\n")
    }
}
