'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './ListPage.css';

function Enrollments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null, page: 1 });
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchEnrollments();
  }, [pagination.page, pageSize]);

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/finance/enrollments/', {
        params: { page: pagination.page, page_size: pageSize }
      });
      setItems(response.data.results || []);
      setPagination({
        count: response.data.count || 0,
        next: response.data.next,
        previous: response.data.previous,
        page: pagination.page
      });
    } catch (error) {
      console.error('Không thể tải danh sách ghi danh:', error);
      toast.error('Không thể tải danh sách ghi danh');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa ghi danh này?')) {
      try {
        await axios.delete(`/finance/enrollments/${id}/`);
        toast.success('Đã xóa ghi danh thành công');
        fetchEnrollments();
      } catch (error) {
        console.error('Không thể xóa ghi danh:', error);
        toast.error('Không thể xóa ghi danh');
      }
    }
  };

  const handlePreviousPage = () => {
    if (pagination.previous) setPagination({ ...pagination, page: pagination.page - 1 });
  };

  const handleNextPage = () => {
    if (pagination.next) setPagination({ ...pagination, page: pagination.page + 1 });
  };

  if (loading && items.length === 0) {
    return <div className="list-container"><div className="loading"><span className="spinner"></span> Đang tải ghi danh...</div></div>;
  }

  return (
    <div className="list-container">
      <h1>Quản lý ghi danh</h1>

      <div className="list-controls">
        <div className="page-size-control">
          <label htmlFor="pageSize">Số mục mỗi trang:</label>
          <select id="pageSize" value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value)); setPagination({ ...pagination, page: 1 }); }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card"><p>Không tìm thấy ghi danh</p></div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Học viên</th>
                <th>Phụ huynh</th>
                <th>Lớp học</th>
                <th>Trạng thái</th>
                <th>Ngày ghi danh</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td>{enrollment.id}</td>
                  <td>{enrollment.student_id?.full_name || '-'}</td>
                  <td>{enrollment.student_id?.full_name || '-'}</td>
                  <td>{enrollment.class_id?.subject_name || '-'}</td>
                  <td>{enrollment.status}</td>
                  <td>{new Date(enrollment.enrolled_at).toLocaleDateString('vi-VN')}</td>
                  <td><button className="button button-danger" onClick={() => handleDelete(enrollment.id)}>Xóa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination">
        <button onClick={handlePreviousPage} disabled={!pagination.previous} className="button button-secondary">Trước</button>
        <span className="page-info">Trang {pagination.page} / {Math.max(1, Math.ceil(pagination.count / pageSize))} ({pagination.count} mục)</span>
        <button onClick={handleNextPage} disabled={!pagination.next} className="button button-secondary">Sau</button>
      </div>
    </div>
  );
}

export default Enrollments;
