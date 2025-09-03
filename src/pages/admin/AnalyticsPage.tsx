import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { BarChart3, Download, Calendar, Filter, TrendingUp, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { Task, Issue, StaffMember, Notification } from '../../types/admin';

const AnalyticsPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [tasksSnapshot, issuesSnapshot, staffSnapshot, notificationsSnapshot] = await Promise.all([
        getDocs(collection(db, 'tasks')),
        getDocs(collection(db, 'issues')),
        getDocs(collection(db, 'staff')),
        getDocs(collection(db, 'notifications'))
      ]);
      
      setTasks(tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]);
      setIssues(issuesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Issue[]);
      setStaff(staffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StaffMember[]);
      setNotifications(notificationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[]);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = (data: any[], filename: string) => {
    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Analytics calculations
  const tasksByStatus = {
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    verified: tasks.filter(t => t.status === 'verified').length
  };

  const issuesByType = {
    cleanliness: issues.filter(i => i.category === 'cleanliness').length,
    maintenance: issues.filter(i => i.category === 'maintenance').length,
    safety: issues.filter(i => i.category === 'safety').length,
    accessibility: issues.filter(i => i.category === 'accessibility').length,
    other: issues.filter(i => i.category === 'other').length
  };

  const staffUtilization = {
    red: staff.filter(s => s.shift === 'red' && s.onDuty).length,
    orange: staff.filter(s => s.shift === 'orange' && s.onDuty).length,
    green: staff.filter(s => s.shift === 'green' && s.onDuty).length
  };

  const notificationsSummary = {
    sent: notifications.filter(n => n.status === 'sent' || n.status === 'delivered').length,
    pending: notifications.filter(n => n.status === 'pending').length,
    failed: notifications.filter(n => n.status === 'failed').length
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Analytics & Reports</h1>
          <p className="text-sm text-gray-600 mt-1">Monitor performance and generate reports</p>
        </div>
        <div className="flex space-x-3">
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <button
            onClick={() => exportData(tasks, 'tasks-report')}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tasks Completed</p>
              <p className="text-2xl font-semibold text-gray-900">{tasksByStatus.completed + tasksByStatus.verified}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Open Issues</p>
              <p className="text-2xl font-semibold text-gray-900">
                {issues.filter(i => i.status === 'open').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Staff</p>
              <p className="text-2xl font-semibold text-gray-900">
                {staff.filter(s => s.isActive && s.onDuty).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-indigo-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Efficiency Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {Math.round(((tasksByStatus.completed + tasksByStatus.verified) / Math.max(1, tasks.length)) * 100)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Tasks by Status</h3>
          <div className="space-y-3">
            {Object.entries(tasksByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">{status.replace(/([A-Z])/g, ' $1')}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        status === 'completed' || status === 'verified' ? 'bg-green-500' :
                        status === 'inProgress' ? 'bg-blue-500' :
                        'bg-yellow-500'
                      }`}
                      style={{ width: `${(count / Math.max(1, tasks.length)) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Issues by Type */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Issues by Category</h3>
          <div className="space-y-3">
            {Object.entries(issuesByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">{type}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-red-500"
                      style={{ width: `${(count / Math.max(1, issues.length)) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff Utilization */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Staff Utilization by Shift</h3>
          <div className="space-y-3">
            {Object.entries(staffUtilization).map(([shift, count]) => (
              <div key={shift} className="flex items-center justify-between">
                <span className={`text-sm font-medium capitalize ${
                  shift === 'red' ? 'text-red-600' :
                  shift === 'orange' ? 'text-orange-600' :
                  'text-green-600'
                }`}>
                  {shift} Shift
                </span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        shift === 'red' ? 'bg-red-500' :
                        shift === 'orange' ? 'bg-orange-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${(count / Math.max(1, staff.filter(s => s.isActive).length)) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications Summary */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notifications Summary</h3>
          <div className="space-y-3">
            {Object.entries(notificationsSummary).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">{status}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        status === 'sent' ? 'bg-green-500' :
                        status === 'pending' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${(count / Math.max(1, notifications.length)) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Export Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => exportData(tasks, 'tasks-report')}
            className="flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            <span>Tasks Report</span>
          </button>
          
          <button
            onClick={() => exportData(issues, 'issues-report')}
            className="flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            <span>Issues Report</span>
          </button>
          
          <button
            onClick={() => exportData(staff, 'staff-report')}
            className="flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            <span>Staff Report</span>
          </button>
          
          <button
            onClick={() => exportData(notifications, 'notifications-report')}
            className="flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            <span>Notifications Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;