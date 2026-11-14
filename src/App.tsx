import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore, type UserRole } from './store/authStore.ts';
import { LandingPage } from './pages/LandingPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { PatientPortal } from './pages/PatientPortal.tsx';
import { DoctorPortal } from './pages/DoctorPortal.tsx';
import { HospitalPortal } from './pages/HospitalPortal.tsx';
import { PharmacyPortal } from './pages/PharmacyPortal.tsx';

function ProtectedPortalRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const { user, needsOnboarding, emailVerificationRequired, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center text-[14px] font-medium text-[#6e6e73]">
        Connecting to CareOne...
      </div>
    );
  }

  if (!user || needsOnboarding || emailVerificationRequired) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    const unsub = initAuth();
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [initAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/patient/*"
          element={
            <ProtectedPortalRoute allowedRoles={['patient']}>
              <PatientPortal />
            </ProtectedPortalRoute>
          }
        />
        <Route
          path="/doctor/*"
          element={
            <ProtectedPortalRoute allowedRoles={['doctor']}>
              <DoctorPortal />
            </ProtectedPortalRoute>
          }
        />
        <Route
          path="/hospital/*"
          element={
            <ProtectedPortalRoute allowedRoles={['hospital']}>
              <HospitalPortal />
            </ProtectedPortalRoute>
          }
        />
        <Route
          path="/pharmacy/*"
          element={
            <ProtectedPortalRoute allowedRoles={['pharmacy']}>
              <PharmacyPortal />
            </ProtectedPortalRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
