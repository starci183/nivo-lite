import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import { CONTACT_FREEZE_STORE, type ContactFreezeStore } from "./contact-freeze-store.port"

/** Injects the store of contact freezes. Parameter type: ContactFreezeStore. */
export const InjectContactFreezeStore = (): TypedParameterDecorator<ContactFreezeStore> =>
    injector<ContactFreezeStore>(CONTACT_FREEZE_STORE)
