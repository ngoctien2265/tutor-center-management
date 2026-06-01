import { Suspense } from 'react';
import AppShell from '../../src/components/AppShell';
import CustomerPortal from '../../src/screens/CustomerPortal';

export default function CustomerPage() {
  return (
    <AppShell>
      <Suspense fallback={<div>Đang tải...</div>}>
        <CustomerPortal />
      </Suspense>
    </AppShell>
  );
}
