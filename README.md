## Các bước làm

1. Tải node: https://nodejs.org/en
2. Clone project: https://github.com/nestjs/nest
3. Chạy

```
cd nest
npm install
cd ../
npm install
```

4. Prompt và chọn module được giao

- Prompt cho AI gen ra test vào trong folder ai-generated-tests
- Đừng sửa vitest.config.mts

5. Prompt tiếp tới khi nào hết quota (vắt cực khô)
6. Xem coverage hiện tại

```
npx vitest run \
  --config ai-generated-tests/vitest.config.mts \
  --coverage
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
