import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, Clock, User, Camera, CheckCircle, AlertTriangle, MapPin } from 'lucide-react';
import { Task, StaffMember, Team, Facility } from '../../types/admin';
import { getCurrentUser } from '../../firebase/auth';

const TaskManagementPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'map'>('kanban');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);

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
    { id: 'pending', title: 'Pending', color: 'bg-gray-100' },
    { id: 'in-progress', title: 'In Progress', color: 'bg-blue-100' },
    { id: 'completed', title: 'Completed', color: 'bg-green-100' },
    { id: 'verified', title: 'Verified', color: 'bg-purple-100' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [tasksSnapshot, staffSnapshot, teamsSnapshot, facilitiesSnapshot] = await Promise.all([
        getDocs(collection(db, 'tasks')),
        getDocs(collection(db, 'staff')),
        getDocs(collection(db, 'teams')),
        getDocs(collection(db, 'facilities'))
      ]);
      
      setTasks(tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]);
      setStaff(staffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StaffMember[]);
      setTeams(teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Team[]);
      setFacilities(facilitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Facility[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const currentUser = getCurrentUser();
      
      await addDoc(collection(db, 'tasks'), {
        ...newTask,
        status: 'pending',
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'unknown',
        dueAt: new Date(newTask.dueAt),
        photosBefore: [],
        photosAfter: []
      });
      
      setShowCreateModal(false);
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
      
      fetchData();
      alert('Task created successfully!');
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task');
    }
  };

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (newStatus === 'in-progress') {
        updateData.startedAt = serverTimestamp();
      } else if (newStatus === 'completed') {
        updateData.completedAt = serverTimestamp();
      } else if (newStatus === 'verified') {
        updateData.verifiedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'tasks', taskId), updateData);
      fetchData();
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
            {['kanban', 'table', 'map'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`px-3 py-1 rounded-md text-sm font-medium capitalize ${
                  viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </button>
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statusColumns.map((column) => (
            <div key={column.id} className="bg-white rounded-lg shadow">
              <div className={`p-4 ${column.color} rounded-t-lg`}>
                <h3 className="font-medium text-gray-900">{column.title}</h3>
                <span className="text-sm text-gray-600">
                  {tasks.filter(t => t.status === column.id).length} tasks
                </span>
              </div>
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {tasks.filter(t => t.status === column.id).map((task) => {
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
              </div>
            </div>
          ))}
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
                {tasks.map((task) => {
                  const facility = facilities.find(f => f.id === task.facilityId);
                  
                  return (
                    <tr key={task.id} className={`hover:bg-gray-50 ${isOverdue(task) ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{task.title}</div>
                        <div className="text-sm text-gray-500 line-clamp-2">{task.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{facility?.code || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{facility?.type}</div>
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

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Task Map View</h3>
            <p className="text-gray-600">Interactive map showing task locations would be displayed here</p>
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
                    <option value="">Select Facility</option>
                    {facilities.map(facility => (
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setNewTask({ ...newTask, assignedTo: { ...newTask.assignedTo, type: 'team' } })}
                        className={`px-3 py-1 text-sm rounded-md ${
                          newTask.assignedTo.type === 'team' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Team
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTask({ ...newTask, assignedTo: { ...newTask.assignedTo, type: 'staff' } })}
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
                    >
                      <option value="">Select {newTask.assignedTo.type}</option>
                      {newTask.assignedTo.type === 'team' 
                        ? teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))
                        : staff.filter(s => s.isActive).map(member => (
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
                    onChange={(e) => setNewTask({ ...newTask, slaMinutes: parseInt(e.target.value) })}
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
                      <span className="text-gray-600">Due Date:</span>
                      <span className={`font-medium ${isOverdue(selectedTask) ? 'text-red-600' : ''}`}>
                        {new Date(selectedTask.dueAt).toLocaleString()}
                      </span>
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