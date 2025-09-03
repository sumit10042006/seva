import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Edit, Trash2, Bell, History, User, Phone, Mail, Clock } from 'lucide-react';
import { StaffMember, StaffAudit } from '../../types/admin';
import { getCurrentUser } from '../../firebase/auth';

interface StaffTableProps {
  searchTerm: string;
  filters: {
    role: string;
    team: string;
    shift: string;
    zone: string;
    active: boolean;
  };
  onEditStaff: (staff: StaffMember) => void;
  refreshTrigger: number;
}

export const StaffTable: React.FC<StaffTableProps> = ({ 
  searchTerm, 
  filters, 
  onEditStaff,
  refreshTrigger 
}) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedStaffHistory, setSelectedStaffHistory] = useState<StaffAudit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const itemsPerPage = 10;

  useEffect(() => {
    fetchStaff();
  }, [filters, refreshTrigger]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      let staffQuery = query(collection(db, 'staff'), orderBy('createdAt', 'desc'));
      
      const querySnapshot = await getDocs(staffQuery);
      const staffData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastSeenAt: doc.data().lastSeenAt?.toDate?.() || new Date(doc.data().lastSeenAt || Date.now()),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt || Date.now())
      })) as StaffMember[];
      
      setStaff(staffData);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAuditRecord = async (staffId: string, action: string, changes: Record<string, any>) => {
    try {
      const currentUser = getCurrentUser();
      await addDoc(collection(db, 'staff-audit'), {
        staffId,
        action,
        changes,
        performedBy: currentUser?.uid || 'unknown',
        timestamp: serverTimestamp(),
        ipAddress: 'unknown' // In a real app, you'd get this from the server
      });
    } catch (error) {
      console.error('Error creating audit record:', error);
    }
  };

  const handleDeactivate = async (staffMember: StaffMember) => {
    if (!staffMember.id) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to ${staffMember.isActive ? 'deactivate' : 'activate'} ${staffMember.name}?`
    );
    
    if (confirmed) {
      try {
        const newStatus = !staffMember.isActive;
        await updateDoc(doc(db, 'staff', staffMember.id), {
          isActive: newStatus,
          updatedAt: serverTimestamp()
        });

        await createAuditRecord(staffMember.id, newStatus ? 'activate' : 'deactivate', {
          isActive: { from: staffMember.isActive, to: newStatus }
        });

        // Update local state
        setStaff(prev => prev.map(s => 
          s.id === staffMember.id ? { ...s, isActive: newStatus } : s
        ));
      } catch (error) {
        console.error('Error updating staff status:', error);
        alert('Failed to update staff status');
      }
    }
  };

  const handleSendNotification = async (staffMember: StaffMember) => {
    const message = prompt(`Send notification to ${staffMember.name}:`);
    if (message) {
      try {
        await addDoc(collection(db, 'notifications'), {
          to: [staffMember.mobile],
          channel: 'sms',
          message,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        alert('Notification queued successfully');
      } catch (error) {
        console.error('Error sending notification:', error);
        alert('Failed to send notification');
      }
    }
  };

  const handleViewHistory = async (staffMember: StaffMember) => {
    if (!staffMember.id) return;
    
    setHistoryLoading(true);
    setShowHistoryModal(true);
    
    try {
      const auditQuery = query(
        collection(db, 'staff-audit'),
        where('staffId', '==', staffMember.id),
        orderBy('timestamp', 'desc')
      );
      
      const auditSnapshot = await getDocs(auditQuery);
      const auditData = auditSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp || Date.now())
      })) as StaffAudit[];
      
      setSelectedStaffHistory(auditData);
    } catch (error) {
      console.error('Error fetching staff history:', error);
      setSelectedStaffHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Filter and search staff
  const filteredStaff = staff.filter(member => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      member.name?.toLowerCase().includes(searchLower) ||
      member.email?.toLowerCase().includes(searchLower) ||
      member.mobile?.includes(searchTerm);
      
    const matchesFilters = 
      (!filters.role || member.role === filters.role) &&
      (!filters.shift || member.shift === filters.shift) &&
      (filters.active === undefined || member.isActive === filters.active);
      
    return matchesSearch && matchesFilters;
  });

  // Pagination
  const totalPages = Math.ceil(filteredStaff.length / itemsPerPage);
  const paginatedStaff = filteredStaff.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (member: StaffMember) => {
    if (!member.isActive) return 'bg-red-100 text-red-800';
    if (member.onDuty) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getStatusText = (member: StaffMember) => {
    if (!member.isActive) return 'Inactive';
    if (member.onDuty) return 'On Duty';
    return 'Off Duty';
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mobile
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teams
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shift
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  On Duty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Seen
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">
                    No staff members found
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((member) => (
                  <tr key={member.id} className={!member.isActive ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">{member.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {member.mobile}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        {member.email || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : member.role === 'manager'
                          ? 'bg-blue-100 text-blue-800'
                          : member.role === 'supervisor'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {member.teamIds?.slice(0, 2).map((teamId, index) => (
                          <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            Team {teamId.slice(-3)}
                          </span>
                        ))}
                        {member.teamIds?.length > 2 && (
                          <span className="text-xs text-gray-500">+{member.teamIds.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.shift === 'red' ? 'bg-red-100 text-red-800' :
                        member.shift === 'orange' ? 'bg-orange-100 text-orange-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {member.shift?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(member)}`}>
                        {getStatusText(member)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                        {new Date(member.lastSeenAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          className="text-indigo-600 hover:text-indigo-900 p-1"
                          onClick={() => onEditStaff(member)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className={`p-1 ${member.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                          onClick={() => handleDeactivate(member)}
                          title={member.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          className="text-blue-600 hover:text-blue-900 p-1"
                          onClick={() => handleSendNotification(member)}
                          title="Send Notification"
                        >
                          <Bell className="h-4 w-4" />
                        </button>
                        <button
                          className="text-gray-600 hover:text-gray-900 p-1"
                          onClick={() => handleViewHistory(member)}
                          title="View History"
                        >
                          <History className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, filteredStaff.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredStaff.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5) {
                      if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === pageNum
                            ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Staff History</h3>
            </div>
            <div className="p-6 overflow-y-auto max-h-96">
              {historyLoading ? (
                <div className="text-center py-8">Loading history...</div>
              ) : selectedStaffHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No history found</div>
              ) : (
                <div className="space-y-4">
                  {selectedStaffHistory.map((audit) => (
                    <div key={audit.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          audit.action === 'create' ? 'bg-green-100 text-green-800' :
                          audit.action === 'update' ? 'bg-blue-100 text-blue-800' :
                          audit.action === 'deactivate' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {audit.action}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(audit.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {audit.changes && Object.keys(audit.changes).length > 0 && (
                        <div className="text-sm text-gray-600">
                          <strong>Changes:</strong>
                          <pre className="mt-1 text-xs bg-gray-50 p-2 rounded">
                            {JSON.stringify(audit.changes, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};