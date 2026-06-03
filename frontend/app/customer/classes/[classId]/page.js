import { Suspense } from 'react';
import AppShell from '../../../../src/components/AppShell';
import CustomerClassDetail from '../../../../src/screens/CustomerClassDetail';

export default function CustomerClassDetailPage({ params }) {
  return (
    <AppShell>
      <Suspense fallback={<div>Đang tải...</div>}>
        <CustomerClassDetail classId={params.classId} />
      </Suspense>
    </AppShell>
  );
}
