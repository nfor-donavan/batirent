import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { ToastProvider, Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Contracts from './pages/Contracts.jsx';
import NewContract from './pages/NewContract.jsx';
import ContractDetail from './pages/ContractDetail.jsx';
import Fleet from './pages/Fleet.jsx';
import Audit from './pages/Audit.jsx';
import Settings from './pages/Settings.jsx';

function Protected({ roles, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/contracts" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  const manager = ['owner', 'manager'];
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/" element={user && !manager.includes(user.role) ? <Navigate to="/contracts" replace /> : <Dashboard />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/contracts/new" element={<Protected roles={manager}><NewContract /></Protected>} />
          <Route path="/contracts/:id" element={<ContractDetail />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/audit" element={<Protected roles={manager}><Audit /></Protected>} />
          <Route path="/settings" element={<Protected roles={['owner']}><Settings /></Protected>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
