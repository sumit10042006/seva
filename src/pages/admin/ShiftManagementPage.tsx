import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, query, where, doc, updateDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Clock, Users, AlertTriangle, CheckCircle, Plus, RefreshCw, X, Calendar, MapPin } from 'lucide-react';
import { Shift, StaffMember, Headcount, CoverageData } from '../../types/admin';
import { getCurrentUser } from '../../firebase/auth';

const ShiftManagementPage: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [headcounts, setHeadcounts] = useState<Headcount[]>([]);
  const [coverage, setCoverage] = useState<CoverageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState('North');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [manualHeadcount, setManualHeadcount] = useState<Record<string, number>>({});
  const [showStaffSelector, setShowStaffSelector] = useState(false);
  const [selectedShiftForStaffing, setSelectedShiftForStaffing] = useState<Shift | null>(null);

  const zones = ['North', 'South', 'East', 'West', 'Central'];
  const shiftTypes = [
    { id: 'red', name: 'Red (Morning)', time: '06:00-14:00', color: 'bg-red-100 text-red-800' },
    { id: 'orange', name: 'Orange (Afternoon)', time: '14:00-22:00', color: 'bg-orange-100 text-orange-800' },
    { id: 'green', name: 'Green (Night)', time: '22:00-06:00', color: 'bg-green-100 text-green-800' }
  ];

  const [newShift, setNewShift] = useState({
    zoneId: selectedZone,
    name: '',
    startTime: '06:00',
    endTime: '14:00',
    assignedStaffIds: [] as string[],
    requiredStaff: 10,
    date: selectedDate
  });

  useEffect(() => {
    // Real-time listeners
    const shiftsQuery = query(
      collection(db, 'shifts'),
      where('zoneId', '==', selectedZone),
      where('date', '==', selectedDate),
      orderBy('startTime')
    );

    const staffQuery = query(collection(db, 'staff'), where('isActive', '==', true));
    const headcountQuery = query(collection(db, 'headcounts'), where('zoneId', '==', selectedZone));

    const unsubscribeShifts = onSnapshot(shiftsQuery, (snapshot) => {
      const shiftsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      })) as Shift[];
      setShifts(shiftsData);
    });

    const unsubscribeStaff = onSnapshot(staffQuery, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastSeenAt: doc.data().lastSeenAt?.toDate?.() || new Date(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      })) as StaffMember[];
      setStaff(staffData);
    });

    const unsubscribeHeadcount = onSnapshot(headcountQuery, (snapshot) => {
      const headcountData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date()
      })) as Headcount[];
      setHeadcounts(headcountData);
      setLoading(false);
    });

    return () => {
      unsubscribeShifts();
      unsubscribeStaff();
      unsubscribeHeadcount();
    };
  }, [selectedZone, selectedDate]);

  useEffect(() => {
    calculateCoverage();
  }, [shifts, headcounts]);

  const calculateCoverage = () => {
    const latestHeadcount = headcounts
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    
    if (!latestHeadcount) {
      setCoverage([]);
      return;
    }

    const requiredStaff = Math.ceil(latestHeadcount.count / 8);
    const assignedStaff = shifts.reduce((total, shift) => total + shift.assignedStaffIds.length, 0);
    const delta = assignedStaff - requiredStaff;
    
    const status: 'adequate' | 'understaffed' | 'overstaffed' = 
      Math.abs(delta) <= 2 ? 'adequate' :
      delta < 0 ? 'understaffed' : 'overstaffed';

    setCoverage([{
      zoneId: selectedZone,
      requiredStaff,
      assignedStaff,
      delta,
      status,
      lastUpdated: new Date()
    }]);
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newShift.name.trim()) {
      alert('Shift name is required');
      return;
    }

    try {
      const currentUser = getCurrentUser();
      
      await addDoc(collection(db, 'shifts'), {
        ...newShift,
        name: newShift.name.trim(),
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'unknown'
      });
      
      setShowCreateShift(false);
      resetShiftForm();
      alert('Shift created successfully!');
    } catch (error) {
      console.error('Error creating shift:', error);
      alert('Failed to create shift');
    }
  };

  const resetShiftForm = () => {
    setNewShift({
      zoneId: selectedZone,
      name: '',
      startTime: '06:00',
      endTime: '14:00',
      assignedStaffIds: [],
      requiredStaff: 10,
      date: selectedDate
    });
  };

  const handleHeadcountUpdate = async (zoneId: string) => {
    const count = manualHeadcount[zoneId];
    if (!count || count < 0) {
      alert('Please enter a valid headcount');
      return;
    }

    try {
      const currentUser = getCurrentUser();
      
      await addDoc(collection(db, 'headcounts'), {
        zoneId,
        count,
        source: 'manual',
        confidence: 1.0,
        timestamp: serverTimestamp(),
        recordedBy: currentUser?.uid || 'unknown'
      });

      setManualHeadcount(prev => ({ ...prev, [zoneId]: 0 }));
      alert('Headcount updated successfully!');
    } catch (error) {
      console.error('Error updating headcount:', error);
      alert('Failed to update headcount');
    }
  };

  const getAvailableStaff = () => {
    return staff.filter(s => 
      s.isActive && 
      !s.onDuty && 
      !shifts.some(shift => shift.assignedStaffIds.includes(s.id!))
    );
  };

  const autoAssignStaff = async (shiftId: string, requiredCount: number) => {
    const availableStaff = getAvailableStaff().slice(0, requiredCount);
    
    if (availableStaff.length === 0) {
      alert('No available staff to assign');
      return;
    }

    const confirmed = window.confirm(
      `Auto-assign ${availableStaff.length} available staff members to this shift?`
    );

    if (confirmed) {
      try {
        const staffIds = availableStaff.map(s => s.id!);
        await updateDoc(doc(db, 'shifts', shiftId), {
          assignedStaffIds: staffIds,
          updatedAt: serverTimestamp()
        });

        // Update staff on-duty status
        for (const staffId of staffIds) {
          await updateDoc(doc(db, 'staff', staffId), {
            onDuty: true,
            currentShiftId: shiftId,
            updatedAt: serverTimestamp()
          });
        }

        alert(`Successfully assigned ${staffIds.length} staff members`);
      } catch (error) {
        console.error('Error auto-assigning staff:', error);
        alert('Failed to auto-assign staff');
      }
    }
  };

  const handleManualStaffAssignment = async (shiftId: string, selectedStaffIds: string[]) => {
    try {
      await updateDoc(doc(db, 'shifts', shiftId), {
        assignedStaffIds: selectedStaffIds,
        updatedAt: serverTimestamp()
      });

      // Update staff on-duty status
      for (const staffId of selectedStaffIds) {
        await updateDoc(doc(db, 'staff', staffId), {
          onDuty: true,
          currentShiftId: shiftId,
          updatedAt: serverTimestamp()
        });
      }

      setShowStaffSelector(false);
      setSelectedShiftForStaffing(null);
      alert(`Successfully assigned ${selectedStaffIds.length} staff members`);
    } catch (error) {
      console.error('Error assigning staff:', error);
      alert('Failed to assign staff');
    }
  };

  const getCoverageColor = (status: string) => {
    switch (status) {
      case 'adequate': return 'text-green-600 bg-green-50';
      case 'understaffed': return 'text-red-600 bg-red-50';
      case 'overstaffed': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
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
          <h1 className="text-2xl font-bold text-gray-800">Shift Management & Coverage</h1>
          <p className="text-sm text-gray-600 mt-1">Plan shifts and monitor workforce coverage</p>
        </div>
        <button
          onClick={() => {
            resetShiftForm();
            setShowCreateShift(true);
          }}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Shift
        </button>
      </div>

      {/* Zone and Date Selector */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Update Headcount</label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={manualHeadcount[selectedZone] || ''}
                onChange={(e) => setManualHeadcount(prev => ({ 
                  ...prev, 
                  [selectedZone]: parseInt(e.target.value) || 0 
                }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter headcount"
                min="0"
              />
              <button
                onClick={() => handleHeadcountUpdate(selectedZone)}
                disabled={!manualHeadcount[selectedZone] || manualHeadcount[selectedZone] <= 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Coverage Widget */}
      {coverage.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Coverage Analysis - {selectedZone} Zone</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{coverage[0].requiredStaff}</div>
              <div className="text-sm text-gray-500">Required Staff</div>
              <div className="text-xs text-gray-400 mt-1">Based on 1:8 ratio</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{coverage[0].assignedStaff}</div>
              <div className="text-sm text-gray-500">Assigned Staff</div>
              <div className="text-xs text-gray-400 mt-1">Across all shifts</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${coverage[0].delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {coverage[0].delta >= 0 ? '+' : ''}{coverage[0].delta}
              </div>
              <div className="text-sm text-gray-500">Delta</div>
              <div className="text-xs text-gray-400 mt-1">Surplus/Deficit</div>
            </div>
            <div className="text-center">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getCoverageColor(coverage[0].status)}`}>
                {coverage[0].status.charAt(0).toUpperCase() + coverage[0].status.slice(1)}
              </div>
              <div className="text-sm text-gray-500 mt-1">Status</div>
            </div>
          </div>
        </div>
      )}

      {/* Current Headcount Display */}
      {headcounts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900">
                Current Headcount: {headcounts[headcounts.length - 1]?.count?.toLocaleString() || 0}
              </span>
            </div>
            <span className="text-xs text-blue-700">
              Last updated: {new Date(headcounts[headcounts.length - 1]?.timestamp || Date.now()).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Shift Timeline */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Shift Timeline - {selectedZone} Zone</h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-6">
            {shiftTypes.map((shiftType) => {
              const shiftData = shifts.find(s => s.name.toLowerCase().includes(shiftType.id));
              const assignedCount = shiftData?.assignedStaffIds.length || 0;
              const requiredCount = shiftData?.requiredStaff || 0;
              const availableStaff = getAvailableStaff();
              
              return (
                <div key={shiftType.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${shiftType.color}`}>
                        {shiftType.name}
                      </span>
                      <span className="text-sm text-gray-500">{shiftType.time}</span>
                      {shiftData && (
                        <span className="text-sm text-gray-600">"{shiftData.name}"</span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-sm">
                        <span className="font-medium">{assignedCount}</span>
                        <span className="text-gray-500">/{requiredCount} assigned</span>
                      </div>
                      
                      {shiftData && assignedCount < requiredCount && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => autoAssignStaff(shiftData.id!, requiredCount - assignedCount)}
                            className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Auto-fill ({Math.min(availableStaff.length, requiredCount - assignedCount)})</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedShiftForStaffing(shiftData);
                              setShowStaffSelector(true);
                            }}
                            className="flex items-center space-x-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 text-sm"
                          >
                            <Users className="w-3 h-3" />
                            <span>Manual</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coverage Status */}
                  <div className="flex items-center space-x-4 mb-4">
                    {assignedCount >= requiredCount ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        <span className="text-sm">Fully staffed</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        <span className="text-sm">Need {requiredCount - assignedCount} more staff</span>
                      </div>
                    )}
                    
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          assignedCount >= requiredCount ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((assignedCount / Math.max(requiredCount, 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Assigned Staff */}
                  {shiftData && shiftData.assignedStaffIds.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Assigned Staff</h4>
                      <div className="flex flex-wrap gap-2">
                        {shiftData.assignedStaffIds.map(staffId => {
                          const staffMember = staff.find(s => s.id === staffId);
                          return staffMember ? (
                            <span key={staffId} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                              {staffMember.name}
                              <button
                                onClick={async () => {
                                  const confirmed = window.confirm(`Remove ${staffMember.name} from this shift?`);
                                  if (confirmed) {
                                    const updatedStaffIds = shiftData.assignedStaffIds.filter(id => id !== staffId);
                                    await updateDoc(doc(db, 'shifts', shiftData.id!), {
                                      assignedStaffIds: updatedStaffIds,
                                      updatedAt: serverTimestamp()
                                    });
                                    await updateDoc(doc(db, 'staff', staffId), {
                                      onDuty: false,
                                      currentShiftId: null,
                                      updatedAt: serverTimestamp()
                                    });
                                  }
                                }}
                                className="ml-1 text-indigo-600 hover:text-indigo-800"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Available Staff Panel */}
      <div className="mt-6 bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Available Staff ({getAvailableStaff().length})</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getAvailableStaff().slice(0, 12).map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">{member.name}</div>
                    <div className="text-xs text-gray-500">{member.role} • {member.shift.toUpperCase()}</div>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(member.lastSeenAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
          {getAvailableStaff().length > 12 && (
            <div className="text-center mt-4 text-sm text-gray-500">
              +{getAvailableStaff().length - 12} more available
            </div>
          )}
        </div>
      </div>

      {/* Create Shift Modal */}
      {showCreateShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Create New Shift</h2>
              <button
                onClick={() => setShowCreateShift(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shift Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newShift.name}
                  onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Morning Sanitation Shift"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={newShift.startTime}
                    onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <input
                    type="time"
                    value={newShift.endTime}
                    onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Required Staff Count
                </label>
                <input
                  type="number"
                  value={newShift.requiredStaff}
                  onChange={(e) => setNewShift({ ...newShift, requiredStaff: parseInt(e.target.value) || 10 })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  min="1"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateShift(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Shift</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Selector Modal */}
      {showStaffSelector && selectedShiftForStaffing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                Assign Staff to {selectedShiftForStaffing.name}
              </h2>
              <button
                onClick={() => {
                  setShowStaffSelector(false);
                  setSelectedShiftForStaffing(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <StaffSelectorComponent
              availableStaff={getAvailableStaff()}
              currentlyAssigned={selectedShiftForStaffing.assignedStaffIds}
              onAssign={(selectedStaffIds) => handleManualStaffAssignment(selectedShiftForStaffing.id!, selectedStaffIds)}
              onCancel={() => {
                setShowStaffSelector(false);
                setSelectedShiftForStaffing(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Staff Selector Component
const StaffSelectorComponent: React.FC<{
  availableStaff: StaffMember[];
  currentlyAssigned: string[];
  onAssign: (staffIds: string[]) => void;
  onCancel: () => void;
}> = ({ availableStaff, currentlyAssigned, onAssign, onCancel }) => {
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(currentlyAssigned);

  const handleToggleStaff = (staffId: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Select Staff Members ({selectedStaffIds.length} selected)
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedStaffIds(availableStaff.map(s => s.id!))}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedStaffIds([])}
              className="text-gray-600 hover:text-gray-800 text-sm font-medium"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto mb-6">
        {availableStaff.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedStaffIds.includes(member.id!)}
                onChange={() => handleToggleStaff(member.id!)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">{member.name}</div>
                <div className="text-xs text-gray-500">{member.role} • {member.shift.toUpperCase()} shift</div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Zone: {member.zoneId || 'Any'}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={() => onAssign(selectedStaffIds)}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Assign {selectedStaffIds.length} Staff Members
        </button>
      </div>
    </div>
  );
};

export default ShiftManagementPage;