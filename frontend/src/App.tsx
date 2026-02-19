import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import AnalyzePage from './pages/AnalyzePage';
import JobStatusPage from './pages/JobStatusPage';
import ReportPage from './pages/ReportPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <Layout>
                <LandingPage />
              </Layout>
            }
          />
          <Route
            path="/analyze"
            element={
              <Layout>
                <AnalyzePage />
              </Layout>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <Layout>
                <JobStatusPage />
              </Layout>
            }
          />
          <Route
            path="/results/:id"
            element={
              <Layout>
                <ReportPage />
              </Layout>
            }
          />
          <Route
            path="/dashboard"
            element={
              <Layout>
                <DashboardPage />
              </Layout>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
