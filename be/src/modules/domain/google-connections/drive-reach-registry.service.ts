import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "@modules/domain/provider-registry"
import type { DriveReachPort } from "./drive-reach.port"

@Injectable()
/**
 * The Google Drive account, its live port (the stored grant token against Drive) and its sandbox twin (the hardcoded catalogue):
 * a consumer resolves the port of an ACCOUNT through `portFor`, THE ONE SWITCH.
 */
export class DriveReachRegistryService extends ProviderRegistryService<DriveReachPort> {}
