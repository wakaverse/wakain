import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import LangSync from './components/LangSync';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import AnalyzePage from './pages/AnalyzePage';
import JobStatusPage from './pages/JobStatusPage';
import ReportPage from './pages/ReportPage';
import DashboardPage from './pages/DashboardPage';
import DemoReportPage from './pages/DemoReportPage';
import ContactPage from './pages/ContactPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

function AppRoutes() {
  return (
    <>
      <Route
        index
        element={
          <Layout>
            <LandingPage />
          </Layout>
        }
      />
      <Route
        path="analyze"
        element={
          <Layout>
            <ProtectedRoute><AnalyzePage /></ProtectedRoute>
          </Layout>
        }
      />
      <Route
        path="jobs/:id"
        element={
          <Layout>
            <JobStatusPage />
          </Layout>
        }
      />
      <Route
        path="results/:id"
        element={
          <Layout>
            <ReportPage />
          </Layout>
        }
      />
      <Route
        path="contact"
        element={
          <Layout>
            <ContactPage />
          </Layout>
        }
      />
      <Route path="demo" element={<DemoReportPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route
        path="dashboard"
        element={
          <Layout>
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          </Layout>
        }
      />
    </>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Default (ko) — no lang prefix */}
            <Route element={<LangSync />}>
              {AppRoutes()}
            </Route>
            {/* /en/*, /ja/* */}
            <Route path=":lang" element={<LangSync />}>
              {AppRoutes()}
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
