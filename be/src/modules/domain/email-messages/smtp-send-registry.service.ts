import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "@modules/domain/provider-registry"
import type { SmtpSendPort } from "./smtp-send.contracts"

@Injectable()
/** The workspace SMTP send, each provider key with its live route (the account's own mail server) and its sandbox twin (the call log). */
export class SmtpSendRegistryService extends ProviderRegistryService<SmtpSendPort> {}
