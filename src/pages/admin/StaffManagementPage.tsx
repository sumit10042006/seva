import React, { useState } from 'react';
import { Plus, Search, Filter, Upload, RotateCcw } from 'lucide-react';
import { StaffTable } from '../../components/admin/StaffTable';
import { AddStaffModal } from '../../components/admin/AddStaffModal';
import { BulkUploadModal } from '../../components/admin/BulkUploadModal';
import { StaffMember } from '../../types/admin';

const StaffManagementPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [filters, setFilters] = useState({
    role: '',
    team: '',
    shift: '',
    zone: '',
    active: true
  });

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      role: '',
      team: '',
      shift: '',
      zone: '',
      active: true
    });
    setSearchTerm('');
  };

  const handleSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleEditStaff = (staff: StaffMember) => {
    setEditingStaff(staff);
    setShowAddModal(true);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your workforce with comprehensive tools</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </button>
          <button
            onClick={() => {
              setEditingStaff(null);
              setShowAddModal(true);
            }}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Staff
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name, email, or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            
            <button
              onClick={resetFilters}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={filters.role}
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                <select
                  value={filters.shift}
                  onChange={(e) => handleFilterChange('shift', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="">All Shifts</option>
                  <option value="red">Red (Morning)</option>
                  <option value="orange">Orange (Afternoon)</option>
                  <option value="green">Green (Night)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                <select
                  value={filters.zone}
                  onChange={(e) => handleFilterChange('zone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="">All Zones</option>
                  <option value="north">North</option>
                  <option value="south">South</option>
                  <option value="east">East</option>
                  <option value="west">West</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                <select
                  value={filters.team}
                  onChange={(e) => handleFilterChange('team', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="">All Teams</option>
                  <option value="sanitation">Sanitation</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="security">Security</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.active}
                    onChange={(e) => handleFilterChange('active', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active Only</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Staff Table */}
      <StaffTable
        searchTerm={searchTerm}
        filters={filters}
        onEditStaff={handleEditStaff}
        refreshTrigger={refreshTrigger}
      />

      {/* Modals */}
      <AddStaffModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingStaff(null);
        }}
        onSuccess={handleSuccess}
        editingStaff={editingStaff}
      />

      <BulkUploadModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default StaffManagementPage;