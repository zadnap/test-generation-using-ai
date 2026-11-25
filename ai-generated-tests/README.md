# Test AI sinh và đo coverage

Thực hiện các lệnh bên dưới bằng **PowerShell tại thư mục gốc repository**, sau khi đã cài dependencies.

## Chạy test

Chạy toàn bộ test AI sinh:

```powershell
npx vitest run --config ai-generated-tests/vitest.config.mts
```

Chạy riêng test của một module:

```powershell
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/websockets
```

## Chọn phạm vi coverage

Biến môi trường `COVERAGE_MODULES` chọn **source được đo coverage**, không giới hạn test được chạy. Các lệnh dưới đây chạy toàn bộ test AI sinh.

### Một module

```powershell
$env:COVERAGE_MODULES = 'common'
npx vitest run --config ai-generated-tests/vitest.config.mts --coverage
```

Thay `common` bằng tên thư mục trực tiếp trong `packages/`, ví dụ `core`, `microservices`, `platform-express`, `platform-fastify`, `platform-node`, `platform-socket.io`, `platform-ws`, `testing` hoặc `websockets`.

### Nhiều module

Phân cách tên module bằng dấu phẩy:

```powershell
$env:COVERAGE_MODULES = 'platform-fastify,platform-socket.io,websockets'
npx vitest run --config ai-generated-tests/vitest.config.mts --coverage
```

### Toàn bộ module

```powershell
$env:COVERAGE_MODULES = 'all'
npx vitest run --config ai-generated-tests/vitest.config.mts --coverage
```

Không đặt biến môi trường cũng mặc định là `all`. Biến đã đặt tồn tại trong phiên PowerShell hiện tại; để xóa:

```powershell
Remove-Item Env:COVERAGE_MODULES -ErrorAction SilentlyContinue
```

Tên module không hợp lệ hoặc kết hợp `all` với tên module khác sẽ khiến cấu hình báo lỗi.

## Đo coverage và MC/DC bằng Supercov

`--coverage` của Vitest chỉ cho biết dòng/nhánh đã chạy. Số liệu MC/DC (mỗi điều kiện nguyên tử được đánh giá cả true và false trong một cặp kiểm chứng hợp lệ) lấy bằng Supercov:

```powershell
npx supercov -- npx vitest run --config ai-generated-tests/vitest.config.mts
```

Supercov chạy lại lệnh bên trong rồi lưu một "run" vào `.supercov/runs/`; toàn bộ suite mất khoảng 2–3 phút. Lệnh đo **không in bảng bộ phủ** — nó chỉ ghi run và in dòng `[coverage] evidence: ...`. Chạy kèm lệnh truy vấn để thấy bảng ngay:

```powershell
npx supercov -- npx vitest run --config ai-generated-tests/vitest.config.mts
npx supercov runs latest
```

Chỉ xem lại bảng của vòng mới nhất (không chạy lại test):

```powershell
npx supercov runs latest
```

Xem các điều kiện MC/DC còn thiếu, sắp theo file:

```powershell
npx supercov runs latest gaps --metric mcdc --limit 50
```

Xem chi tiết một file, hoặc một dòng (chỉ ra điều kiện nào chưa được quan sát và cặp giá trị còn thiếu):

```powershell
npx supercov runs latest file --metric mcdc packages/platform-node/router/node-router.ts
npx supercov runs latest line --metric mcdc "packages/core/scanner.ts:125"
```

Chạy riêng một spec để kiểm tra nhanh (khoảng 1 phút, nhưng số liệu chỉ phủ phần test của spec đó):

```powershell
npx supercov -- npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/core/scanner.spec.ts
```

Lưu log để đối chiếu giữa các vòng:

```powershell
npx supercov -- npx vitest run --config ai-generated-tests/vitest.config.mts 2>&1 |
  Tee-Object -FilePath ai-generated-tests/supercov-round6.log
```

Lưu ý:

- Số liệu dùng để báo cáo trước/sau phải lấy từ **full suite**, cùng config và cùng phạm vi source; chạy riêng một spec chỉ để kiểm tra nhanh.
- Sửa bất kỳ file test nào sau khi đo sẽ khiến run cũ bị đánh dấu `STALE`; phải chạy lại full suite trước khi trích số.
- Exit code `1` là bình thường khi còn test fail do môi trường (kafka/mqtt/rmq, `EADDRINUSE`, timeout 5s); coverage vẫn được ghi và vẫn đọc được.
- `runs latest` có thể trỏ vào run lẻ của một spec; khi cần đúng vòng full suite, dùng id ở dòng `[coverage] evidence: .supercov/runs/run_xxx`.

Số liệu tham chiếu của bộ test AI hiện tại (scope `ai-generated-tests/vitest.config.mts`):

| Vòng | Run | Lines | Branches | MC/DC |
| --- | --- | --- | --- | --- |
| Baseline | `run_5b466e0edd39e571` | 81,17% | 91,74% | 91,69% (3.683/4.017) |
| Hiện tại (HEAD `e283fc5`) | `run_9ab9c53b4a55554f` | 81,74% | 92,30% | 95,94% (3.854/4.017) |

Suite hiện tại gồm 406 spec trong `ai-generated-tests/packages/**` và 405 spec trong `ai-generated-tests/full-project/packages/**`; cả hai đều được `include: ['ai-generated-tests/**/*.spec.ts']` nhặt vào. Con số ở trên là của đúng trạng thái đã push lên `main`.

## Phạm vi và cách đọc kết quả

- Source được đo: `packages/**/*.ts`, hoặc các thư mục module đã chọn.
- Loại trừ: `node_modules`, file `.d.ts`, `.spec.ts`, `.test.ts` và các thư mục `packages/**/test/**`.
- Các file production như adapter, service và module vẫn được tính; không loại bỏ chỉ vì khó kiểm thử.
- `All files` tổng hợp các file thuộc phạm vi coverage sau khi áp dụng loại trừ. Chọn `all` sẽ tính cả module chưa có test AI, nên tỷ lệ có thể thấp.
- `% Branch` là Branch Coverage do V8/Vitest báo cáo, không đồng nghĩa với C3 hay bằng chứng mọi điều kiện nguyên tử đã được đánh giá cả true và false. Số MC/DC lấy từ Supercov, xem mục "Đo coverage và MC/DC bằng Supercov".
- Coverage đo bằng toàn bộ suite có thể bao gồm các lần thực thi gián tiếp từ test của module khác.

Khi so sánh trước/sau hoặc giữa các bộ test, giữ nguyên phạm vi source, quy tắc loại trừ và coverage provider.

## Báo cáo

Cấu hình xuất bảng terminal, HTML và JSON summary:

| Phạm vi | Thư mục kết quả |
| --- | --- |
| Một module | `ai-generated-tests/coverage/common/` (ví dụ) |
| Nhiều module | `ai-generated-tests/coverage/platform-fastify+platform-socket.io+websockets/` (ví dụ) |
| Toàn bộ | `ai-generated-tests/coverage/all/` |

Mở `index.html` trong thư mục tương ứng để xem báo cáo HTML; đọc `coverage-summary.json` để lấy số liệu tổng hợp. Chạy lại cùng phạm vi sẽ ghi đè báo cáo trong cùng thư mục.

Các hướng dẫn này sử dụng `ai-generated-tests/vitest.config.mts`. Lệnh `npm run coverage` sử dụng cấu hình coverage ở root, với bộ test và quy tắc loại trừ khác, nên kết quả không so sánh trực tiếp được.
