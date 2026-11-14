import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "@modules/domain/provider-registry"
import type { DataConnector } from "./data-hub.contracts"

@Injectable()
/**
 * The pull of a data connection, each provider key with its live connector (the account's own system) and its sandbox twin (the
 * account's hardcoded rows): `DataSyncService` resolves the connector of an account through `portFor`, THE ONE SWITCH. Registered here:
 * the mailbox (`imap`), the owner's database (`database`) and the personal Telegram (`telegram_user`).
 */
export class DataConnectorRegistryService extends ProviderRegistryService<DataConnector> {}
