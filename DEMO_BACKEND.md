# Tài khoản và cách chạy demo

Sau khi chạy migration + seed dữ liệu, hệ thống có sẵn 4 tài khoản để test đủ role:

| Role | Username | Password | Đường dẫn sau đăng nhập |
|---|---|---|---|
| Admin | `admin` | `admin123` | `/dashboard` |
| Nhân viên | `staff` | `staff123` | `/staff` |
| Gia sư | `tutor_1` | `tutor123` | `/tutor` |
| Phụ huynh | `parent` | `parent123` | `/customer` |

## Chạy bằng Docker

```bash
cd tutor_module-main
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api`
- pgAdmin: `http://localhost:5050`

Docker compose sẽ tự chạy migrate và seed dữ liệu mẫu khi backend khởi động lần đầu.

## Chạy thủ công bằng SQLite để test nhanh

```bash
cd backend
pip install -r requirements.txt
USE_SQLITE=True python manage.py migrate
USE_SQLITE=True python manage.py seed_db --clear
USE_SQLITE=True python manage.py runserver
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Các API role chính

- Admin: `/api/v1/admin/...`
- Nhân viên: `/api/v1/staff/...`
- Gia sư: `/api/v1/tutor/...`
- Phụ huynh: `/api/v1/customer/...`

Các nút chính trong giao diện đã được nối với backend: thêm/sửa/khóa tài khoản, duyệt nhân viên/gia sư/lớp học, tạo lớp, gửi lời mời gia sư, nhận lớp, ghi nhận buổi dạy, xác nhận buổi học, thanh toán học phí, cập nhật học viên và gửi đánh giá.
