import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/common/Layout.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Presentation from './components/Presentation.jsx';

const ObjectExplorer = lazy(() => import('./components/ObjectExplorer.jsx'));
const AdminLogin = lazy(() => import('./components/AdminLogin.jsx'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard.jsx'));
const CustomerOrgView = lazy(() => import('./components/CustomerOrgView.jsx'));

function RouteLoader() {
  return (
    <div className="loading-page">
      <div className="loading-spinner" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Presentation />} />
            <Route path="objects" element={<ObjectExplorer />} />
            <Route path="admin" element={<AdminLogin />} />
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route
              path="customer/:slug"
              element={
                <ErrorBoundary>
                  <CustomerOrgView />
                </ErrorBoundary>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
