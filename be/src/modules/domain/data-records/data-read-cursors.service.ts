import { Injectable, Optional } from "@nestjs/common"
import { AccountCursorsService } from "@modules/domain/account-data"
import { eachInOrder } from "@modules/platform/primitives"
import { cursorKeyOf, isForward, seenThroughOf } from "./data-read-cursors.policy"
import type { HubReader } from "./data-records.contracts"
import { IMAP_READ_CURSOR_TYPE } from "./imap.data-types"

/** The most connections one read of an agent's points looks across. */
const POINTS_MAX = 50

/** How many times a lost compare-and-set is read again before the point is left to the writer that moved it. */
const ADVANCE_ATTEMPTS = 3

@Injectable()
/**
 * How far each agent was handed the mails of each mailbox: an `imap.read-cursor` row of the mailbox's account data per agent and entity
 * (NIVO's own bookkeeping, so a scheduled read hands each mail once). It holds a point, never any content of a mail, never writes the
 * mail server, and only moves forward. An app that registers no account data keeps no point (a proof world without mailboxes).
 */
export class DataReadCursorsService {
    constructor(@Optional() private readonly cursors?: AccountCursorsService) {}

    /** The saved point of the reader on each of the connections (at most 50), by connection; a connection never read has none. */
    async pointsOf(reader: HubReader, connectionIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>> {
        const points = new Map<string, string>()
        const cursors = this.cursors
        if (cursors === undefined) return points
        await eachInOrder(connectionIds.slice(0, POINTS_MAX), async (connectionId) => {
            const row = await cursors.read(connectionId, IMAP_READ_CURSOR_TYPE, cursorKeyOf(reader))
            const seen = row === null ? null : seenThroughOf(row.value)
            if (seen !== null) points.set(connectionId, seen)
        })
        return points
    }

    /**
     * Saves the reader's point on one connection: the last row it was handed. Compare-and-set, forward only: when another read moved the
     * point first, the point is read again and the greater one stays; a point that is not past the saved one changes nothing.
     */
    async advance(reader: HubReader, connectionId: string, seenThrough: string): Promise<void> {
        await this.advanceFrom(reader, connectionId, seenThrough, ADVANCE_ATTEMPTS)
    }

    /** One compare-and-set of the point against the saved one; a lost race reads again while attempts are left. */
    private async advanceFrom(reader: HubReader, connectionId: string, seenThrough: string, attempts: number): Promise<void> {
        const cursors = this.cursors
        if (attempts === 0 || cursors === undefined) return
        const row = await cursors.read(connectionId, IMAP_READ_CURSOR_TYPE, cursorKeyOf(reader))
        const saved = row === null ? null : seenThroughOf(row.value)
        if (!isForward(saved, seenThrough)) return
        const value = { agentId: reader.agentId, entity: reader.entity, seenThrough }
        if (await cursors.advance(connectionId, IMAP_READ_CURSOR_TYPE, saved, value)) return
        await this.advanceFrom(reader, connectionId, seenThrough, attempts - 1)
    }
}
