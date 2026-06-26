# Demo database

Dữ liệu demo đã được nạp qua `backend/apps/users/management/commands/seed_db.py`.

## Tài khoản đăng nhập

| Vai trò | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Staff | `staff_1` | `staff123` |
| Staff | `staff_2` | `staff123` |
| Tutor | `tutor_1` | `tutor123` |
| Tutor | `tutor_2` | `tutor123` |
| Tutor | `tutor_3` | `tutor123` |
| Student | `student1` | `student123` |
| Student | `student2` | `student123` |

Một số tài khoản chờ duyệt cũng được tạo để test màn hình admin:

| Vai trò | Username | Password | Ghi chú |
|---|---|---|---|
| Staff | `staff_pending` | `staff123` | Chờ duyệt, không đăng nhập được nếu chưa approve |
| Tutor | `tutor_pending` | `tutor123` | Chờ duyệt, không đăng nhập được nếu chưa approve |

## Cách nạp lại dữ liệu

### Chạy bằng Docker

`docker-compose.yml` đã gọi sẵn:

```bash
python manage.py migrate && python manage.py seed_db --clear
```

Nên chỉ cần chạy:

```bash
docker compose up --build
```

### Chạy local bằng SQLite

```bash
cd backend
set USE_SQLITE=True
python manage.py migrate
python manage.py seed_db --clear
python manage.py runserver
```

Trên Git Bash/macOS/Linux:

```bash
cd backend
USE_SQLITE=True python manage.py migrate
USE_SQLITE=True python manage.py seed_db --clear
USE_SQLITE=True python manage.py runserver
```

