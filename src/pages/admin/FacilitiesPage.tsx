import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MapPin, Plus, Search, Filter, Camera, Wrench, CheckCircle, AlertTriangle, QrCode, X, Edit, Trash2, Clock } from 'lucide-react';
import { Facility, Task } from '../../types/admin';
import { getCurrentUser } from '../../firebase/auth';

const FacilitiesPage: React.FC = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    zone: '',
    status: ''
  });
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [showFacilityDetail, setShowFacilityDetail] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);

  const [newFacility, setNewFacility] = useState({
    code: '',
    type: 'toilet' as 'toilet' | 'bin' | 'water' | 'helpdesk',
    zoneId: 'North',
    lat: 0,
    lng: 0,
    capacity: 10,
    status: 'available' as 'available' | 'occupied' | 'maintenance' | 'full' | 'out-of-order'
  });

  useEffect(() => {
    // Real-time listeners
    const facilitiesQuery = query(collection(db, 'facilities'), orderBy('code'));
    const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));

    const unsubscribeFacilities = onSnapshot(facilitiesQuery, (snapshot) => {
      const facilitiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastUpdated: doc.data().lastUpdated?.toDate?.() || new Date(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      })) as Facility[];
      setFacilities(facilitiesData);
    });

    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        dueAt: doc.data().dueAt?.toDate?.() || new Date()
      })) as Task[];
      setTasks(tasksData);
      setLoading(false);
    });

    return () => {
      unsubscribeFacilities();
      unsubscribeTasks();
    };
  }, []);

  const handleCreateFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newFacility.code.trim()) {
      alert('Facility code is required');
      return;
    }

    // Check for duplicate codes
    const existingFacility = facilities.find(f => f.code.toLowerCase() === newFacility.code.toLowerCase());
    if (existingFacility && (!editingFacility || existingFacility.id !== editingFacility.id)) {
      alert('Facility code already exists');
      return;
    }

    try {
      const currentUser = getCurrentUser();
      const facilityData = {
        ...newFacility,
        code: newFacility.code.trim().toUpperCase(),
        photos: [],
        lastUpdated: serverTimestamp(),
        createdAt: editingFacility ? editingFacility.createdAt : serverTimestamp(),
        createdBy: editingFacility ? editingFacility.createdBy : (currentUser?.uid || 'unknown')
      };

      if (editingFacility?.id) {
        await updateDoc(doc(db, 'facilities', editingFacility.id), {
          ...facilityData,
          updatedAt: serverTimestamp()
        });
        alert('Facility updated successfully!');
      } else {
        await addDoc(collection(db, 'facilities'), facilityData);
        alert('Facility created successfully!');
      }
      
      setShowCreateModal(false);
      setEditingFacility(null);
      resetForm();
    } catch (error) {
      console.error('Error saving facility:', error);
      alert('Failed to save facility');
    }
  };

  const resetForm = () => {
    setNewFacility({
      code: '',
      type: 'toilet',
      zoneId: 'North',
      lat: 0,
      lng: 0,
      capacity: 10,
      status: 'available'
    });
  };

  const openEditModal = (facility: Facility) => {
    setEditingFacility(facility);
    setNewFacility({
      code: facility.code,
      type: facility.type,
      zoneId: facility.zoneId,
      lat: facility.lat,
      lng: facility.lng,
      capacity: facility.capacity || 10,
      status: facility.status
    });
    setShowCreateModal(true);
  };

  const handleStatusUpdate = async (facility: Facility, newStatus: string) => {
    if (!facility.id) return;
    
    try {
      const currentUser = getCurrentUser();
      
      await updateDoc(doc(db, 'facilities', facility.id), {
        status: newStatus,
        lastUpdated: serverTimestamp(),
        updatedBy: currentUser?.uid || 'unknown'
      });

      // Auto-create task for certain status changes
      if (newStatus === 'maintenance' || newStatus === 'full') {
        const taskTitle = newStatus === 'maintenance' ? 'Maintenance Required' : 'Empty/Clean Required';
        const priority = newStatus === 'maintenance' ? 'high' : 'medium';
        
        await addDoc(collection(db, 'tasks'), {
          title: `${taskTitle} - ${facility.code}`,
          description: `${facility.type} ${facility.code} requires ${newStatus === 'maintenance' ? 'maintenance' : 'cleaning/emptying'}`,
          facilityId: facility.id,
          zoneId: facility.zoneId,
          assignedTo: { type: 'team', id: '' },
          priority,
          status: 'pending',
          createdAt: serverTimestamp(),
          createdBy: 'system',
          dueAt: new Date(Date.now() + (newStatus === 'maintenance' ? 60 : 120) * 60 * 1000),
          slaMinutes: newStatus === 'maintenance' ? 60 : 120,
          photosBefore: [],
          photosAfter: []
        });
      }

      alert('Status updated successfully!');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const handleDeleteFacility = async (facility: Facility) => {
    if (!facility.id) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete facility "${facility.code}"? This action cannot be undone.`
    );
    
    if (confirmed) {
      try {
        await updateDoc(doc(db, 'facilities', facility.id), {
          isDeleted: true,
          deletedAt: serverTimestamp()
        });
        alert('Facility deleted successfully!');
      } catch (error) {
        console.error('Error deleting facility:', error);
        alert('Failed to delete facility');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'occupied': return 'bg-yellow-100 text-yellow-800';
      case 'maintenance': return 'bg-red-100 text-red-800';
      case 'full': return 'bg-orange-100 text-orange-800';
      case 'out-of-order': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'toilet': return '🚻';
      case 'bin': return '🗑️';
      case 'water': return '💧';
      case 'helpdesk': return '🆘';
      default: return '📍';
    }
  };

  const filteredFacilities = facilities.filter(facility => {
    if (facility.isDeleted) return false;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      facility.code.toLowerCase().includes(searchLower) ||
      facility.type.toLowerCase().includes(searchLower) ||
      facility.zoneId.toLowerCase().includes(searchLower);
      
    const matchesFilters = 
      (!filters.type || facility.type === filters.type) &&
      (!filters.zone || facility.zoneId === filters.zone) &&
      (!filters.status || facility.status === filters.status);
      
    return matchesSearch && matchesFilters;
  });

  const getFacilityStats = () => {
    const total = filteredFacilities.length;
    const available = filteredFacilities.filter(f => f.status === 'available').length;
    const maintenance = filteredFacilities.filter(f => f.status === 'maintenance').length;
    const occupied = filteredFacilities.filter(f => f.status === 'occupied').length;
    
    return { total, available, maintenance, occupied };
  };

  const stats = getFacilityStats();

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Facilities Management</h1>
          <p className="text-sm text-gray-600 mt-1">Monitor and manage all facilities</p>
        </div>
        <div className="flex space-x-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Table
            </button>
          </div>
          <button
            onClick={() => {
              setEditingFacility(null);
              resetForm();
              setShowCreateModal(true);
            }}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Facility
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <MapPin className="h-8 w-8 text-indigo-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Facilities</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Available</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.available}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Maintenance</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.maintenance}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Occupied</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.occupied}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search facilities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          
          <div className="flex space-x-3">
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Types</option>
              <option value="toilet">Toilets</option>
              <option value="bin">Bins</option>
              <option value="water">Water</option>
              <option value="helpdesk">Helpdesk</option>
            </select>
            
            <select
              value={filters.zone}
              onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Zones</option>
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="Central">Central</option>
            </select>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
              <option value="full">Full</option>
              <option value="out-of-order">Out of Order</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredFacilities.map((facility) => {
            const facilityTasks = tasks.filter(t => t.facilityId === facility.id && ['pending', 'in-progress'].includes(t.status));
            
            return (
              <div key={facility.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{getTypeIcon(facility.type)}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{facility.code}</h3>
                      <p className="text-sm text-gray-500 capitalize">{facility.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {facility.qrId && (
                      <QrCode className="w-4 h-4 text-green-600" title="QR Code Available" />
                    )}
                    <button
                      onClick={() => openEditModal(facility)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mr-2" />
                    {facility.zoneId}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(facility.status)}`}>
                      {facility.status.replace('-', ' ')}
                    </span>
                  </div>
                  {facility.capacity && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Capacity:</span>
                      <span className="text-sm font-medium text-gray-900">{facility.capacity}</span>
                    </div>
                  )}
                </div>

                {/* Active Tasks */}
                {facilityTasks.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-medium text-gray-700 mb-2">Active Tasks ({facilityTasks.length})</div>
                    <div className="space-y-1">
                      {facilityTasks.slice(0, 2).map(task => (
                        <div key={task.id} className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2">
                          <div className="font-medium text-yellow-800">{task.title}</div>
                          <div className="text-yellow-600">Due: {new Date(task.dueAt).toLocaleDateString()}</div>
                        </div>
                      ))}
                      {facilityTasks.length > 2 && (
                        <div className="text-xs text-gray-500">+{facilityTasks.length - 2} more tasks</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleStatusUpdate(facility, 'available')}
                    className="bg-green-100 text-green-800 py-2 px-3 rounded-lg hover:bg-green-200 text-xs font-medium"
                  >
                    Mark Clean
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(facility, 'maintenance')}
                    className="bg-red-100 text-red-800 py-2 px-3 rounded-lg hover:bg-red-200 text-xs font-medium"
                  >
                    Maintenance
                  </button>
                </div>

                <button
                  onClick={() => {
                    setSelectedFacility(facility);
                    setShowFacilityDetail(true);
                  }}
                  className="w-full mt-2 bg-gray-100 text-gray-700 py-2 px-3 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  View Details
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFacilities.map((facility) => (
                  <tr key={facility.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg mr-2">{getTypeIcon(facility.type)}</span>
                        <span className="text-sm font-medium text-gray-900">{facility.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 capitalize">{facility.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{facility.zoneId}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(facility.status)}`}>
                        {facility.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {facility.capacity || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(facility.lastUpdated).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleStatusUpdate(facility, 'available')}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Mark Clean"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(facility, 'maintenance')}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Report Maintenance"
                        >
                          <Wrench className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(facility)}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
                          title="Edit Facility"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFacility(facility);
                            setShowFacilityDetail(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="View Details"
                        >
                          <Camera className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Facility Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingFacility ? 'Edit Facility' : 'Add New Facility'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingFacility(null);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateFacility} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Facility Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newFacility.code}
                    onChange={(e) => setNewFacility({ ...newFacility, code: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., T001, B001, W001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newFacility.type}
                    onChange={(e) => setNewFacility({ ...newFacility, type: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="toilet">Toilet</option>
                    <option value="bin">Bin</option>
                    <option value="water">Water</option>
                    <option value="helpdesk">Helpdesk</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Zone</label>
                  <select
                    value={newFacility.zoneId}
                    onChange={(e) => setNewFacility({ ...newFacility, zoneId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="North">North</option>
                    <option value="South">South</option>
                    <option value="East">East</option>
                    <option value="West">West</option>
                    <option value="Central">Central</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Capacity</label>
                  <input
                    type="number"
                    value={newFacility.capacity}
                    onChange={(e) => setNewFacility({ ...newFacility, capacity: parseInt(e.target.value) || 10 })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={newFacility.lat}
                    onChange={(e) => setNewFacility({ ...newFacility, lat: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., 25.3176"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={newFacility.lng}
                    onChange={(e) => setNewFacility({ ...newFacility, lng: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., 83.0131"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingFacility(null);
                    resetForm();
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingFacility ? 'Update Facility' : 'Add Facility'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Facility Detail Modal */}
      {showFacilityDetail && selectedFacility && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {getTypeIcon(selectedFacility.type)} {selectedFacility.code}
              </h2>
              <button
                onClick={() => setShowFacilityDetail(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Facility Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium capitalize">{selectedFacility.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Zone:</span>
                      <span className="font-medium">{selectedFacility.zoneId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(selectedFacility.status)}`}>
                        {selectedFacility.status.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Capacity:</span>
                      <span className="font-medium">{selectedFacility.capacity || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Location:</span>
                      <span className="font-medium">{selectedFacility.lat.toFixed(6)}, {selectedFacility.lng.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">QR Code:</span>
                      <span className="font-medium">
                        {selectedFacility.qrId ? (
                          <span className="text-green-600">Available</span>
                        ) : (
                          <span className="text-gray-400">Not Generated</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-6 space-y-2">
                    <button
                      onClick={() => handleStatusUpdate(selectedFacility, 'available')}
                      className="w-full bg-green-100 text-green-800 py-2 rounded-lg hover:bg-green-200 font-medium"
                    >
                      Mark Clean & Available
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedFacility, 'maintenance')}
                      className="w-full bg-red-100 text-red-800 py-2 rounded-lg hover:bg-red-200 font-medium"
                    >
                      Report Maintenance Issue
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedFacility, 'full')}
                      className="w-full bg-orange-100 text-orange-800 py-2 rounded-lg hover:bg-orange-200 font-medium"
                    >
                      Mark Full
                    </button>
                    <button
                      onClick={() => openEditModal(selectedFacility)}
                      className="w-full bg-indigo-100 text-indigo-800 py-2 rounded-lg hover:bg-indigo-200 font-medium"
                    >
                      Edit Facility
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Assigned Tasks</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {tasks.filter(t => t.facilityId === selectedFacility.id).map((task) => (
                      <div key={task.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            task.priority === 'high' ? 'bg-red-100 text-red-800' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{task.description}</p>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            task.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                            task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                            task.status === 'completed' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {task.status.replace('-', ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            Due: {new Date(task.dueAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {tasks.filter(t => t.facilityId === selectedFacility.id).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <div>No tasks assigned</div>
                      </div>
                    )}
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

export default FacilitiesPage;