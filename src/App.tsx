import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Role } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { VictimShell } from '@/components/layout/VictimShell';
import { StaffShell } from '@/components/layout/StaffShell';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { AboutPage } from '@/pages/AboutPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { VictimHome } from '@/pages/victim/VictimHome';
import { VictimCheckIn } from '@/pages/victim/VictimCheckIn';
import { VictimTrend } from '@/pages/victim/VictimTrend';
import { VictimCaseStatus } from '@/pages/victim/VictimCaseStatus';
import { VictimSupport } from '@/pages/victim/VictimSupport';
import { CounsellorOverview } from '@/pages/counsellor/CounsellorOverview';
import { PriorityQueue } from '@/pages/counsellor/PriorityQueue';
import { CaseList } from '@/pages/counsellor/CaseList';
import { FollowUpQueue } from '@/pages/counsellor/FollowUpQueue';
import { CaseDetail } from '@/pages/counsellor/CaseDetail';
import { AdminIdentity } from '@/pages/admin/AdminIdentity';
import { AdminAudit } from '@/pages/admin/AdminAudit';
import { AdminPrivacy } from '@/pages/admin/AdminPrivacy';
import { AdminSystem } from '@/pages/admin/AdminSystem';
import { AdminChannels } from '@/pages/admin/AdminChannels';

const LANDING_FOR: Record<Role, string> = {
  victim: '/victim',
  counsellor: '/counsellor',
  admin: '/admin/identity',
};

/**
 * Role gate. An unauthenticated visitor is sent to the login; a signed-in
 * person on the wrong surface is sent to their own. District scoping is
 * enforced again in the data layer, so this guard is not the only barrier.
 */
const RequireRole = ({ roles, children }: { roles: Role[]; children: ReactNode }) => {
  const session = useAppStore((s) => s.session);
  const location = useLocation();

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(session.role)) return <Navigate to={LANDING_FOR[session.role]} replace />;
  return <>{children}</>;
};

export const App = () => (
  <ErrorBoundary>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/about" element={<AboutPage />} />

      <Route
        element={
          <RequireRole roles={['victim']}>
            <VictimShell />
          </RequireRole>
        }
      >
        <Route path="/victim" element={<VictimHome />} />
        <Route path="/victim/check-in" element={<VictimCheckIn />} />
        <Route path="/victim/trend" element={<VictimTrend />} />
        <Route path="/victim/case" element={<VictimCaseStatus />} />
        <Route path="/victim/support" element={<VictimSupport />} />
      </Route>

      <Route
        element={
          <RequireRole roles={['counsellor', 'admin']}>
            <StaffShell />
          </RequireRole>
        }
      >
        <Route path="/counsellor" element={<CounsellorOverview />} />
        <Route path="/counsellor/queue" element={<PriorityQueue />} />
        <Route path="/counsellor/cases" element={<CaseList />} />
        <Route path="/counsellor/followups" element={<FollowUpQueue />} />
        <Route path="/counsellor/case/:caseId" element={<CaseDetail />} />
        <Route path="/admin/identity" element={<AdminIdentity />} />
        <Route path="/admin/audit" element={<AdminAudit />} />
        <Route path="/admin/privacy" element={<AdminPrivacy />} />
        <Route path="/admin/channels" element={<AdminChannels />} />
        <Route path="/admin/system" element={<AdminSystem />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </ErrorBoundary>
);
