import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { AlertTriangle, Clock, User, Camera, CheckCircle, Plus, Filter, X, MapPin, Phone, Mail } from 'lucide-react';
import { Issue, StaffMember, Team, Facility } from '../../types/admin';
import { getCurrentUser } from '../../firebase/auth';

const IssuesPage: React.FC = () => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    severity: '',
    category: '',
    status: '',
    zone: ''
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [showIssueDetail, setShowIssueDetail] = useState(false);

  const [newIssue, setNewIssue] = useState({
    facilityId: '',
    zoneId: 'North',
    category: 'cleanliness' as 'cleanliness' | 'maintenance' | 'safety' | 'accessibility' | 'other',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    description: '',
    reportedBy: {
      anonymous: false,
      contact: '',
      name: ''
    }
  });

  const severityConfig = {
    low: { color: 'bg-green-100 text-green-800', slaMinutes: 480 },
    medium: { color: 'bg-yellow-100 text-yellow-800', slaMinutes: 240 },
    high: { color: 'bg-orange-100 text-orange-800', slaMinutes: 120 },
    critical: { color: 'bg-red-100 text-red-800', slaMinutes: 60 }
  };

  useEffect(() => {
    // Real-time listeners
    const issuesQuery = query(collection(db, 'issues'), orderBy('reportedAt', 'desc'));
    const staffQuery = query(collection(db, 'staff'), where('isActive', '==', true));
    const teamsQuery = query(collection(db, 'teams'), where('isActive', '==', true));
    const facilitiesQuery = query(collection(db, 'facilities'));

    const unsubscribeIssues = onSnapshot(issuesQuery, (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        reportedAt: doc.data().reportedAt?.toDate?.() || new Date(),
        resolvedAt: doc.data().resolvedAt?.toDate?.()
      })) as Issue[];
      setIssues(issuesData);
    });

    const unsubscribeStaff = onSnapshot(staffQuery, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StaffMember[];
      setStaff(staffData);
    });

    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Team[];
      setTeams(teamsData);
    });

    const unsubscribeFacilities = onSnapshot(facilitiesQuery, (snapshot) => {
      const facilitiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Facility[];
      setFacilities(facilitiesData);
      setLoading(false);
    });

    return () => {
      unsubscribeIssues();
      unsubscribeStaff();
      unsubscribeTeams();
      unsubscribeFacilities();
    };
  }, []);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newIssue.description.trim()) {
      alert('Issue description is required');
      return;
    }

    try {
      const currentUser = getCurrentUser();
      
      const issueData = {
        ...newIssue,
        description: newIssue.description.trim(),
        photos: [],
        reportedAt: serverTimestamp(),
        status: 'open' as const,
        createdBy: currentUser?.uid || 'unknown'
      };

      const docRef = await addDoc(collection(db, 'issues'), issueData);
      
      // Auto-assign based on severity and create task
      if (newIssue.severity === 'high' || newIssue.severity === 'critical') {
        await addDoc(collection(db, 'tasks'), {
          title: `${newIssue.severity.toUpperCase()}: ${newIssue.category} issue`,
          description: newIssue.description,
          facilityId: newIssue.facilityId || undefined,
          zoneId: newIssue.zoneId,
          assignedTo: { type: 'team', id: '' },
          priority: newIssue.severity === 'critical' ? 'high' : 'medium',
          status: 'pending',
          createdAt: serverTimestamp(),
          createdBy: 'system',
          dueAt: new Date(Date.now() + severityConfig[newIssue.severity].slaMinutes * 60 * 1000),
          slaMinutes: severityConfig[newIssue.severity].slaMinutes,
          photosBefore: [],
          photosAfter: [],
          issueId: docRef.id
        });
      }
      
      setShowCreateModal(false);
      resetIssueForm();
      alert('Issue reported successfully!');
    } catch (error) {
      console.error('Error creating issue:', error);
      alert('Failed to create issue');
    }
  };

  const resetIssueForm = () => {
    setNewIssue({
      facilityId: '',
      zoneId: 'North',
      category: 'cleanliness',
      severity: 'medium',
      description: '',
      reportedBy: { anonymous: false, contact: '', name: '' }
    });
  };

  const handleStatusUpdate = async (issueId: string, newStatus: string) => {
    try {
      const currentUser = getCurrentUser();
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || 'unknown'
      };

      if (newStatus === 'resolved') {
        updateData.resolvedAt = serverTimestamp();
        updateData.resolvedBy = currentUser?.uid || 'unknown';
      }

      await updateDoc(doc(db, 'issues', issueId), updateData);
      alert('Issue status updated successfully!');
    } catch (error) {
      console.error('Error updating issue status:', error);
      alert('Failed to update issue status');
    }
  };

  const handleAssignIssue = async (issueId: string, assignedTo: { type: 'staff' | 'team'; id: string }) => {
    try {
      await updateDoc(doc(db, 'issues', issueId), {
        assignedTo,
        status: 'assigned',
        assignedAt: serverTimestamp()
      });
      alert('Issue assigned successfully!');
    } catch (error) {
      console.error('Error assigning issue:', error);
      alert('Failed to assign issue');
    }
  };

  const getSLAStatus = (issue: Issue) => {
    const reportedTime = new Date(issue.reportedAt).getTime();
    const now = Date.now();
    const slaMinutes = severityConfig[issue.severity].slaMinutes;
    const slaDeadline = reportedTime + (slaMinutes * 60 * 1000);
    
    if (issue.status === 'resolved' || issue.status === 'closed') {
      return { status: 'met', color: 'text-green-600' };
    }
    
    if (now > slaDeadline) {
      return { status: 'breached', color: 'text-red-600' };
    }
    
    const timeLeft = slaDeadline - now;
    const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
    
    if (hoursLeft < 1) {
      return { status: 'critical', color: 'text-orange-600' };
    }
    
    return { status: 'on-track', color: 'text-green-600' };
  };

  const filteredIssues = issues.filter(issue => {
    const matchesFilters = 
      (!filters.severity || issue.severity === filters.severity) &&
      (!filters.category || issue.category === filters.category) &&
      (!filters.status || issue.status === filters.status) &&
      (!filters.zone || issue.zoneId === filters.zone);
      
    return matchesFilters;
  });

  // Group by severity for triage
  const triageGroups = {
    critical: filteredIssues.filter(i => i.severity === 'critical' && ['open', 'assigned'].includes(i.status)),
    high: filteredIssues.filter(i => i.severity === 'high' && ['open', 'assigned'].includes(i.status)),
    medium: filteredIssues.filter(i => i.severity === 'medium' && ['open', 'assigned'].includes(i.status)),
    low: filteredIssues.filter(i => i.severity === 'low' && ['open', 'assigned'].includes(i.status))
  };

  const getIssueStats = () => {
    const total = issues.length;
    const open = issues.filter(i => i.status === 'open').length;
    const assigned = issues.filter(i => i.status === 'assigned').length;
    const inProgress = issues.filter(i => i.status === 'in-progress').length;
    const resolved = issues.filter(i => i.status === 'resolved').length;
    
    return { total, open, assigned, inProgress, resolved };
  };

  const issueStats = getIssueStats();

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Issues & Emergency Triage</h1>
          <p className="text-sm text-gray-600 mt-1">Monitor and resolve facility issues</p>
        </div>
        <button
          onClick={() => {
            resetIssueForm();
            setShowCreateModal(true);
          }}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Report Issue
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-gray-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Issues</p>
              <p className="text-2xl font-semibold text-gray-900">{issueStats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Open</p>
              <p className="text-2xl font-semibold text-gray-900">{issueStats.open}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <User className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Assigned</p>
              <p className="text-2xl font-semibold text-gray-900">{issueStats.assigned}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">In Progress</p>
              <p className="text-2xl font-semibold text-gray-900">{issueStats.inProgress}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Resolved</p>
              <p className="text-2xl font-semibold text-gray-900">{issueStats.resolved}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Triage Queue */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {Object.entries(triageGroups).map(([severity, issueList]) => (
          <div key={severity} className="bg-white rounded-lg shadow">
            <div className={`p-4 ${severityConfig[severity as keyof typeof severityConfig].color} rounded-t-lg`}>
              <h3 className="font-medium capitalize">{severity} Priority</h3>
              <span className="text-sm">{issueList.length} open issues</span>
            </div>
            <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
              {issueList.slice(0, 5).map((issue) => {
                const facility = facilities.find(f => f.id === issue.facilityId);
                const slaStatus = getSLAStatus(issue);
                
                return (
                  <div
                    key={issue.id}
                    className="p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setSelectedIssue(issue);
                      setShowIssueDetail(true);
                    }}
                  >
                    <div className="text-sm font-medium text-gray-900 line-clamp-2">
                      {facility?.code || 'General'} - {issue.category}
                    </div>
                    <div className="text-xs text-gray-600 line-clamp-1 mt-1">
                      {issue.description}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        {new Date(issue.reportedAt).toLocaleDateString()}
                      </span>
                      <span className={`text-xs font-medium ${slaStatus.color}`}>
                        {slaStatus.status}
                      </span>
                    </div>
                  </div>
                );
              })}
              {issueList.length > 5 && (
                <div className="text-xs text-gray-500 text-center">
                  +{issueList.length - 5} more
                </div>
              )}
              {issueList.length === 0 && (
                <div className="text-center py-4 text-gray-400">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-xs">No {severity} issues</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Categories</option>
            <option value="cleanliness">Cleanliness</option>
            <option value="maintenance">Maintenance</option>
            <option value="safety">Safety</option>
            <option value="accessibility">Accessibility</option>
            <option value="other">Other</option>
          </select>
          
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          
          <select
            value={filters.zone}
            onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Zones</option>
            <option value="North">North</option>
            <option value="South">South</option>
            <option value="East">East</option>
            <option value="West">West</option>
            <option value="Central">Central</option>
          </select>
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredIssues.map((issue) => {
                const facility = facilities.find(f => f.id === issue.facilityId);
                const slaStatus = getSLAStatus(issue);
                
                return (
                  <tr key={issue.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 line-clamp-2">{issue.description}</div>
                      <div className="text-sm text-gray-500">Zone: {issue.zoneId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{facility?.code || 'General'}</div>
                      <div className="text-sm text-gray-500">{facility?.type || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityConfig[issue.severity].color}`}>
                        {issue.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 capitalize">{issue.category}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        issue.status === 'open' ? 'bg-red-100 text-red-800' :
                        issue.status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
                        issue.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                        issue.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {issue.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${slaStatus.color}`}>
                        {slaStatus.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(issue.reportedAt).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {issue.reportedBy.anonymous ? 'Anonymous' : issue.reportedBy.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedIssue(issue);
                          setShowIssueDetail(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Issue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Report New Issue</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateIssue} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Issue Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newIssue.description}
                  onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe the issue in detail"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Facility</label>
                  <select
                    value={newIssue.facilityId}
                    onChange={(e) => setNewIssue({ ...newIssue, facilityId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">General Issue</option>
                    {facilities.filter(f => !f.isDeleted).map(facility => (
                      <option key={facility.id} value={facility.id}>
                        {facility.code} ({facility.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Zone</label>
                  <select
                    value={newIssue.zoneId}
                    onChange={(e) => setNewIssue({ ...newIssue, zoneId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="North">North</option>
                    <option value="South">South</option>
                    <option value="East">East</option>
                    <option value="West">West</option>
                    <option value="Central">Central</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={newIssue.category}
                    onChange={(e) => setNewIssue({ ...newIssue, category: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="cleanliness">Cleanliness</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="safety">Safety</option>
                    <option value="accessibility">Accessibility</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                  <select
                    value={newIssue.severity}
                    onChange={(e) => setNewIssue({ ...newIssue, severity: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              {/* Reporter Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reporter Information</label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      id="anonymous"
                      type="checkbox"
                      checked={newIssue.reportedBy.anonymous}
                      onChange={(e) => setNewIssue({
                        ...newIssue,
                        reportedBy: { ...newIssue.reportedBy, anonymous: e.target.checked }
                      })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="anonymous" className="ml-2 text-sm text-gray-700">
                      Anonymous Report
                    </label>
                  </div>
                  
                  {!newIssue.reportedBy.anonymous && (
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text"
                        value={newIssue.reportedBy.name}
                        onChange={(e) => setNewIssue({
                          ...newIssue,
                          reportedBy: { ...newIssue.reportedBy, name: e.target.value }
                        })}
                        className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Reporter name"
                      />
                      <input
                        type="text"
                        value={newIssue.reportedBy.contact}
                        onChange={(e) => setNewIssue({
                          ...newIssue,
                          reportedBy: { ...newIssue.reportedBy, contact: e.target.value }
                        })}
                        className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Contact (phone/email)"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Report Issue</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Detail Modal */}
      {showIssueDetail && selectedIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Issue Details</h2>
              <button
                onClick={() => setShowIssueDetail(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Issue Information</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Description:</span>
                      <p className="text-sm text-gray-900 mt-1">{selectedIssue.description}</p>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Severity:</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${severityConfig[selectedIssue.severity].color}`}>
                        {selectedIssue.severity}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-medium capitalize">{selectedIssue.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Zone:</span>
                      <span className="font-medium">{selectedIssue.zoneId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reported:</span>
                      <span className="font-medium">{new Date(selectedIssue.reportedAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reporter:</span>
                      <span className="font-medium">
                        {selectedIssue.reportedBy.anonymous ? 'Anonymous' : selectedIssue.reportedBy.name}
                      </span>
                    </div>
                    {selectedIssue.reportedBy.contact && !selectedIssue.reportedBy.anonymous && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Contact:</span>
                        <span className="font-medium">{selectedIssue.reportedBy.contact}</span>
                      </div>
                    )}
                  </div>

                  {/* Assignment */}
                  {selectedIssue.status === 'open' && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Assign Issue</h4>
                      <div className="flex space-x-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAssignIssue(selectedIssue.id!, { type: 'team', id: e.target.value });
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="">Assign to team...</option>
                          {teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAssignIssue(selectedIssue.id!, { type: 'staff', id: e.target.value });
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="">Assign to staff...</option>
                          {staff.map(member => (
                            <option key={member.id} value={member.id}>{member.name} ({member.role})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Status Update Actions */}
                  <div className="mt-6 space-y-2">
                    {selectedIssue.status === 'assigned' && (
                      <button
                        onClick={() => handleStatusUpdate(selectedIssue.id!, 'in-progress')}
                        className="w-full bg-blue-100 text-blue-800 py-2 rounded-lg hover:bg-blue-200 font-medium"
                      >
                        Start Working
                      </button>
                    )}
                    {selectedIssue.status === 'in-progress' && (
                      <button
                        onClick={() => handleStatusUpdate(selectedIssue.id!, 'resolved')}
                        className="w-full bg-green-100 text-green-800 py-2 rounded-lg hover:bg-green-200 font-medium"
                      >
                        Mark Resolved
                      </button>
                    )}
                    {selectedIssue.status === 'resolved' && (
                      <button
                        onClick={() => handleStatusUpdate(selectedIssue.id!, 'closed')}
                        className="w-full bg-gray-100 text-gray-800 py-2 rounded-lg hover:bg-gray-200 font-medium"
                      >
                        Close Issue
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">SLA & Timeline</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">SLA Status</span>
                        <span className={`text-sm font-medium ${getSLAStatus(selectedIssue).color}`}>
                          {getSLAStatus(selectedIssue).status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Target resolution: {severityConfig[selectedIssue.severity].slaMinutes} minutes
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">Issue Reported</div>
                          <div className="text-xs text-gray-500">
                            {new Date(selectedIssue.reportedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {selectedIssue.assignedAt && (
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-yellow-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">Issue Assigned</div>
                            <div className="text-xs text-gray-500">
                              {new Date(selectedIssue.assignedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedIssue.resolvedAt && (
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">Issue Resolved</div>
                            <div className="text-xs text-gray-500">
                              {new Date(selectedIssue.resolvedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssuesPage;