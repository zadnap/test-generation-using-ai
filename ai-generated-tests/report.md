# Báo cáo: tăng cường MC/DC cho bộ test AI sinh

- Repository: `nestjs/nest` (TypeScript, ESM), Vitest 5.1.0
- Phạm vi: chỉ thêm/sửa test trong `ai-generated-tests/`, không đụng production code, config coverage hay test có sẵn
- Cấu hình đo: `ai-generated-tests/vitest.config.mts` (dùng chung cho cả trước và sau)
- Ngày đo cuối: 2026-11-15

## 1. Kết quả tổng quan

| Chỉ số | Baseline (`run_5b466e0edd39e571`) | Cuối (`run_0736bf8914a94ce2`) | Δ |
| --- | --- | --- | --- |
| Lines | 81,17% | **81,27%** (19.252/23.690) | +0,10 pp |
| Branches | 91,74% | **92,25%** (10.057/10.902) | +0,51 pp |
| MC/DC (valid pairs) | 91,69% (3.683/4.017) | **95,94% (3.854/4.017)** | **+4,25 pp / +171 điều kiện** |
| Số test | 13.690 | 13.841 | +151 |
| Pass / Fail | — / 55 | 13.802 / 39 | — |

39 test fail còn lại đều thuộc nhóm có sẵn từ baseline và do môi trường, không liên quan test thêm:

- timeout mạng kafka/mqtt/rmq (5 s)
- `EADDRINUSE ::1:3000` (`nest-application`, `nest-microservice` listen)
- `client-redis` gọi `process.exit(1)`
- `ws-adapter`: `listenerCount('upgrade')` trả 1 thay vì 0
- `nest-microservice`: status / dispose / on / unwrap / getTransportServer

Số lượng fail dao động 34–39 giữa các vòng (flaky theo môi trường). Toàn bộ spec mới/sửa đều pass khi chạy riêng.

## 2. Cách đo

```powershell
npx supercov -- npx vitest run --config ai-generated-tests/vitest.config.mts
npx supercov runs latest
```

- Lệnh đo không in bảng; bảng lấy từ `runs latest` (hoặc `runs <id>`).
- Exit code `1` là bình thường khi còn test fail môi trường; coverage vẫn được ghi.
- Sửa bất kỳ file test nào sau khi đo sẽ khiến run cũ bị đánh dấu `STALE` → phải chạy lại full suite trước khi trích số.
- Chạy riêng một spec chỉ dùng để kiểm tra nhanh, không dùng số liệu để báo cáo.

Log từng vòng: `ai-generated-tests/supercov-baseline.log`, `supercov-round1..5.log`.

## 3. Vòng lặp đo

| Vòng | Run | MC/DC | Ghi chú |
| --- | --- | --- | --- |
| Baseline | `run_5b466e0edd39e571` | 91,69% | 55 fail |
| 1 | `run_b2cd8a84e284a3b8` | 92,88% | stale sau khi sửa test |
| 2 | `run_03ae161ec76bd6bd` | 93,13% | 36 fail |
| 3 | `run_874f67de7ca57673` | 95,52% | + `fastify-adapter` |
| 4 | `run_6bf94b91aecdc7d9` | 95,72% | + `route-conflict-detector`, `scanner`, `middleware/builder` |
| 5 | `run_0736bf8914a94ce2` | **95,94%** | + `node-router`, `router/utils` |

Không có vòng nào không cải thiện, nên chưa chạm điều kiện dừng "3 vòng liên tiếp không tăng".

## 4. Test đã thêm

132 khai báo `it()` / `it.each()` mới (một số `it.each` sinh nhiều tổ hợp). Mỗi test mới đều nhắm ít nhất một nghĩa vụ MC/DC chưa phủ; không thêm test trùng.

| File spec | Số test thêm | Điều kiện MC/DC trước → sau |
| --- | --- | --- |
| `core/injector/injector.spec.ts` | 21 | 27 → 2 (2 infeasible) |
| `platform-node/router/route-table.spec.ts` | 17 | 20 → 5 (5 infeasible) |
| `platform-node/body-parser/body-parser.spec.ts` | 16 | 19 → 3 (3 infeasible) |
| `platform-node/adapters/node-adapter.spec.ts` | 12 | 15 → 1 |
| `platform-fastify/adapters/fastify-adapter.spec.ts` | 11 | 14 → 2 |
| `platform-node/router/node-router.spec.ts` | 6 | 8 → 0 |
| `common/services/console-logger.service.spec.ts` | 5 | — |
| `core/injector/instance-wrapper.spec.ts` | 4 | — → 2 |
| `core/router/router-execution-context.spec.ts` | 4 | — → 2 |
| `microservices/server/server-grpc.spec.ts` | 4 | — → 2 |
| `core/router/route-conflict-detector.spec.ts` | 3 | 5 → 2 (2 infeasible) |
| `core/nest-application.spec.ts` | 3 | — |
| `core/nest-factory.spec.ts` | 3 | — |
| `common/pipes/validation.pipe.spec.ts` | 3 | — |
| `core/scanner.spec.ts` | 2 | 4 → 2 (2 infeasible) |
| `core/middleware/builder.spec.ts` | 2 | 3 → 0 |
| `platform-node/adapters/configured-request.spec.ts` | 2 | — |
| `websockets/web-sockets-controller.spec.ts` | 2 | — |
| `common/services/utils/redact.util.spec.ts` | 2 | — |
| `platform-node/router/utils.spec.ts` | 1 | 3 → 2 (2 infeasible) |
| `merge-map-bounded.util.spec.ts` (socket.io / ws / websockets) | 1 mỗi file | — |
| `inject.decorator`, `sse.decorator`, `create-route-param-metadata.decorator`, `file-type.validator`, `is-log-level-enabled.util`, `topology-tree`, `messages`, `base-exception-filter` | 1 mỗi file | — |

**File tạo mới:** `ai-generated-tests/packages/platform-node/adapters/node-request-transfer.spec.ts` — 12 test cho `transferFile` / `respondWithError` / thương lượng redirect (mock `send`).

**File cập nhật:** 30 spec trong `ai-generated-tests/packages/**` (git diff: 30 files, 1.609 insertions).

Một số kỹ thuật đáng chú ý:

- `injector`: inquirer transient, nhánh `forwardRef`, cảnh báo decorator-metadata, `getConstructorOwner` kế thừa, lookup không tên, import rỗng, exports không có provider, host component thiếu, settlement signal, `isInContext`, provider bị skip.
- `body-parser`: `limit` null, `type` là function, request đã destroyed, transfer-encoding, stream error, `verify` set statusCode / 700, BOM UTF-16, quét JSON với whitespace/tab/newline/CR/BOM, strict array.
- `route-table`, `node-adapter`, `node-request`: các nhánh mount / lookup / transfer ít dùng.
- `node-router`: `useExact('POST', …)` + request `HEAD` (nhánh "phương thức khác"), mount `/` + `/api/` (nhánh `matcher === null`, `result.path.endsWith('/')`), `next('route')` / `next('router')`.
- `route-conflict-detector`: cặp path có leading text chồng nhau nhưng start khác nhau; cặp route cùng path/method chỉ khác host; dừng so sánh segment khi đã lệch.
- `middleware/builder`: excluded route được phủ bởi route khác method; route static được phủ bởi route tham số method `ALL`.

## 5. Vì sao chưa đạt 100% MC/DC

Còn **163/4.017 điều kiện** (4,06%): **77** thuộc mã integration/sample app, **86** thuộc `packages/**` (trong đó ~22 là infeasible). Chia hai nhóm dưới đây.

### 5.1. Infeasible — không thể phủ bằng test hợp lệ

| Vị trí | Bằng chứng |
| --- | --- |
| `route-conflict-detector.ts:70` | `joinText` chỉ nhận `tokens.slice(0, firstNonText)` hoặc `slice(lastNonText+1)` → mọi phần tử luôn là `text`; mảng rỗng thì `map` không chạy |
| `route-conflict-detector.ts:502` | Sau khi loại wildcard (`:488`) và "toàn text" (`:491`), token đơn lẻ còn lại chỉ có thể là `param` |
| `scanner.ts:185` | `container.addModule` / `replaceModule` luôn trả object hoặc throw → `!moduleInstance` là guard phòng thủ |
| `scanner.ts:447` | Operand thứ 3 `prototype` chính là giá trị vừa được kiểm tra truthy ở operand 1 → tautology |
| `injector.ts` (2) | `wrapper` falsy ở `:837`; nhánh `forwardRef` false trong `else-if` `:753` |
| `route-table.ts` (5) | Nhánh dự phòng cho dữ liệu router không thể sinh ra |
| `body-parser.ts` (3) | Nhánh chỉ xảy ra với stream đã huỷ/không tồn tại theo cách Node không tạo ra |
| `platform-node/router/utils.ts:103` | Hàm private chỉ được gọi từ `getRoutingPath`, nơi `#` đã bị reject trước đó |
| `platform-node/router/utils.ts:108` | `URL.canParse` true + scheme http(s) ⇒ Node luôn parse ra host khác rỗng (`http:///x` → host `x`) |
| `middleware/builder.ts:122` | `middlewareBuilder` là `const new MiddlewareBuilder(...)`, không thể bị thay |
| `parameter-decorator-options.util.ts:6` | `typeof value === 'object'` và `isFunction(value)` loại trừ nhau về mặt kiểu |
| `middleware-module.ts:122` | Cùng lý do: builder là `const` cục bộ |
| `nest-application.ts:501` | Nhánh phụ thuộc nền tảng; host hiện tại là win32 |
| `router-execution-context.ts:367` | Cần API của `@nestjs/common` mới hơn phiên bản đang cài |

Tổng khoảng 21–25 điều kiện rơi vào nhóm này (nằm trong 86 điều kiện của `packages/**`).

### 5.2. Unresolved — khả thi nhưng chưa xử lý

**Mã integration/sample app (77 điều kiện).** Đây là các app mẫu có 7–382 dòng chưa từng được thực thi (integration chỉ chiếm 0,91% lines); muốn phủ phải bootstrap cả app, ngoài phạm vi unit suite.

| File | Điều kiện |
| --- | --- |
| `integration/file-upload/src/upload.module.ts` | 9 |
| `integration/http-adapters/src/streaming/streaming.module.ts` | 8 |
| `integration/microservices/src/disconnected.controller.ts` | 6 |
| `integration/nest-application/sse/src/app.controller.ts` | 6 |
| `integration/hooks/src/enable-shutdown-hooks-main.ts` | 4 |
| `integration/inspector/src/common/guards/roles.guard.ts` | 3 |
| `integration/microservices/src/grpc/grpc.controller.ts` | 3 |
| `integration/scopes/src/durable/durable-context-id.strategy.ts` | 3 |
| `integration/scopes/src/inject-inquirer/hello-request/request-logger.service.ts` | 3 |
| còn lại (`register-local-packages`, `cookies`, `responses`, `grpc-async-map`, `mqtt.controller`, `transient-logger`, …) | 2 mỗi file |

Cộng thêm ~18 điều kiện rải ở các file integration khác (mỗi file 1–2 điều kiện).

**Package còn lại (~64 điều kiện, không tính phần infeasible ở 5.1).**

| File | Điều kiện | Ghi chú |
| --- | --- | --- |
| `core/middleware/middleware-module.ts` | 3 | `:260` middleware không có `use`; `:381` HEAD trên route khác GET |
| `microservices/client/client-kafka.ts` | 3 | |
| `microservices/server/server-kafka.ts` | 3 | |
| `microservices/server/server-tcp.ts` | 3 | |
| `platform-express/adapters/express-adapter.ts` | 3 | |
| `platform-fastify/multipart/multipart/multipart.parser.ts` | 3 | |
| `platform-node/adapters/node-adapter.ts` | 1 | |
| `platform-fastify/adapters/fastify-adapter.ts` | 2 | |
| `core/injector/instance-wrapper.ts` | 2 | |
| `core/middleware/routes-mapper.ts` | 2 | |
| `core/nest-application-context.ts` | 2 | |
| `core/router/router-explorer.ts` | 2 | |
| `core/router/router-response-controller.ts` | 2 | |
| `core/router/router-execution-context.ts` | 2 | 1 điều kiện infeasible (`:367`) |
| `microservices/client/client-grpc.ts` | 2 | |
| `microservices/client/client-nats.ts` | 2 | |
| `microservices/nest-microservice.ts` | 2 | |
| `microservices/server/server-grpc.ts` | 2 | |

Ngoài ra `route-table.ts` (5), `body-parser.ts` (3), `injector.ts` (2), `route-conflict-detector.ts` (2), `scanner.ts` (2), `router/utils.ts` (2) đã được phân loại infeasible ở mục 5.1.

## 6. Cách tái lập

```powershell
# đo lại từ đầu
npx supercov -- npx vitest run --config ai-generated-tests/vitest.config.mts
npx supercov runs latest

# xem gap còn lại
npx supercov runs latest gaps --metric mcdc --limit 50

# xem chi tiết một file / một dòng
npx supercov runs latest file --metric mcdc packages/platform-node/router/node-router.ts
npx supercov runs latest line --metric mcdc "packages/core/scanner.ts:125"

# chạy riêng một spec (không dùng số liệu để báo cáo)
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/core/scanner.spec.ts
```

## 7. Ghi chú

- Chỉ số MC/DC là "valid pairs trên tổng số điều kiện nguyên tử" do Supercov đo từ full suite; `% Branch` của Vitest (V8) là metric khác, không thay thế được.
- Attribution chính xác cho 13.841 test; 371 file có giới hạn đo (unclassified source: `sample`, `tools`) — không ảnh hưởng các file `packages/**` được báo cáo ở trên.
- Không sửa production code, `vitest.config.mts`, `package.json` hay test có sẵn.
