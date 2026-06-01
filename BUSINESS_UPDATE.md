# Bản cập nhật nghiệp vụ trung tâm gia sư

Bản này đã được chỉnh theo yêu cầu chức năng/luồng nghiệp vụ 4 vai trò: Admin, Staff, Gia sư và Phụ huynh/Học viên.

## Các điểm đã chỉnh chính

### Admin
- Đồng bộ trạng thái lớp: chờ duyệt, đang tìm gia sư, chờ gia sư xác nhận, đang học, tạm dừng, hoàn thành, đã hủy.
- Bổ sung trường khối lớp, học phí phụ huynh đóng, lương gia sư, ghi chú admin cho lớp học.
- Dashboard thống kê số lượng user, staff, gia sư, học viên, phụ huynh, lớp học, lớp chờ duyệt.
- Tài chính có doanh thu học phí, hoa hồng, hoàn tiền, tổng lương gia sư và lợi nhuận dự kiến.

### Staff
- Tiếp nhận yêu cầu tìm gia sư và tạo lớp để gửi Admin duyệt.
- Tìm/lọc gia sư theo thông tin hồ sơ, lịch rảnh, rating, trạng thái xác thực.
- Giao gia sư cho lớp, theo dõi trạng thái lớp, buổi học, nghỉ/dạy bù và thanh toán.
- Bổ sung trường học phí phụ huynh đóng và lương gia sư khi tạo lớp.

### Gia sư
- Quản lý hồ sơ, năng lực, khu vực dạy, lịch rảnh theo thứ/giờ bắt đầu/giờ kết thúc.
- Xem lớp đề xuất/lớp đang dạy, đăng ký nhận lớp, ghi nhật ký buổi học.
- Gửi yêu cầu nghỉ/dạy bù, theo dõi thu nhập, đánh giá.

### Phụ huynh/Học viên
- Gửi yêu cầu tìm gia sư theo môn, khối lớp, khu vực, lịch học, học phí.
- Theo dõi lớp học, lịch học/nghỉ/bù, thông tin gia sư, học phí và đánh giá gia sư.

## Lưu ý chạy lại

Sau khi lấy bản zip này, nên chạy lại migrate vì có thêm trường mới cho bảng lớp học và trạng thái thanh toán:

```bash
cd backend
python manage.py migrate
python manage.py seed_db
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```
