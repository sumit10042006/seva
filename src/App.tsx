import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { BarChart2, Users, Menu, UserCheck, Calendar, MapPin, QrCode, AlertTriangle, Bell, Megaphone, TrendingUp, Settings } from 'lucide-react';
import Dashboard from './components/Dashboard';
import StaffManagementPage from './pages/admin/StaffManagementPage';
import TeamsPage from './pages/admin/TeamsPage';
import ShiftManagementPage from './pages/admin/ShiftManagementPage';
import FacilitiesPage from './pages/admin/FacilitiesPage';
import QRManagerPage from './pages/admin/QRManagerPage';
import TaskManagementPage from './pages/admin/TaskManagementPage';
import IssuesPage from './pages/admin/IssuesPage';
import NotificationsPage from './pages/admin/NotificationsPage';
import AdsPage from './pages/admin/AdsPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import './App.css';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart2 },
    { path: '/staff', label: 'Staff Management', icon: Users },
    { path: '/teams', label: 'Teams', icon: UserCheck },
    { path: '/shifts', label: 'Shift Management', icon: Calendar },
    { path: '/facilities', label: 'Facilities', icon: MapPin },
    { path: '/tasks', label: 'Task Management', icon: AlertTriangle },
    { path: '/issues', label: 'Issues & Triage', icon: AlertTriangle },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { path: '/ads', label: 'Ads & Announcements', icon: Megaphone },
    { path: '/analytics', label: 'Analytics', icon: TrendingUp }
  ];
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-indigo-800 text-white transition-all duration-300`}>
        <div className="p-4 flex items-center justify-between">
          {isSidebarOpen && <h1 className="text-xl font-bold">Seva+ Admin</h1>}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-indigo-700"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
        <nav className="mt-8">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.path}
                href={item.path}
                className={`flex items-center p-4 ${isActive(item.path) ? 'bg-indigo-700' : 'hover:bg-indigo-700'} transition-colors`}
              >
                <Icon className="h-5 w-5" />
                {isSidebarOpen && <span className="ml-3">{item.label}</span>}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/staff"
          element={
            <Layout>
              <StaffManagementPage />
            </Layout>
          }
        />
        <Route
          path="/teams"
          element={
            <Layout>
              <TeamsPage />
            </Layout>
          }
        />
        <Route
          path="/shifts"
          element={
            <Layout>
              <ShiftManagementPage />
            </Layout>
          }
        />
        <Route
          path="/facilities"
          element={
            <Layout>
              <FacilitiesPage />
            </Layout>
          }
        />
        <Route
          path="/tasks"
          element={
            <Layout>
              <TaskManagementPage />
            </Layout>
          }
        />
        <Route
          path="/issues"
          element={
            <Layout>
              <IssuesPage />
            </Layout>
          }
        />
        <Route
          path="/notifications"
          element={
            <Layout>
              <NotificationsPage />
            </Layout>
          }
        />
        <Route
          path="/ads"
          element={
            <Layout>
              <AdsPage />
            </Layout>
          }
        />
        <Route
          path="/analytics"
          element={
            <Layout>
              <AnalyticsPage />
            </Layout>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;