import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/common/Layout.jsx';
import CustomerGate from './components/CustomerGate.jsx';
import CustomerView from './components/CustomerView.jsx';
import ObjectExplorer from './components/ObjectExplorer.jsx';
import Presentation from './components/Presentation.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Presentation />} />
          <Route path="objects" element={<ObjectExplorer />} />
          <Route path="customer" element={<CustomerGate />} />
          <Route path="customer/:name" element={<CustomerView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
