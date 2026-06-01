'use client';

import { cloneElement, isValidElement, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../lib/api';
import Navigation from './Navigation';

const publicRoutes = ['/', '/login', '/register/student', '/register/tutor', '/register/staff'];

function getHomeRoute() {
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
  if (role === 'tutor') return '/tutor';
  if (role === 'staff') return '/staff';
  if (role === 'student' || role === 'parent') return '/customer';
  return '/dashboard';
}

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hasToken = !!localStorage.getItem('access_token');
    setIsLoggedIn(hasToken);
    setReady(true);

    if (!hasToken && !publicRoutes.includes(pathname)) {
      router.replace('/login');
      return;
    }

    if (hasToken && pathname === '/login') {
      router.replace(getHomeRoute());
    }
  }, [pathname, router]);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  const enhancedChildren = pathname === '/login' && isValidElement(children)
    ? cloneElement(children, { onLoginSuccess: handleLoginSuccess })
    : children;

  if (!ready) {
    return (
      <div className="App login-layout">
        <div className="loading"><span className="spinner"></span> Đang tải...</div>
        <ToastContainer position="bottom-right" />
      </div>
    );
  }

  const showNavigation = isLoggedIn && pathname !== '/login';

  return (
    <div className="App">
      {showNavigation && <Navigation onLogout={handleLogout} />}
      <div className={showNavigation ? 'app-layout' : 'login-layout'}>
        {enhancedChildren}
      </div>
      <ToastContainer position="bottom-right" />
    </div>
  );
}
