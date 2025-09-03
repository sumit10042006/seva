import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { BarChart2, Users, Menu, UserCheck, Calendar, MapPin, QrCode, AlertTriangle, Bell, Megaphone, TrendingUp, Settings } from 'lucide-react';
import Dashboard from './components/Dashboard';
import StaffManagementPage from './pages/admin/StaffManagementPage';
import TeamsPage from './pages/admin/TeamsPage';
import ShiftManagementPage from './pages/admin/ShiftManagementPage';
import FacilitiesPage from './pages/admin/FacilitiesPage';
import TaskManagementPage from './pages/admin/TaskManagementPage';
import IssuesPage from './pages/admin/IssuesPage';
import NotificationsPage from './pages/admin/NotificationsPage';
import AdsPage from './pages/admin/AdsPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ProblemsAndSolutions } from './components/ProblemsAndSolutions';
import { HowItWorks } from './components/HowItWorks';
import { Features } from './components/Features';
import { Impact } from './components/Impact';
import { InteractiveDemo } from './components/InteractiveDemo';
import { Management } from './components/Management';
import { Team } from './components/Team';
import { CTAStrip } from './components/CTAStrip';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { content } from './data/content';
import { Language } from './types';
import './App.css';

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart2 },
    { path: '/staff', label: 'Staff Management', icon: Users },
    { path: '/teams', label: 'Teams', icon: UserCheck },
    { path: '/shifts', label: 'Shift Management', icon: Calendar },
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

const LandingPage = () => {
  const [currentLanguage, setCurrentLanguage] = useState<Language['code']>('en');
  const currentContent = content[currentLanguage];

  return (
    <div className="min-h-screen bg-white">
      <Navbar 
        content={currentContent} 
        currentLanguage={currentLanguage} 
        onLanguageChange={setCurrentLanguage} 
      />
      <Hero content={currentContent} />
      <ProblemsAndSolutions content={currentContent} />
      <HowItWorks content={currentContent} />
      <Features content={currentContent} />
      <Impact content={currentContent} />
      <InteractiveDemo content={currentContent} />
      <Management content={currentContent} />
      <Team content={currentContent} />
      <CTAStrip content={currentContent} />
      <Contact content={currentContent} />
      <Footer content={currentContent} />
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/dashboard"
          element={
            <AdminLayout>
              <Dashboard />
            </AdminLayout>
          }
        />
        <Route
          path="/staff"
          element={
            <AdminLayout>
              <StaffManagementPage />
            </AdminLayout>
          }
        />
        <Route
          path="/teams"
          element={
            <AdminLayout>
              <TeamsPage />
            </AdminLayout>
          }
        />
        <Route
          path="/shifts"
          element={
            <AdminLayout>
              <ShiftManagementPage />
            </AdminLayout>
          }
        />
        <Route
          path="/facilities"
          element={
            <AdminLayout>
              <FacilitiesPage />
            </AdminLayout>
          }
        />
        <Route
          path="/tasks"
          element={
            <AdminLayout>
              <TaskManagementPage />
            </AdminLayout>
          }
        />
        <Route
          path="/issues"
          element={
            <AdminLayout>
              <IssuesPage />
            </AdminLayout>
          }
        />
        <Route
          path="/notifications"
          element={
            <AdminLayout>
              <NotificationsPage />
            </AdminLayout>
          }
        />
        <Route
          path="/ads"
          element={
            <AdminLayout>
              <AdsPage />
            </AdminLayout>
          }
        />
        <Route
          path="/analytics"
          element={
            <AdminLayout>
              <AnalyticsPage />
            </AdminLayout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;