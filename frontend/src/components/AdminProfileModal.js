'use client';

function formatValue(value) {
  if (value === null || value === undefined || value === '') return 'Chưa cập nhật';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).toLocaleDateString('vi-VN');
  }
  return String(value);
}

function flattenProfile(profile) {
  const rows = [];
  (profile.sections || []).forEach((section) => {
    (section.items || []).forEach((item) => {
      if (item.label) {
        rows.push({ label: item.label, value: item.value });
        return;
      }
      Object.entries(item || {}).forEach(([key, value]) => rows.push({ label: key, value }));
    });
  });
  return rows;
}

export default function AdminProfileModal({ profile, onClose }) {
  if (!profile) return null;

  const user = profile.user || {};
  const rows = flattenProfile(profile);
  const title = `Thông tin ${profile.roleLabel ? profile.roleLabel.toLowerCase() : 'tài khoản'}`;

  return (
    <div className="form-modal-backdrop" onClick={onClose}>
      <div className="form-modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="form-modal-header">
          <div>
            <h2>{title}</h2>
            <p className="modal-subtitle">{profile.profileName || user.username || 'Chưa cập nhật'}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>×</button>
        </div>

        <div className="form-grid two profile-readonly-grid">
          <label>Họ tên<input value={profile.profileName || user.display_name || user.username || 'Chưa cập nhật'} disabled /></label>
          <label>Email<input value={user.email || 'Chưa cập nhật'} disabled /></label>
          <label>Số điện thoại<input value={user.phone || 'Chưa cập nhật'} disabled /></label>
          <label>Vai trò<input value={profile.roleLabel || user.role || 'Chưa cập nhật'} disabled /></label>
          <label>Trạng thái tài khoản<input value={user.is_active ? 'Hoạt động' : 'Đã khóa'} disabled /></label>
          <label>Trạng thái hồ sơ<input value={user.status || 'Chưa cập nhật'} disabled /></label>

          {rows
            .filter((row) => !['Họ tên', 'Email', 'Số điện thoại', 'Trạng thái tài khoản', 'Trạng thái hồ sơ'].includes(row.label))
            .map((row, index) => (
              <label key={`${row.label}-${index}`}>{row.label}<input value={formatValue(row.value)} disabled /></label>
            ))}
        </div>

        <div className="form-modal-actions">
          <button className="primary-button" type="button" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
