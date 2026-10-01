import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./lib/auth.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import TenantHomePage from "./pages/TenantHomePage.jsx";
import LandlordHomePage from "./pages/LandlordHomePage.jsx";
import NewRequestPage from "./pages/NewRequestPage.jsx";
import RequestDetailPage from "./pages/RequestDetailPage.jsx";
import PropertiesPage from "./pages/PropertiesPage.jsx";

export default function App() {
  const { user } = useAuth();

  // Not logged in: only the login and register screens exist.
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isLandlord = user.role === "LANDLORD";
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={isLandlord ? <LandlordHomePage /> : <TenantHomePage />} />
        <Route path="requests/:id" element={<RequestDetailPage />} />
        {isLandlord ? (
          <Route path="properties" element={<PropertiesPage />} />
        ) : (
          <Route path="new" element={<NewRequestPage />} />
        )}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
