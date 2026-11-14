import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "./provider-registry.service"
import type { CalendarPort } from "./calendar-ports.contracts"

@Injectable()
/** The providers that keep a calendar (generic purpose: free slots, events). */
export class CalendarRegistryService extends ProviderRegistryService<CalendarPort> {}
