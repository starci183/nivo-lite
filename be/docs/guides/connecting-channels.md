# Connecting SePay, Telegram and Zalo OA to a workspace

All three connections are made in the app, on the **Connections** page (`/connections`) of the workspace. Only an owner or a manager sees this page.
When a connection is saved, the app checks the credentials, encrypts them with AES-256-GCM under `CHANNEL_TOKEN_KEY` and writes them to the `connection_secrets` table. Only the service role can read this table.
The app never returns credentials to the browser, so no credential file or import script is needed. If credentials were written to a file for a moment, delete that file once the connection is saved.

The webhook and callback URLs below keep their public paths across the lite cutover: the edge sends every `/api/` path of the product hosts to the api (`deploy/edge/dynamic/routes.yml`), so nothing has to be changed on the provider side.

## 0. Preparation (once)

1. Make sure the site origin is correct in production (`NEXT_PUBLIC_SITE_URL=https://nivo.vn`). Without it, Google sign-in and the Zalo OA authorisation step (OAuth) are redirected to `0.0.0.0:3000`.
2. `cto.nivo@gmail.com` signs in to `nivo.vn` once (with Google) to create the account. This email is listed in `NIVO_PLATFORM_ADMINS`, so it can open `/admin`.
3. Create a workspace: open `/workspaces/new`, choose a plan, a name and a business type. The workspace is now in the `pending_payment` state.
4. Activate the workspace: open `/admin`, open the new workspace, press **Extend** and then **Confirm**.
5. Invite the founder: in the workspace open `/team` and invite `founder.nivo@gmail.com` as `owner` or `manager`. "Copy invite link" can be used to send the link.

## 1. Telegram (the easiest, do it first)

You need: a **bot token** from @BotFather.

1. On Telegram, message @BotFather (the verified account) with `/newbot`, then choose a name and a username for the bot (the username must end in `bot`).
2. Copy the whole token BotFather sends back (it looks like `123456:ABC-...`).
3. On `nivo.vn/connections`, choose **Telegram bot**, paste the token and save. The app then does the following by itself:
   - calls `getMe` to verify the token;
   - encrypts and stores the token;
   - registers the webhook `https://nivo.vn/api/telegram/<connectionId>` with Telegram, together with a random secret.
4. Check: send the bot a message. The Chatbot agent must answer, and the message must appear in the Inbox.

## 2. SePay (money arriving in the bank account, for the Accounting agent to reconcile)

You need: an account on **my.sepay.vn** linked to the bank that receives the money, and the **bank name and account number** of that account.
With SePay, NIVO generates the API key and you paste it into SePay. No key has to be fetched from SePay.

1. On `nivo.vn/connections`, choose **Incoming money (SePay)**. Pick the **Test** environment first, then enter the bank and the account number.
2. NIVO shows: the webhook name, the webhook receiving URL (`https://nivo.vn/api/connections/sepay/<connectionId>`) and the API key.
3. On SePay, open Test Mode, open the Webhook page (`my.sepay.vn/testmode/webhook`) and add a webhook:
   - webhook name and URL: paste them from NIVO;
   - transaction type: **Incoming money**; format: **JSON**; turn on **Automatic retry**;
   - bank account: choose the account entered in step 1;
   - authentication type: **API key**, paste the NIVO API key, then save.
4. Check: on SePay open Transactions, press **Simulate transaction** and enter 2,000 VND for that account. NIVO must report that it was received.
5. For real use: repeat the steps with the **Production** environment (`my.sepay.vn/webhook`), then transfer a small real amount to check.

The SePay account that collects the NIVO plan fee (the payment page shown when a workspace is created) is a separate configuration shared by the whole platform. It uses the variables
`SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_*` and `SEPAY_ACCOUNT_NAME`, kept in `secrets.env` and pushed to production with `node scripts/env-sync.mjs`.
These variables already have values.

## 3. Zalo OA (at the "early test" level, not yet tried with a real OA)

You need:

- a Zalo account that is an **administrator of the OA**;
- access to **developers.zalo.me**;
- the **App ID**, the **App Secret** (the application's secret key) and the **OA Secret Key** (on the application's Webhook page).

1. Open developers.zalo.me, sign in with the OA administrator account and press **Create application**. Take the App ID and the App Secret from the general settings page.
2. On `nivo.vn/connections`, choose **Zalo OA** and paste the App ID and the App Secret. NIVO shows the Callback URL and the Webhook URL.
3. In the Zalo application, open the **Official Account** section:
   - link the shop's OA;
   - paste the **Official Account Callback URL** from NIVO;
   - under Permissions, ask for: manage messages, follower information, send consultation messages.
4. In the Zalo application, open the **Webhook** section:
   - paste the Webhook URL from NIVO (`https://nivo.vn/api/connections/zalo/<connectionId>`);
   - turn on the events `user_send_text` and `follow`;
   - copy the **OA Secret Key** and paste it into NIVO.
5. In NIVO, press authorise. Zalo opens its consent page and then returns to `nivo.vn/connections` (this step needs the site origin from section 0.1).
   NIVO stores the access token and the refresh token encrypted and refreshes the token by itself.
6. Check: with another Zalo account, follow the OA and send a message. The Chatbot agent must answer within the time window Zalo allows for replies.

Note: Zalo may require the application to be reviewed or the OA to be verified before it grants the messaging permissions. This step has to wait for Zalo.

## When something fails

- The Connections page says "only works over https": production does not have `NEXT_PUBLIC_SITE_URL=https://nivo.vn`. `env-sync` sets it.
- The error "cannot decrypt credentials": `CHANNEL_TOKEN_KEY` in production changed. The credentials of the connections have to be entered again.
- Application errors are written to the `app_errors` table, and credentials are masked before they are written. See `/admin/health`.
