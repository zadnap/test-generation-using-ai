## Các bước làm

1. Tải node: https://nodejs.org/en
2. Chạy

```
npm install
```

4. Prompt và chọn module được giao

- Prompt cho AI gen ra test vào trong folder ai-generated-tests
- Lưu ý là các thay đổi được push lên github chỉ được nằm trong ai-generated-tests và test_generation_progress.md thôi nhé

5. Prompt tiếp tới khi nào hết quota (vắt cực khô)
6. Xem coverage hiện tại

```
npx --yes supercov -- npx vitest run --config ai-generated-tests/full-project/vitest.config.mts
npx supercov runs latest
```

7. Commit, nhớ viết thay đổi vào commit theo convention

```
test(module): add ...
```

8. Push

## Chia module

- Phan Mạnh: testing + platform-node
- Nguyễn Mạnh: core + platform-fastify
- Trần Mạnh: microservices + platform-ws
- Anh Minh: platform-express + platform-socket.io
- Hoàng Minh: common + websockets
