import { createAuthClient } from "@starci/auth/client"
import type { AuthClient } from "@starci/auth/client"
import { apiOrigin } from "@/modules/config"

/** The one instance of the front end: the doors of the app's own back end, the access token in its memory, one shared refresh. */
export const auth: AuthClient = createAuthClient({ apiOrigin: () => apiOrigin() })
