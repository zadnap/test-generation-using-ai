# Đo độ phủ bộ test full-project

Bộ test AI nằm trong `ai-generated-tests/full-project/packages`. Cấu hình riêng chỉ chạy các file `ai-generated-tests/full-project/**/*.spec.ts`.

Chạy các lệnh dưới đây **tại thư mục gốc repository**, sau khi đã cài dependency bằng `npm ci`. Supercov yêu cầu Node.js 22 trở lên.

## Chạy test

```powershell
npx vitest run --config ai-generated-tests/full-project/vitest.config.mts
```

## Đo coverage bằng Vitest (V8)

```powershell
npx vitest run --config ai-generated-tests/full-project/vitest.config.mts --coverage
```

Các chỉ số: statements, branches, functions và lines. Phạm vi mã nguồn là `packages/**/*.ts`, loại trừ declaration (`*.d.ts`), test (`*.spec.ts`, `*.test.ts`) và các thư mục `packages/**/test/**`.

Báo cáo được ghi vào `ai-generated-tests/full-project/coverage/`:

- [HTML](coverage/index.html): xem chi tiết theo file.
- [JSON summary](coverage/coverage-summary.json): số liệu tổng hợp.
- [JSON](coverage/coverage-final.json): dữ liệu coverage chi tiết.

Cấu hình bật `reportOnFailure`, nên vẫn có báo cáo khi test lỗi. Cần kiểm tra cả kết quả test và độ phủ; coverage cao không đồng nghĩa toàn bộ test đạt.

## Đo thêm MC/DC bằng Supercov

```powershell
npx --yes supercov -- npx vitest run --config ai-generated-tests/full-project/vitest.config.mts
```

Supercov chạy cùng bộ test và ghi nhận thêm **Modified Condition/Decision Coverage (MC/DC)**: mỗi điều kiện trong một quyết định phải có bằng chứng rằng nó có thể độc lập làm thay đổi kết quả quyết định. Branch coverage không thay thế chỉ số này.

Không cần thêm `--coverage` của Vitest vào lệnh Supercov. Đây là phép đo riêng; không ghép trực tiếp phần trăm của hai công cụ vì cách xác định phạm vi và các nghĩa vụ coverage có thể khác nhau.

Lệnh chạy test lưu dữ liệu Supercov; để hiển thị bảng độ phủ, chạy tiếp lệnh sau tại thư mục gốc repository:

```powershell
npx supercov runs latest
```

Liệt kê các phần còn thiếu bằng chứng coverage:

```powershell
npx supercov runs latest gaps --limit 10
```

Xuất báo cáo HTML:

```powershell
npx supercov report
```

Báo cáo Supercov nằm trong `.supercov/reports/` tại thư mục gốc repository. Khi đọc kết quả, kiểm tra trạng thái test và các giới hạn đo được Supercov báo trước khi kết luận về MC/DC.

### Kết quả tham khảo

Lần chạy `run_5f60aedee3e73bd2` với bộ test này ghi nhận:

| Chỉ số | Độ phủ | Đã phủ / Tổng |
| --- | --- | --- |
| Lines | 81,19% | 19.235 / 23.690 |
| Branches | 91,72% | 9.999 / 10.902 |
| MC/DC | 91,64% | 3.681 / 4.017 |

Đây là **kết quả chẩn đoán, chưa dùng làm ngưỡng đánh giá đạt**:

- 6.849 test đạt, 24 test lỗi, tổng 6.873 test; lệnh test kết thúc với mã 1.
- Instrumentation chưa đầy đủ: 371 file chưa được phân loại, gồm 364 file trong `sample` và 7 file trong `tools`.
- 234 test có assertion nhưng Supercov không nhận được bằng chứng coverage mã nguồn.

Các số liệu này thuộc phạm vi đo của Supercov trong lần chạy trên, không phải phạm vi `packages/**/*.ts` đã cấu hình riêng cho V8. Cần xác định phạm vi nguồn và xử lý các giới hạn đo trước khi so sánh hai báo cáo hoặc kết luận MC/DC cho toàn dự án.

### Windows: Application Control chặn executable

Nếu `npx` báo `spawn UNKNOWN`, hãy kiểm tra việc khởi động `supercov.exe`. Một nguyên nhân đã gặp trên Windows là **An Application Control policy has blocked this file**; lỗi xảy ra trước khi Vitest chạy.

Smart App Control không hỗ trợ ngoại lệ cho từng ứng dụng. Kiểm tra tại **Windows Security → App & browser control → Smart App Control settings**. Tắt tính năng này ảnh hưởng bảo vệ toàn máy; khả năng bật lại phụ thuộc bản Windows và cập nhật. Nếu máy do tổ chức quản lý, liên hệ quản trị viên. Xem [hướng dẫn Microsoft](https://support.microsoft.com/en-gb/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions).

Sau khi giải quyết chính sách chặn, kiểm tra `npx --yes supercov --version` rồi chạy lại lệnh đo.

Tham khảo: [Supercov cho JavaScript/TypeScript](https://supercov.com/docs/javascript), [tiêu chí MC/DC](https://supercov.com/docs/mcdc).
