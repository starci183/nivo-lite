import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import type { DriveFileRead, DriveFolderListing, DriveGrantState, DriveReachPort } from "./drive-reach.port"
import {
    GOOGLE_DRIVE_CASE,
    GOOGLE_DRIVE_GRANT_OPERATION,
    GOOGLE_DRIVE_LIST_OPERATION,
    GOOGLE_DRIVE_READ_OPERATION,
    GOOGLE_DRIVE_SANDBOX_CUT_LISTING,
    GOOGLE_DRIVE_SANDBOX_EMPTY_LISTING,
    GOOGLE_DRIVE_SANDBOX_LISTING,
    GOOGLE_DRIVE_SANDBOX_PROVIDER,
    googleDriveSandboxReadOf,
} from "./google-drive-sandbox.catalogue"
import {
    driveGrantLost,
    driveNoAccess,
    driveTokenRejected,
    driveTooLarge,
    driveTypeUnsupported,
    driveUnavailable,
} from "./google-drive-sandbox.failures"

@Injectable()
/**
 * Google Drive's SANDBOX implementation of the Drive port (R56 / R62): used when the Drive account is a sandbox account. It answers
 * through the generic sandbox frame from the hardcoded catalogue (`GOOGLE_DRIVE_SANDBOX_CATALOGUE`), reaches no Google host and holds no
 * token; one logged call per request, keyed by the folder or file id asked.
 *
 * The account's sticky NEXT CASE of each operation picks the outcome, never the id asked: `grant` answers `connected` (GOOGLE_DRIVE-1,
 * default), `none` (-2) or `lost` (-3); `listFolder` answers the sandbox folder's three files (-4, default), an empty folder (-5), the
 * listing the limits cut (-6), or throws what the live Drive client throws: the token refused (-7), the item not openable (-8), a server
 * failure (-9), the grant lost (-10); `readFile` answers the name and text of a file the sandbox Drive holds (-11, default; any other id is
 * refused as a file the account cannot open, as Drive's 404 is) or throws too large (-12), type unsupported (-13), not openable (-14),
 * unavailable (-15). Each operation answers by its own case: a read does not consult the grant's case. A listing and a read are reads: no
 * case has an unknown outcome. The failures are the integration's own errors, built in `./google-drive-sandbox.failures` (this class
 * reaches no integration).
 */
export class GoogleDriveSandboxReachService implements DriveReachPort {
    /** The provider key. */
    readonly provider: typeof GOOGLE_DRIVE_SANDBOX_PROVIDER = GOOGLE_DRIVE_SANDBOX_PROVIDER

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** The state of the account's grant by the next case of `grant` (default: connected). */
    async grant(connection: ConnectionRecord): Promise<DriveGrantState> {
        return await this.sandbox.call(connection, GOOGLE_DRIVE_GRANT_OPERATION, {}, {
            answer: (state): DriveGrantState => {
                if (state.nextCase === GOOGLE_DRIVE_CASE.notGranted) return "none"
                return state.nextCase === GOOGLE_DRIVE_CASE.grantLost ? "lost" : "connected"
            },
        })
    }

    /** The folder's files by the next case of `list` (default: the three files of the sandbox folder). */
    async listFolder(connection: ConnectionRecord, folderId: string): Promise<DriveFolderListing> {
        return await this.sandbox.call(connection, GOOGLE_DRIVE_LIST_OPERATION, { folderId }, {
            key: folderId,
            answer: (state): DriveFolderListing => {
                switch (state.nextCase) {
                    case GOOGLE_DRIVE_CASE.emptyFolder:
                        return GOOGLE_DRIVE_SANDBOX_EMPTY_LISTING
                    case GOOGLE_DRIVE_CASE.truncated:
                        return GOOGLE_DRIVE_SANDBOX_CUT_LISTING
                    case GOOGLE_DRIVE_CASE.listTokenRejected:
                        throw driveTokenRejected()
                    case GOOGLE_DRIVE_CASE.listNoAccess:
                        throw driveNoAccess()
                    case GOOGLE_DRIVE_CASE.listUnavailable:
                        throw driveUnavailable()
                    case GOOGLE_DRIVE_CASE.listGrantLost:
                        throw driveGrantLost()
                    default:
                        return GOOGLE_DRIVE_SANDBOX_LISTING
                }
            },
        })
    }

    /** One file's name and text by the next case of `read` (default: the file the sandbox Drive holds under that id). */
    async readFile(connection: ConnectionRecord, fileId: string): Promise<DriveFileRead> {
        return await this.sandbox.call(connection, GOOGLE_DRIVE_READ_OPERATION, { fileId }, {
            key: fileId,
            answer: (state): DriveFileRead => {
                switch (state.nextCase) {
                    case GOOGLE_DRIVE_CASE.tooLarge:
                        throw driveTooLarge()
                    case GOOGLE_DRIVE_CASE.typeUnsupported:
                        throw driveTypeUnsupported()
                    case GOOGLE_DRIVE_CASE.readNoAccess:
                        throw driveNoAccess()
                    case GOOGLE_DRIVE_CASE.readUnavailable:
                        throw driveUnavailable()
                    default: {
                        const read = googleDriveSandboxReadOf(fileId)
                        if (read === null) throw driveNoAccess()
                        return read
                    }
                }
            },
        })
    }
}
