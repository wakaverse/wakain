import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import LangSync from './components/LangSync';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/App/AppShell';
import AdminLayout from './components/Admin/AdminLayout';
import LandingPage from './pages/LandingPage';
import AnalyzePage from './pages/AnalyzePage';
import JobStatusPage from './pages/JobStatusPage';
import ReportPage from './pages/ReportPage';
import DashboardPage from './pages/DashboardPage';
import DemoReportPage from './pages/DemoReportPage';
import ContactPage from './pages/ContactPage';
import LoginPage from './pages/LoginPage';
import ComingSoonPage from './pages/ComingSoonPage';
import GuideReportPage from './pages/GuideReportPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminPipelinePage from './pages/admin/AdminPipelinePage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminContentPage from './pages/admin/AdminContentPage';
import AdminInquiriesPage from './pages/admin/AdminInquiriesPage';
import ComparePage from './pages/ComparePage';
import RadarPage from './pages/RadarPage';
import LibraryPage from './pages/LibraryPage';
import OnboardingPage from './pages/OnboardingPage';
import ToastContainer from './components/Toast';

function LandingRoutes() {
  return (
    <>
      <Route index element={<Layout><LandingPage /></Layout>} />
      <Route path="contact" element={<Layout><ContactPage /></Layout>} />
      <Route path="login" element={<LoginPage />} />
      <Route path="demo" element={<DemoReportPage />} />
      <Route path="app" element={<ProtectedRoute><AppShell><Navigate to="/app/analyze" replace /></AppShell></ProtectedRoute>} />
      <Route path="app/analyze" element={<ProtectedRoute><AppShell><AnalyzePage /></AppShell></ProtectedRoute>} />
      <Route path="app/library" element={<ProtectedRoute><AppShell><LibraryPage /></AppShell></ProtectedRoute>} />
      <Route path="app/radar" element={<ProtectedRoute><AppShell><RadarPage /></AppShell></ProtectedRoute>} />
      <Route path="app/compare" element={<ProtectedRoute><AppShell><ComparePage /></AppShell></ProtectedRoute>} />
      <Route path="app/insights" element={<ProtectedRoute><AppShell><ComingSoonPage menuKey="insight" /></AppShell></ProtectedRoute>} />
      <Route path="app/guide" element={<ProtectedRoute><AppShell><ComingSoonPage menuKey="guide" /></AppShell></ProtectedRoute>} />
      <Route path="app/guide/:resultId" element={<ProtectedRoute><AppShell><GuideReportPage /></AppShell></ProtectedRoute>} />
      <Route path="app/insight" element={<Navigate to="/app/insights" replace />} />
      <Route path="app/hack" element={<Navigate to="/app/analyze" replace />} />
      <Route path="app/jobs/:id" element={<ProtectedRoute><AppShell><JobStatusPage /></AppShell></ProtectedRoute>} />
      <Route path="app/results/:id" element={<ProtectedRoute><AppShell><ReportPage /></AppShell></ProtectedRoute>} />
      <Route path="app/contact" element={<ProtectedRoute><AppShell><ContactPage /></AppShell></ProtectedRoute>} />
      <Route path="dashboard" element={<ProtectedRoute><AppShell><DashboardPage /></AppShell></ProtectedRoute>} />
      {/* Admin routes */}
      <Route path="ctrl-8k3x7" element={<ProtectedRoute><AdminLayout><AdminDashboardPage /></AdminLayout></ProtectedRoute>} />
      <Route path="ctrl-8k3x7/pipeline" element={<ProtectedRoute><AdminLayout><AdminPipelinePage /></AdminLayout></ProtectedRoute>} />
      <Route path="ctrl-8k3x7/users" element={<ProtectedRoute><AdminLayout><AdminUsersPage /></AdminLayout></ProtectedRoute>} />
      <Route path="ctrl-8k3x7/content" element={<ProtectedRoute><AdminLayout><AdminContentPage /></AdminLayout></ProtectedRoute>} />
      <Route path="ctrl-8k3x7/inquiries" element={<ProtectedRoute><AdminLayout><AdminInquiriesPage /></AdminLayout></ProtectedRoute>} />
      {/* Onboarding */}
      <Route path="onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      {/* Legacy redirects */}
      <Route path="analyze" element={<Navigate to="/app/analyze" replace />} />
      <Route path="jobs/:id" element={<Navigate to="/app/jobs/:id" replace />} />
      <Route path="results/:id" element={<Navigate to="/app/results/:id" replace />} />
    </>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <ToastContainer />
          <Routes>
            <Route element={<LangSync />}>
              {LandingRoutes()}
            </Route>
            <Route path=":lang" element={<LangSync />}>
              {LandingRoutes()}
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
