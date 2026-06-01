import '../src/App.css';

export const metadata = {
  title: 'Quản lý trung tâm gia sư',
  description: 'Bảng điều khiển quản lý trung tâm gia sư',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
