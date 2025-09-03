import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, Clock, User, Camera, CheckCircle, AlertTriangle, MapPin, X, Filter, Search } from 'lucide-react';
import { Task, StaffMember, Team, Facility } from '../../types/admin';
import { getCurrentUser } from '../../firebase/auth';

const TaskManagementPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [filters, setFilters] = useState({
    priority: '',
    status: '',
    assignedTo: '',
    zone: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    facilityId: '',
    zoneId: 'North',
    assignedTo: { type: 'team' as 'team' | 'staff', id: '' },
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
    slaMinutes: 120
  });

  const statusColumns = [
    { id: 'pending', title: 'Pending', color: 'bg-gray-100', textColor: 'text-gray-800' },
    { id: 'in-progress', title: 'In Progress', color: 'bg-blue-100', textColor: 'text-blue-800' },
    { id: 'completed', title: 'Completed', color: 'bg-green-100', textColor: 'text-green-800' },
    { id: 'verified', title: 'Verified', color: 'bg-purple-100', textColor: 'text-purple-800' }
  ];

  useEffect(() => {
    // Real-time listeners
    const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const staffQuery = query(collection(db, 'staff'), where('isActive', '==', true));
    const teamsQuery = query(collection(db, 'teams'), where('isActive', '==', true));
    const facilitiesQuery = query(collection(db, 'facilities'));

    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        dueAt: doc.data().dueAt?.toDate?.() || new Date(),
        startedAt: doc.data().startedAt?.toDate?.(),
        completedAt: doc.data().completedAt?.toDate?.(),
        verifiedAt: doc.data().verifiedAt?.toDate?.()
      })) as Task[];
      setTasks(tasksData);
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
      unsubscribeTasks();
      unsubscribeStaff();
      unsubscribeTeams();
      unsubscribeFacilities();
    };
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTask.title.trim()) {
      alert('Task title is required');
      return;
    }

    if (!newTask.assignedTo.id) {
      alert('Please assign the task to someone');
      return;
    }

    try {
      const currentUser = getCurrentUser();
      
      await addDoc(collection(db, 'tasks'), {
        ...newTask,
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'unknown',
        dueAt: new Date(newTask.dueAt),
        photosBefore: [],
        photosAfter: []
      });
      
      setShowCreateModal(false);
      resetTaskForm();
      alert('Task created successfully!');
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task');
    }
  };

  const resetTaskForm = () => {
    setNewTask({
      title: '',
      description: '',
      facilityId: '',
      zoneId: 'North',
      assignedTo: { type: 'team', id: '' },
      priority: 'medium',
      dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
      slaMinutes: 120
    });
  };

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      const currentUser = getCurrentUser();
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || 'unknown'
      };

      if (newStatus === 'in-progress') {
        updateData.startedAt = serverTimestamp();
      } else if (newStatus === 'completed') {
        updateData.completedAt = serverTimestamp();
      } else if (newStatus === 'verified') {
        updateData.verifiedAt = serverTimestamp();
        updateData.verifiedBy = currentUser?.uid || 'unknown';
      }

      await updateDoc(doc(db, 'tasks', taskId), updateData);
      alert('Task status updated successfully!');
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAssignedName = (task: Task) => {
    if (task.assignedTo.type === 'staff') {
      const staffMember = staff.find(s => s.id === task.assignedTo.id);
      return staffMember?.name || 'Unknown Staff';
    } else {
      const team = teams.find(t => t.id === task.assignedTo.id);
      return team?.name || 'Unknown Team';
    }
  };

  const isOverdue = (task: Task) => {
    return new Date(task.dueAt) < new Date() && !['completed', 'verified'].includes(task.status);
  };

  const filteredTasks = tasks.filter(task => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      task.title.toLowerCase().includes(searchLower) ||
      task.description?.toLowerCase().includes(searchLower) ||
      getAssignedName(task).toLowerCase().includes(searchLower);
      
    const matchesFilters = 
      (!filters.priority || task.priority === filters.priority) &&
      (!filters.status || task.status === filters.status) &&
      (!filters.zone || task.zoneId === filters.zone) &&
      (!filters.assignedTo || task.assignedTo.id === filters.assignedTo);
      
    return matchesSearch && matchesFilters;
  });

  const getTaskStats = () => {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const overdue = tasks.filter(t => isOverdue(t)).length;
    
    return { total, pending, inProgress, completed, overdue };
  };

  const taskStats = getTaskStats();

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
          <h1 className="text-2xl font-bold text-gray-800">Task Management</h1>
          <p className="text-sm text-gray-600 mt-1">Create, assign, and track tasks</p>
        </div>
        <div className="flex space-x-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                viewMode === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Kanban
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
              resetTaskForm();
              setShowCreateModal(true);
            }}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-indigo-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Tasks</p>
              <p className="text-2xl font-semibold text-gray-900">{taskStats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-gray-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-semibold text-gray-900">{taskStats.pending}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">In Progress</p>
              <p className="text-2xl font-semibold text-gray-900">{taskStats.inProgress}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <p className="text-2xl font-semibold text-gray-900">{taskStats.completed}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Overdue</p>
              <p className="text-2xl font-semibold text-gray-900">{taskStats.overdue}</p>
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
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          
          <div className="flex space-x-3">
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="verified">Verified</option>
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
          </div>
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statusColumns.map((column) => {
            const columnTasks = filteredTasks.filter(t => t.status === column.id);
            
            return (
              <div key={column.id} className="bg-white rounded-lg shadow">
                <div className={`p-4 ${column.color} rounded-t-lg`}>
                  <h3 className={`font-medium ${column.textColor}`}>{column.title}</h3>
                  <span className="text-sm text-gray-600">
                    {columnTasks.length} tasks
                  </span>
                </div>
                <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {columnTasks.map((task) => {
                    const facility = facilities.find(f => f.id === task.facilityId);
                    
                    return (
                      <div
                        key={task.id}
                        className={`p-3 border rounded-lg cursor-pointer hover:shadow-md transition-shadow ${
                          isOverdue(task) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                        onClick={() => {
                          setSelectedTask(task);
                          setShowTaskDetail(true);
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{task.title}</h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </div>
                        
                        {facility && (
                          <div className="flex items-center text-xs text-gray-500 mb-2">
                            <MapPin className="w-3 h-3 mr-1" />
                            {facility.code} ({facility.type})
                          </div>
                        )}
                        
                        <div className="flex items-center text-xs text-gray-500 mb-2">
                          <User className="w-3 h-3 mr-1" />
                          {getAssignedName(task)}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(task.dueAt).toLocaleDateString()}
                          </div>
                          {isOverdue(task) && (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {columnTasks.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Clock className="w-8 h-8 mx-auto mb-2" />
                      <div className="text-sm">No {column.title.toLowerCase()} tasks</div>
                    </div>
                  )}
                </div>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTasks.map((task) => {
                  const facility = facilities.find(f => f.id === task.facilityId);
                  
                  return (
                    <tr key={task.id} className={`hover:bg-gray-50 ${isOverdue(task) ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{task.title}</div>
                        <div className="text-sm text-gray-500 line-clamp-2">{task.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{facility?.code || 'General'}</div>
                        <div className="text-sm text-gray-500">{facility?.type || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getAssignedName(task)}</div>
                        <div className="text-sm text-gray-500">{task.assignedTo.type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          task.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                          task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                          task.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {task.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${isOverdue(task) ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                          {new Date(task.dueAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(task.dueAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedTask(task);
                            setShowTaskDetail(true);
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
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Create New Task</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Clean toilet T001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  placeholder="Detailed task description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Facility</label>
                  <select
                    value={newTask.facilityId}
                    onChange={(e) => setNewTask({ ...newTask, facilityId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">General Task</option>
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
                    value={newTask.zoneId}
                    onChange={(e) => setNewTask({ ...newTask, zoneId: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign To <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setNewTask({ ...newTask, assignedTo: { ...newTask.assignedTo, type: 'team', id: '' } })}
                        className={`px-3 py-1 text-sm rounded-md ${
                          newTask.assignedTo.type === 'team' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Team
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTask({ ...newTask, assignedTo: { ...newTask.assignedTo, type: 'staff', id: '' } })}
                        className={`px-3 py-1 text-sm rounded-md ${
                          newTask.assignedTo.type === 'staff' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Individual
                      </button>
                    </div>
                    <select
                      value={newTask.assignedTo.id}
                      onChange={(e) => setNewTask({ ...newTask, assignedTo: { ...newTask.assignedTo, id: e.target.value } })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select {newTask.assignedTo.type}</option>
                      {newTask.assignedTo.type === 'team' 
                        ? teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))
                        : staff.map(member => (
                            <option key={member.id} value={member.id}>{member.name} ({member.role})</option>
                          ))
                      }
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date & Time</label>
                  <input
                    type="datetime-local"
                    value={newTask.dueAt}
                    onChange={(e) => setNewTask({ ...newTask, dueAt: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SLA (Minutes)</label>
                  <input
                    type="number"
                    value={newTask.slaMinutes}
                    onChange={(e) => setNewTask({ ...newTask, slaMinutes: parseInt(e.target.value) || 120 })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    min="1"
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
                  <span>Create Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {showTaskDetail && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">{selectedTask.title}</h2>
              <button
                onClick={() => setShowTaskDetail(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Task Details</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Description:</span>
                      <p className="text-sm text-gray-900 mt-1">{selectedTask.description || 'No description provided'}</p>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        selectedTask.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                        selectedTask.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                        selectedTask.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {selectedTask.status.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Priority:</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedTask.priority)}`}>
                        {selectedTask.priority}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Assigned To:</span>
                      <span className="font-medium">{getAssignedName(selectedTask)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Zone:</span>
                      <span className="font-medium">{selectedTask.zoneId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Due Date:</span>
                      <span className={`font-medium ${isOverdue(selectedTask) ? 'text-red-600' : ''}`}>
                        {new Date(selectedTask.dueAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">SLA:</span>
                      <span className="font-medium">{selectedTask.slaMinutes} minutes</span>
                    </div>
                  </div>

                  {/* Status Update Actions */}
                  <div className="mt-6 space-y-2">
                    {selectedTask.status === 'pending' && (
                      <button
                        onClick={() => handleStatusUpdate(selectedTask.id!, 'in-progress')}
                        className="w-full bg-blue-100 text-blue-800 py-2 rounded-lg hover:bg-blue-200 font-medium"
                      >
                        Start Task
                      </button>
                    )}
                    {selectedTask.status === 'in-progress' && (
                      <button
                        onClick={() => handleStatusUpdate(selectedTask.id!, 'completed')}
                        className="w-full bg-green-100 text-green-800 py-2 rounded-lg hover:bg-green-200 font-medium"
                      >
                        Mark Complete
                      </button>
                    )}
                    {selectedTask.status === 'completed' && (
                      <button
                        onClick={() => handleStatusUpdate(selectedTask.id!, 'verified')}
                        className="w-full bg-purple-100 text-purple-800 py-2 rounded-lg hover:bg-purple-200 font-medium"
                      >
                        Verify Task
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Task Timeline</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <Plus className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">Task Created</div>
                        <div className="text-xs text-gray-500">
                          {new Date(selectedTask.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {selectedTask.startedAt && (
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Clock className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">Task Started</div>
                          <div className="text-xs text-gray-500">
                            {new Date(selectedTask.startedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedTask.completedAt && (
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">Task Completed</div>
                          <div className="text-xs text-gray-500">
                            {new Date(selectedTask.completedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedTask.verifiedAt && (
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">Task Verified</div>
                          <div className="text-xs text-gray-500">
                            {new Date(selectedTask.verifiedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SLA Status */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">SLA Status</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Target Time:</span>
                      <span className="text-sm font-medium">{selectedTask.slaMinutes} minutes</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                      <span className={`text-sm font-medium ${
                        isOverdue(selectedTask) ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {isOverdue(selectedTask) ? 'Overdue' : 'On Time'}
                      </span>
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

export default TaskManagementPage;