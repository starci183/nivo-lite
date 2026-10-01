# Triển khai engine lên VPS

Bộ này dựng trên **một VPS Ubuntu**: `caddy` (TLS, cửa công khai duy nhất), `engine`, `openclaw`, `n8n` (kèm Postgres riêng). **Không có gì trong repo tự chạy lên máy thật**: bạn chạy từng bước dưới đây khi đã có VPS.

## 0. Cần chuẩn bị (danh sách người dùng phải cung cấp)

| Cần | Ghi chú |
| --- | --- |
| VPS Ubuntu 22.04 hoặc 24.04 | Tối thiểu 2 vCPU, 4 GB RAM, 40 GB SSD cho giai đoạn đầu (OpenClaw + n8n + Postgres + engine). 8 GB nếu chạy nhiều agent song song. IPv4 công khai. |
| Tên miền | Hai bản ghi A (và AAAA nếu có IPv6): `n8n.<domain>` và `engine.<domain>` trỏ về VPS, **trước** lần chạy đầu để Caddy xin được chứng chỉ. |
| Quyền SSH | Người dùng không phải root, đăng nhập bằng khoá, thuộc nhóm `docker`. |
| Supabase | `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` của dự án (migration `engine_jobs` đã áp dụng). |
| URL ứng dụng Next | `NIVO_BASE_URL` (Netlify). |
| Giấy phép/khoá OpenClaw | Image `ghcr.io/openclaw/openclaw` công khai; nếu bản bạn dùng cần giấy phép hoặc registry riêng, cung cấp. Cần thêm tag đã kiểm thử. |
| Khoá model | Khoá nhà cung cấp mà agent OpenClaw dùng (OpenRouter, Anthropic, OpenAI hoặc DeepSeek). |
| Ba secret tự sinh | `ENGINE_SHARED_SECRET`, `OPENCLAW_GATEWAY_TOKEN`, `N8N_ENCRYPTION_KEY` (`openssl rand -hex 32`), cùng `N8N_DB_PASSWORD`. |

## 1. Cổng và tường lửa

| Cổng | Ai nghe | Công khai? |
| --- | --- | --- |
| 22/tcp | sshd | Có (chỉ SSH) |
| 80/tcp, 443/tcp, 443/udp | caddy | Có (80 để Let's Encrypt và chuyển hướng sang HTTPS) |
| 127.0.0.1:18789 | OpenClaw gateway | **Không** (chỉ loopback, vào Control UI bằng SSH tunnel) |
| 8787 (trong namespace của openclaw) | engine: `/healthz`, `/readyz`, `/tools/*` | Chỉ trong mạng compose. Caddy chỉ công khai `/healthz` và `/readyz` |
| 5678 | n8n | Chỉ trong mạng compose, ra ngoài qua Caddy |
| 5432 | n8n-db | Chỉ trong mạng compose |

```bash
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
sudo ufw enable
```

**Lưu ý quan trọng:** Docker xuất bản cổng bằng iptables của riêng nó và **bỏ qua UFW**. Vì vậy an toàn không đến từ UFW mà từ chính compose: chỉ `caddy` xuất bản 80/443, `openclaw` xuất bản duy nhất `127.0.0.1:18789`. Đừng thêm `ports:` cho n8n, n8n-db hay engine. Sau khi chạy, kiểm tra từ máy khác: `nmap -Pn <ip>` chỉ được thấy 22, 80, 443.

Cứng hoá SSH (`/etc/ssh/sshd_config`): `PermitRootLogin no`, `PasswordAuthentication no`; cân nhắc `fail2ban`.

## 2. Cài Docker (một lần)

Theo hướng dẫn chính thức cho Ubuntu (https://docs.docker.com/engine/install/ubuntu/), rồi `sudo usermod -aG docker $USER` và đăng nhập lại. Cần Docker Compose v2.

## 3. Cấu hình `.env` trên VPS

```bash
sudo mkdir -p /opt/nivo-engine && sudo chown $USER /opt/nivo-engine
# sau lần deploy.sh đầu (bước 4) hoặc copy tay:
cd /opt/nivo-engine/deploy
cp .env.example .env && chmod 600 .env
nano .env        # điền mọi biến; mỗi biến có chú thích
```

`.env` chứa khoá toàn quyền: không commit, không gửi qua chat, lưu bản sao trong trình quản lý mật khẩu. Mất `N8N_ENCRYPTION_KEY` nghĩa là phải nhập lại mọi credential trong n8n.

## 4. Deploy

Từ máy của bạn (thư mục `engine/deploy`):

```bash
DRY_RUN=1 DEPLOY_HOST=deploy@<ip> ./deploy.sh     # xem trước các lệnh, không chạy gì
DEPLOY_HOST=deploy@<ip> ./deploy.sh               # rsync mã nguồn, docker compose up -d --build
```

Script kiểm tra build cục bộ, rsync `engine/` (không gồm `node_modules`, `dist`, `dev`, `.env*`; `.env` trên VPS được giữ nguyên), kiểm tra `compose config`, rồi `up -d --build`. Biến: `DEPLOY_HOST` (bắt buộc), `DEPLOY_PATH` (mặc định `/opt/nivo-engine`), `DEPLOY_SSH_PORT`, `DEPLOY_SSH_OPTS`, `DEPLOY_PUSH_ENV=1` (copy `deploy/.env.prod` thành `.env` với quyền 600).

Lần đầu `deploy.sh` sẽ dừng ở bước kiểm tra `.env`: tạo `.env` theo bước 3 rồi chạy lại.

## 5. Sau lần chạy đầu

1. **n8n**: mở `https://n8n.<domain>` và tạo tài khoản chủ ngay (người đầu tiên vào sẽ là chủ). Khuyến nghị đặt `N8N_ALLOWED_CIDRS` bằng IP của bạn cho lần đầu. Tạo workflow có node Webhook với path `nivo-events` để khớp `N8N_DEFAULT_WEBHOOK_URL`.
2. **OpenClaw**: cấu hình nhà cung cấp model và tạo agent. Control UI qua tunnel: `ssh -L 18789:127.0.0.1:18789 deploy@<ip>` rồi mở `http://127.0.0.1:18789`. Engine dùng agent `ws-<8 ký tự đầu workspace id>-chatbot` cho mỗi workspace (hoặc bật `OPENCLAW_MANAGE_AGENTS=1` sau khi xác minh schema).
3. **Ứng dụng Next (Netlify)**: đặt biến `ENGINE_SHARED_SECRET` **cùng giá trị** rồi deploy lại.
4. **Kiểm tra**: `curl https://engine.<domain>/healthz` trả `{"status":"ok",...}`. Trong Settings của module Chatbot, thẻ **Bộ xử lý** hiển thị nhịp tim; chọn *OpenClaw (máy chủ riêng)* và gửi một tin thử.
5. `docker compose --env-file .env logs -f engine` để xem job chạy.

Nếu engine ngừng, ứng dụng tự trả lời bằng bộ xử lý mặc định (không có nhịp tim trong 90 giây), nên khách không phải chờ.

## 6. Sao lưu

Dữ liệu trạng thái nằm trong 5 volume: `n8n-db` (Postgres của n8n), `n8n-data`, `openclaw-data` (cấu hình, agent, phiên), `caddy-data` (chứng chỉ), `caddy-config`. Hàng đợi `engine_jobs` nằm ở Supabase (đã nằm trong sao lưu của Supabase). Engine không có trạng thái cục bộ.

```bash
cd /opt/nivo-engine/deploy
BACKUP_DIR=/var/backups/nivo-engine ./backup.sh            # pg_dump n8n + tar các volume, giữ 14 ngày
# cron hằng đêm 02:30:
# 30 2 * * * cd /opt/nivo-engine/deploy && BACKUP_DIR=/var/backups/nivo-engine ./backup.sh >> /var/log/nivo-backup.log 2>&1
```

Cùng một VPS không phải bản sao lưu độc lập: **chép `BACKUP_DIR` sang nơi khác** (rclone tới object storage, hoặc máy khác). Cất `.env` riêng trong trình quản lý mật khẩu. Khôi phục: dựng stack mới, `docker compose stop n8n`, nạp lại `pg_restore -U n8n -d n8n --clean` vào `n8n-db`, giải nén tarball vào volume tương ứng, rồi `up -d`. **Hãy thử khôi phục trên máy thử trước khi tin vào bản sao lưu.**

## 7. Cập nhật và quay lại

- Cập nhật engine: `./deploy.sh` lại. Engine nhận SIGTERM, chờ job đang chạy tối đa 30 giây, trả phần còn lại về hàng đợi.
- Đổi tag OpenClaw/n8n: sửa `OPENCLAW_TAG` / `N8N_TAG` trong `.env`, `docker compose --env-file .env up -d`. n8n tự migrate database khi khởi động: **sao lưu trước**, và không thể hạ phiên bản sau khi đã migrate.
- Quay lại engine: `git checkout` bản cũ, `./deploy.sh`. Migration SQL chỉ tiến (tạo migration mới thay vì sửa file đã áp dụng).

## 8. Xử lý sự cố nhanh

| Triệu chứng | Kiểm tra |
| --- | --- |
| Thẻ Bộ xử lý báo "không phản hồi" | `docker compose ps`; `logs engine`; `SUPABASE_*` đúng chưa (engine ghi `claim failed`) |
| Mọi lượt đều `direct_fallback` | `logs engine` tìm `OpenClaw failed (...)`: sai token (`NOT_PAIRED`), thiếu scope (`missingScope`: engine phải ở `network_mode: service:openclaw`), agent chưa tồn tại, timeout |
| Caddy không xin được chứng chỉ | DNS chưa trỏ đúng, cổng 80/443 bị chặn |
| `/api/engine/*` trả 401 | `ENGINE_SHARED_SECRET` hai bên khác nhau, hoặc đồng hồ VPS lệch hơn 5 phút (`timedatectl`) |
| Job `failed` | `select kind, status, error from engine_jobs order by created_at desc limit 20;` |
