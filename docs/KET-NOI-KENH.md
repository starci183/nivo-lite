# Kết nối SePay, Telegram, Zalo OA cho một workspace

Cả ba kết nối được làm trong app, ở trang **Kết nối** (`/connections`) của workspace. Chỉ owner hoặc manager mới thấy trang này.
Khi lưu kết nối, app kiểm tra creds, mã hóa AES-256-GCM bằng `CHANNEL_TOKEN_KEY` rồi ghi vào bảng `connection_secrets`. Chỉ service role đọc được bảng này.
App không bao giờ trả creds về trình duyệt. Vì vậy không cần file creds hay script import riêng. Nếu creds được ghi tạm ra file thì sau khi lưu xong phải xóa file đó.

## 0. Chuẩn bị (làm một lần)

1. Deploy bản sửa redirect `0.0.0.0:3000` (nhánh `fix/site-origin`), bằng cách merge vào `main`. Push lên `main` sẽ tự chạy workflow "Deploy web".
   Nếu chưa có bản sửa này thì đăng nhập Google và bước cấp quyền Zalo OA (OAuth) sẽ bị đẩy về `0.0.0.0:3000`.
2. `cto.nivo@gmail.com` đăng nhập `nivo.vn` một lần (bằng Google) để tạo tài khoản. Email này nằm trong `NIVO_PLATFORM_ADMINS` nên vào được `/admin`.
3. Tạo workspace: vào `/workspaces/new`, chọn gói, đặt tên, chọn loại hình. Workspace lúc này ở trạng thái `pending_payment`.
4. Kích hoạt workspace: vào `/admin`, mở workspace vừa tạo, bấm **Extend** rồi **Confirm**.
5. Mời founder: trong workspace vào `/team`, mời `founder.nivo@gmail.com` với vai trò `owner` hoặc `manager`. Có thể bấm "Copy invite link" để gửi link.

## 1. Telegram (dễ nhất, nên làm trước)

Cần có: **bot token** từ @BotFather.

1. Trên Telegram, nhắn @BotFather (có dấu tích xanh) lệnh `/newbot`, đặt tên và username cho bot (username phải kết thúc bằng `bot`).
2. Sao chép toàn bộ token BotFather gửi lại (dạng `123456:ABC-...`).
3. Trên `nivo.vn/connections`, chọn **Bot Telegram** rồi dán token và lưu. App tự làm các việc sau:
   - gọi `getMe` để kiểm tra token;
   - mã hóa và lưu token;
   - đăng ký webhook `https://nivo.vn/api/telegram/<connectionId>` với Telegram, kèm một secret ngẫu nhiên.
4. Kiểm tra: nhắn bot một tin. Agent Chatbot phải trả lời, và tin nhắn phải hiện trong Inbox.

## 2. SePay (tiền vào tài khoản ngân hàng, để agent Kế toán đối soát)

Cần có: tài khoản **my.sepay.vn** đã liên kết ngân hàng nhận tiền, và biết **tên ngân hàng cùng số tài khoản** đó.
Với SePay thì NIVO tạo API Key, rồi mình dán key đó sang SePay. Không có key nào phải lấy từ SePay về.

1. Trên `nivo.vn/connections`, chọn **Nguồn tiền về (SePay)**. Chọn môi trường **Thử nghiệm** trước, rồi nhập ngân hàng và số tài khoản.
2. NIVO hiện ra: Tên webhook, URL nhận webhook (`https://nivo.vn/api/connections/sepay/<connectionId>`) và API Key.
3. Trên SePay, vào Test Mode, mở trang Webhook (`my.sepay.vn/testmode/webhook`) và thêm webhook:
   - Tên webhook và URL: dán từ NIVO;
   - Loại giao dịch: **Tiền vào**; Định dạng: **JSON**; bật **Tự động gửi lại**;
   - Tài khoản ngân hàng: chọn đúng tài khoản đã nhập ở bước 1;
   - Kiểu xác thực: **API Key**, dán API Key của NIVO, rồi Lưu.
4. Kiểm tra: trên SePay vào Giao dịch, bấm **Mô phỏng giao dịch**, nhập 2.000đ vào đúng tài khoản. Bên NIVO phải báo đã nhận.
5. Khi chạy thật: làm lại các bước trên với môi trường **Chính thức** (`my.sepay.vn/webhook`), rồi chuyển một khoản nhỏ thật để kiểm tra.

SePay để thu tiền gói NIVO (trang thanh toán khi tạo workspace) là một cấu hình khác, chung cho cả platform. Nó dùng các biến
`SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_*` và `SEPAY_ACCOUNT_NAME`, đặt trong `secrets.env`, rồi đẩy lên production bằng `node scripts/env-sync.mjs`.
Các biến này đã có giá trị.

## 3. Zalo OA (đang ở mức "Thử nghiệm sớm", chưa thử với OA thật)

Cần có:
- tài khoản Zalo là **quản trị viên của OA**;
- quyền vào **developers.zalo.me**;
- **App ID**, **App Secret** (khóa bí mật của ứng dụng) và **OA Secret Key** (ở trang Webhook của ứng dụng).

1. Vào developers.zalo.me, đăng nhập bằng tài khoản quản trị OA, bấm **Tạo ứng dụng**. Lấy App ID và App Secret ở trang Cài đặt chung.
2. Trên `nivo.vn/connections`, chọn **Zalo OA** rồi dán App ID và App Secret. NIVO hiện ra Callback URL và Webhook URL.
3. Trong ứng dụng Zalo, vào mục **Official Account**:
   - liên kết đúng OA của cửa hàng;
   - dán **Official Account Callback URL** từ NIVO;
   - ở mục Quyền, xin các quyền: quản lý tin nhắn, thông tin người quan tâm, gửi tin tư vấn.
4. Trong ứng dụng Zalo, vào mục **Webhook**:
   - dán Webhook URL từ NIVO (`https://nivo.vn/api/connections/zalo/<connectionId>`);
   - bật các sự kiện `user_send_text` và `follow`;
   - sao chép **OA Secret Key** rồi dán vào NIVO.
5. Trên NIVO, bấm cấp quyền. Zalo mở trang đồng ý, sau đó quay về `nivo.vn/connections` (bước này cần bản sửa ở mục 0.1).
   NIVO lưu access token và refresh token đã mã hóa, và tự làm mới token.
6. Kiểm tra: dùng một tài khoản Zalo khác, quan tâm OA rồi nhắn một tin. Agent Chatbot phải trả lời trong khung thời gian Zalo cho phép trả lời.

Lưu ý: Zalo có thể yêu cầu xét duyệt ứng dụng hoặc xác thực OA trước khi cấp các quyền tin nhắn. Bước này phải chờ Zalo.

## Khi lỗi

- Trang Kết nối báo "chỉ chạy trên https": production chưa đặt `NEXT_PUBLIC_SITE_URL=https://nivo.vn`. `env-sync` tự đặt biến này.
- Báo lỗi "không giải mã được creds": `CHANNEL_TOKEN_KEY` ở production đã đổi. Phải nhập lại creds của các kết nối.
- Lỗi của app được ghi vào bảng `app_errors`, và creds đã được che trước khi ghi. Xem ở `/admin/health`.
