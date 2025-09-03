import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MapPin, Plus, Search, Filter, Camera, Wrench, CheckCircle, AlertTriangle, QrCode } from 'lucide-react';
import { Facility, Task } from '../../types/admin';

const FacilitiesPage: React.FC = () => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    zone: '',
    status: ''
  });
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [showFacilityDetail, setShowFacilityDetail] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const facilitiesSnapshot = await getDocs(collection(db, 'facilities'));
      const facilitiesData = facilitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Facility[];
      
      const tasksSnapshot = await getDocs(collection(db, 'tasks'));
      const tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      
      setFacilities(facilitiesData);
      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await addDoc(collection(db, 'facilities'), {
        ...newFacility,
        photos: [],
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      setShowCreateModal(false);
      setNewFacility({
        code: '',
        type: 'toilet',
        zoneId: 'North',
        lat: 0,
        lng: 0,
        capacity: 10,
        status: 'available'
      });
      
      fetchData();
      alert('Facility created successfully!');
    } catch (error) {
      console.error('Error creating facility:', error);
      alert('Failed to create facility');
    }
  };

  const handleStatusUpdate = async (facility: Facility, newStatus: string) => {
    if (!facility.id) return;
    
    try {
      await updateDoc(doc(db, 'facilities', facility.id), {
        status: newStatus,
        lastUpdated: serverTimestamp()
      });

      // Auto-create task for certain status changes
      if (newStatus === 'maintenance' || newStatus === 'full') {
        const taskTitle = newStatus === 'maintenance' ? 'Maintenance Required' : 'Empty/Clean Required';
        await addDoc(collection(db, 'tasks'), {
          title: taskTitle,
          description: `${facility.type} ${facility.code} requires ${newStatus === 'maintenance' ? 'maintenance' : 'cleaning/emptying'}`,
          facilityId: facility.id,
          zoneId: facility.zoneId,
          assignedTo: { type: 'team', id: '' },
          priority: newStatus === 'maintenance' ? 'high' : 'medium',
          status: 'pending',
          createdAt: serverTimestamp(),
          createdBy: 'system',
          dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          slaMinutes: 120,
          photosBefore: [],
          photosAfter: []
        });
      }

      fetchData();
      alert('Status updated successfully!');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
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
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                viewMode === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Map
            </button>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Facility
          </button>
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

      {/* Facilities Table */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QR</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(facility.lastUpdated).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {facility.qrId ? (
                        <QrCode className="w-4 h-4 text-green-600" />
                      ) : (
                        <span className="text-xs text-gray-400">No QR</span>
                      )}
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
                          onClick={() => {
                            setSelectedFacility(facility);
                            setShowFacilityDetail(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
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

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Map View</h3>
            <p className="text-gray-600">Interactive map showing all facilities would be displayed here</p>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {filteredFacilities.slice(0, 8).map((facility) => (
                <div key={facility.id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <span className="text-lg mr-2">{getTypeIcon(facility.type)}</span>
                    <span className="text-sm font-medium">{facility.code}</span>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(facility.status)}`}>
                    {facility.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Facility Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Add New Facility</h2>
              <button
                onClick={() => setShowCreateModal(false)}
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
                    onChange={(e) => setNewFacility({ ...newFacility, capacity: parseInt(e.target.value) })}
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
                    onChange={(e) => setNewFacility({ ...newFacility, lat: parseFloat(e.target.value) })}
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
                    onChange={(e) => setNewFacility({ ...newFacility, lng: parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., 83.0131"
                  />
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
                  className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Facility</span>
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
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-6 space-y-2">
                    <button
                      onClick={() => handleStatusUpdate(selectedFacility, 'available')}
                      className="w-full bg-green-100 text-green-800 py-2 rounded-lg hover:bg-green-200 font-medium"
                    >
                      Mark Clean
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedFacility, 'maintenance')}
                      className="w-full bg-red-100 text-red-800 py-2 rounded-lg hover:bg-red-200 font-medium"
                    >
                      Report Maintenance
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedFacility, 'full')}
                      className="w-full bg-orange-100 text-orange-800 py-2 rounded-lg hover:bg-orange-200 font-medium"
                    >
                      Mark Full
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Assigned Tasks</h3>
                  <div className="space-y-3">
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