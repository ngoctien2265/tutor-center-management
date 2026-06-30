import '../src/App.css';

export const metadata = {
  title: 'Phần mềm quản lý cho trung tâm gia sư',
  description: 'Phần mềm quản lý lớp học, gia sư, học viên và vận hành cho trung tâm gia sư',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
