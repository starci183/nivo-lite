import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspacePruneService } from "@modules/domain/workspaces"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { WorkspaceCleanupError, WorkspaceCleanupErrorCode } from "./errors/workspace-cleanup.error"
import { CLEANUP_RECEIPT_PREFIX } from "./messages/workspace-cleanup.messages"
import type { KeptUserRow, UserReferenceRow, WorkspaceFootprintRow } from "./persistence/workspace-cleanup.rows"
import {
    KEPT_USERS_MAX,
    LIST_KEPT_USERS,
    LIST_USER_REFERENCES,
    LIST_WORKSPACE_FOOTPRINTS,
    WORKSPACE_SCAN_MAX,
} from "./persistence/workspace-cleanup.sql"
import { assertUserReferences, userReferencesOf } from "./user-references.policy"
import {
    buildReceipt,
    cleanupModeOf,
    digestMatches,
    keptWorkspacesOf,
    orphanAccountsOf,
    parseKeepList,
    receiptDigestOf,
} from "./workspace-cleanup.policy"
import type {
    CleanupCommand,
    CleanupReceipt,
    CleanupReport,
    OrphanUser,
    UserReferences,
} from "./workspace-cleanup.contracts"
import { InjectCleanupAccounts, InjectWorkspaceCleanupOptions } from "./workspace-cleanup.decorators"
import type { CleanupAccounts, CleanupAuthUser, WorkspaceCleanupOptions } from "./workspace-cleanup.options"

const USERS_PER_PAGE = 200
const USER_PAGES_MAX = 50

const incomplete = (): never => {
    throw new WorkspaceCleanupError({ code: WorkspaceCleanupErrorCode.ScanIncomplete })
}

@Injectable()
/**
 * Cleans a database down to the kept workspaces. A dry run prints the receipt (each workspace to remove with its row counts per
 * cascading table, each account no kept workspace holds) and its digest; it already refuses an account whose delete kept data
 * would block, or would cascade into without `--allow-kept-cascade`. An execute runs a fresh dry run first and goes on only when
 * its digest is the reviewed one; it deletes the workspaces through the workspaces owner's prune (the schema cascade), then the
 * orphan accounts one at a time through Auth, stopping at the first failure. A re-run surveys again and finds what is left. It
 * never runs DELETE of its own and never resets the database.
 */
export class WorkspaceCleanupService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly workspacePrune: WorkspacePruneService,
        @InjectCleanupAccounts() private readonly accounts: CleanupAccounts,
        @InjectWorkspaceCleanupOptions() private readonly options: WorkspaceCleanupOptions,
    ) {}

    /** Runs the cleanup the command names and prints its receipt line; an execute deletes only on a matching digest. */
    async run(command: CleanupCommand): Promise<CleanupReport> {
        const keep = parseKeepList(command.keep)
        const mode = cleanupModeOf(command)
        const receipt = await this.survey(keep, command.allowKeptCascade === true)
        const digest = receiptDigestOf(receipt)
        if (mode === "dry-run") return this.print({ mode, digest, receipt, deletedUsers: [], remainingUsers: [] })
        if (!digestMatches(digest, command.receiptDigest)) {
            throw new WorkspaceCleanupError({ code: WorkspaceCleanupErrorCode.DigestMismatch })
        }
        await this.workspacePrune.prune(
            { keep, default: false, yes: true },
            { print: (line) => this.options.print(line), ask: () => Promise.resolve("") },
        )
        const deletedUsers: Array<string> = []
        const failure = await this.removeUsers(receipt.orphanUsers, deletedUsers)
        const remainingUsers = receipt.orphanUsers.slice(deletedUsers.length).map((user) => user.id)
        const report = this.print({ mode, digest, receipt, deletedUsers, remainingUsers })
        if (failure !== null) {
            throw new WorkspaceCleanupError({
                code: WorkspaceCleanupErrorCode.UserDeleteFailed,
                params: { deleted: deletedUsers.length, remaining: remainingUsers.join(",") },
                cause: failure,
            })
        }
        return report
    }

    /** Reads the workspaces with their footprint, the kept and the orphan accounts and their references, into the receipt. */
    private async survey(keep: ReadonlyArray<string>, allowKeptCascade: boolean): Promise<CleanupReceipt> {
        const workspaces = await this.entityManager.query<Array<WorkspaceFootprintRow>>(LIST_WORKSPACE_FOOTPRINTS, [
            keep,
        ])
        if (workspaces.length >= WORKSPACE_SCAN_MAX) incomplete()
        keptWorkspacesOf(keep, workspaces)
        const kept = await this.entityManager.query<Array<KeptUserRow>>(LIST_KEPT_USERS, [keep])
        if (kept.length >= KEPT_USERS_MAX) incomplete()
        const orphans = orphanAccountsOf(await this.listUsers(), new Set(kept.map((row) => row.user_id)))
        const references = await this.referencesOf(orphans, keep)
        assertUserReferences(references, allowKeptCascade)
        return buildReceipt({ keep, workspaces, orphans, references, allowKeptCascade })
    }

    /** What deleting each orphan account would do to kept data; no query when there is no orphan. */
    private async referencesOf(
        orphans: ReadonlyArray<CleanupAuthUser>,
        keep: ReadonlyArray<string>,
    ): Promise<ReadonlyMap<string, UserReferences>> {
        const ids = orphans.map((user) => user.id)
        if (ids.length === 0) return new Map()
        const rows = await this.entityManager.query<Array<UserReferenceRow>>(LIST_USER_REFERENCES, [ids, keep])
        return userReferencesOf(ids, rows)
    }

    /** Every account, page by page, refused when Auth fails or the bounded scan does not reach the end. */
    private async listUsers(page = 1, users: Array<CleanupAuthUser> = []): Promise<ReadonlyArray<CleanupAuthUser>> {
        const result = await this.accounts.listUsers({ page, perPage: USERS_PER_PAGE })
        if (result.error !== null) throw new WorkspaceCleanupError({ code: WorkspaceCleanupErrorCode.AuthFailed })
        users.push(...result.data.users)
        if (result.data.users.length < USERS_PER_PAGE) return users
        if (page >= USER_PAGES_MAX) incomplete()
        return this.listUsers(page + 1, users)
    }

    /** Deletes the orphan accounts in turn into `deleted`; the first failure stops the run and is answered (null when none). */
    private removeUsers(orphans: ReadonlyArray<OrphanUser>, deleted: Array<string>): Promise<unknown> {
        return eachInOrder(orphans, async (user) => {
            const answer = await this.accounts.deleteUser(user.id).catch((cause: unknown) => ({
                error: { message: cause instanceof Error ? cause.message : String(cause) },
            }))
            if (answer.error !== null) {
                this.options.print(`  FAILED account ${user.id}: ${answer.error.message}`)
                throw new WorkspaceCleanupError({
                    code: WorkspaceCleanupErrorCode.UserDeleteFailed,
                    params: { user: user.id },
                })
            }
            deleted.push(user.id)
            this.options.print(`  deleted account ${user.id}`)
        }).then(
            () => null,
            (cause: unknown) => cause,
        )
    }

    /** Prints the receipt line and answers the report. */
    private print(report: CleanupReport): CleanupReport {
        this.options.print(`${CLEANUP_RECEIPT_PREFIX}${JSON.stringify(report)}`)
        return report
    }
}
