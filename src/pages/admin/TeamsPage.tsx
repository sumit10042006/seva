import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, Users, MapPin, Bell, User, Clock, AlertTriangle, X, Edit, Trash2 } from 'lucide-react';
import { Team, StaffMember, Task } from '../../types/admin';
import { getCurrentUser } from '../../firebase/auth';

const TeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showTeamDetail, setShowTeamDetail] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const [newTeam, setNewTeam] = useState({
    name: '',
    description: '',
    leaderId: '',
    zoneIds: [] as string[],
    defaultShift: 'red' as 'red' | 'orange' | 'green',
    capacity: 10
  });

  useEffect(() => {
    // Real-time listeners
    const teamsQuery = query(collection(db, 'teams'), orderBy('createdAt', 'desc'));
    const staffQuery = query(collection(db, 'staff'), where('isActive', '==', true), orderBy('name'));
    const tasksQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));

    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      })) as Team[];
      setTeams(teamsData);
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
      unsubscribeTeams();
      unsubscribeStaff();
      unsubscribeTasks();
    };
  }, []);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTeam.name.trim()) {
      alert('Team name is required');
      return;
    }

    try {
      const currentUser = getCurrentUser();
      
      const teamData = {
        ...newTeam,
        name: newTeam.name.trim(),
        memberIds: [],
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'unknown',
        isActive: true
      };

      await addDoc(collection(db, 'teams'), teamData);
      
      setShowCreateModal(false);
      resetForm();
      alert('Team created successfully!');
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Failed to create team');
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingTeam?.id) return;

    try {
      await updateDoc(doc(db, 'teams', editingTeam.id), {
        ...newTeam,
        name: newTeam.name.trim(),
        updatedAt: serverTimestamp()
      });
      
      setShowCreateModal(false);
      setEditingTeam(null);
      resetForm();
      alert('Team updated successfully!');
    } catch (error) {
      console.error('Error updating team:', error);
      alert('Failed to update team');
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    if (!team.id) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete "${team.name}"? This action cannot be undone.`
    );
    
    if (confirmed) {
      try {
        await updateDoc(doc(db, 'teams', team.id), {
          isActive: false,
          deletedAt: serverTimestamp()
        });
        alert('Team deleted successfully!');
      } catch (error) {
        console.error('Error deleting team:', error);
        alert('Failed to delete team');
      }
    }
  };

  const handleNotifyTeam = async (team: Team) => {
    const message = prompt(`Send notification to ${team.name} team:`);
    if (message && message.trim()) {
      try {
        const teamMembers = staff.filter(s => team.memberIds.includes(s.id!) && s.isActive);
        const phoneNumbers = teamMembers.map(s => s.mobile).filter(Boolean);
        
        if (phoneNumbers.length === 0) {
          alert('No active team members found to notify');
          return;
        }

        await addDoc(collection(db, 'notifications'), {
          to: phoneNumbers,
          channel: 'sms',
          message: `[${team.name}] ${message.trim()}`,
          status: 'pending',
          createdAt: serverTimestamp(),
          teamId: team.id
        });
        
        alert(`Notification sent to ${phoneNumbers.length} team members`);
      } catch (error) {
        console.error('Error sending team notification:', error);
        alert('Failed to send notification');
      }
    }
  };

  const handleAddMemberToTeam = async (teamId: string, staffId: string) => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      const updatedMemberIds = [...team.memberIds, staffId];
      
      await updateDoc(doc(db, 'teams', teamId), {
        memberIds: updatedMemberIds,
        updatedAt: serverTimestamp()
      });

      // Update staff member's team assignment
      await updateDoc(doc(db, 'staff', staffId), {
        teamIds: [teamId],
        updatedAt: serverTimestamp()
      });

      alert('Staff member added to team successfully!');
    } catch (error) {
      console.error('Error adding member to team:', error);
      alert('Failed to add member to team');
    }
  };

  const handleRemoveMemberFromTeam = async (teamId: string, staffId: string) => {
    try {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      const updatedMemberIds = team.memberIds.filter(id => id !== staffId);
      
      await updateDoc(doc(db, 'teams', teamId), {
        memberIds: updatedMemberIds,
        updatedAt: serverTimestamp()
      });

      // Update staff member's team assignment
      const staffMember = staff.find(s => s.id === staffId);
      if (staffMember) {
        const updatedTeamIds = staffMember.teamIds.filter(id => id !== teamId);
        await updateDoc(doc(db, 'staff', staffId), {
          teamIds: updatedTeamIds,
          updatedAt: serverTimestamp()
        });
      }

      alert('Staff member removed from team successfully!');
    } catch (error) {
      console.error('Error removing member from team:', error);
      alert('Failed to remove member from team');
    }
  };

  const resetForm = () => {
    setNewTeam({
      name: '',
      description: '',
      leaderId: '',
      zoneIds: [],
      defaultShift: 'red',
      capacity: 10
    });
  };

  const openEditModal = (team: Team) => {
    setEditingTeam(team);
    setNewTeam({
      name: team.name,
      description: team.description || '',
      leaderId: team.leaderId || '',
      zoneIds: team.zoneIds || [],
      defaultShift: team.defaultShift,
      capacity: team.capacity
    });
    setShowCreateModal(true);
  };

  const getTeamStats = (team: Team) => {
    const teamMembers = staff.filter(s => team.memberIds.includes(s.id!) && s.isActive);
    const activeTasks = tasks.filter(t => 
      t.assignedTo.type === 'team' && 
      t.assignedTo.id === team.id &&
      ['pending', 'in-progress'].includes(t.status)
    );
    
    return {
      totalMembers: teamMembers.length,
      activeMembers: teamMembers.filter(s => s.onDuty).length,
      activeTasks: activeTasks.length,
      coverage: Math.round((teamMembers.length / team.capacity) * 100)
    };
  };

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 80) return 'text-green-600';
    if (coverage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUnassignedStaff = () => {
    return staff.filter(s => 
      s.isActive && 
      !teams.some(team => team.memberIds.includes(s.id!))
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
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
          <h1 className="text-2xl font-bold text-gray-800">Teams Management</h1>
          <p className="text-sm text-gray-600 mt-1">Organize and manage your workforce teams</p>
        </div>
        <button
          onClick={() => {
            setEditingTeam(null);
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-indigo-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Teams</p>
              <p className="text-2xl font-semibold text-gray-900">{teams.filter(t => t.isActive).length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <User className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Assigned Staff</p>
              <p className="text-2xl font-semibold text-gray-900">
                {staff.filter(s => s.isActive && s.teamIds.length > 0).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Unassigned Staff</p>
              <p className="text-2xl font-semibold text-gray-900">{getUnassignedStaff().length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Tasks</p>
              <p className="text-2xl font-semibold text-gray-900">
                {tasks.filter(t => ['pending', 'in-progress'].includes(t.status)).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.filter(t => t.isActive).map((team) => {
          const stats = getTeamStats(team);
          const leader = staff.find(s => s.id === team.leaderId);
          
          return (
            <div key={team.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{team.description}</p>
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    team.defaultShift === 'red' ? 'bg-red-100 text-red-800' :
                    team.defaultShift === 'orange' ? 'bg-orange-100 text-orange-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {team.defaultShift.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Team Leader */}
              <div className="flex items-center mb-4">
                <User className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-600">
                  Leader: {leader?.name || 'Not assigned'}
                </span>
              </div>

              {/* Zones */}
              <div className="flex items-center mb-4">
                <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                <div className="flex flex-wrap gap-1">
                  {team.zoneIds.map(zone => (
                    <span key={zone} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      {zone}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">{stats.activeMembers}</div>
                  <div className="text-xs text-gray-500">On Duty</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">{stats.totalMembers}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">{stats.activeTasks}</div>
                  <div className="text-xs text-gray-500">Tasks</div>
                </div>
              </div>

              {/* Coverage Indicator */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Capacity</span>
                  <span className={`font-medium ${getCoverageColor(stats.coverage)}`}>
                    {stats.coverage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      stats.coverage >= 80 ? 'bg-green-500' :
                      stats.coverage >= 60 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(stats.coverage, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedTeam(team);
                    setShowTeamDetail(true);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 px-3 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                >
                  View Details
                </button>
                <button
                  onClick={() => openEditModal(team)}
                  className="bg-indigo-100 text-indigo-700 p-2 rounded-lg hover:bg-indigo-200 transition-colors"
                  title="Edit Team"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleNotifyTeam(team)}
                  className="bg-blue-100 text-blue-700 p-2 rounded-lg hover:bg-blue-200 transition-colors"
                  title="Notify Team"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteTeam(team)}
                  className="bg-red-100 text-red-700 p-2 rounded-lg hover:bg-red-200 transition-colors"
                  title="Delete Team"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTeam ? 'Edit Team' : 'Create New Team'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingTeam(null);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingTeam ? handleUpdateTeam : handleCreateTeam} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Sanitation Team A"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  placeholder="Brief description of team responsibilities"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Leader
                  </label>
                  <select
                    value={newTeam.leaderId}
                    onChange={(e) => setNewTeam({ ...newTeam, leaderId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Select Leader</option>
                    {staff.filter(s => s.isActive && ['manager', 'supervisor', 'admin'].includes(s.role)).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Shift
                  </label>
                  <select
                    value={newTeam.defaultShift}
                    onChange={(e) => setNewTeam({ ...newTeam, defaultShift: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="red">Red (Morning)</option>
                    <option value="orange">Orange (Afternoon)</option>
                    <option value="green">Green (Night)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Capacity
                </label>
                <input
                  type="number"
                  value={newTeam.capacity}
                  onChange={(e) => setNewTeam({ ...newTeam, capacity: parseInt(e.target.value) || 10 })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  min="1"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assigned Zones
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['North', 'South', 'East', 'West', 'Central'].map((zone) => (
                    <div key={zone} className="flex items-center">
                      <input
                        id={`zone-${zone}`}
                        type="checkbox"
                        checked={newTeam.zoneIds.includes(zone)}
                        onChange={(e) => {
                          const zoneIds = e.target.checked
                            ? [...newTeam.zoneIds, zone]
                            : newTeam.zoneIds.filter(z => z !== zone);
                          setNewTeam({ ...newTeam, zoneIds });
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor={`zone-${zone}`} className="ml-2 text-sm text-gray-700">
                        {zone}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTeam(null);
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
                  <span>{editingTeam ? 'Update Team' : 'Create Team'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Detail Modal */}
      {showTeamDetail && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">{selectedTeam.name}</h2>
              <button
                onClick={() => setShowTeamDetail(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Team Roster */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Team Roster ({selectedTeam.memberIds.length})</h3>
                    <button
                      onClick={() => {
                        const availableStaff = getUnassignedStaff();
                        if (availableStaff.length === 0) {
                          alert('No unassigned staff available');
                          return;
                        }
                        
                        const staffId = prompt(
                          `Available staff:\n${availableStaff.map((s, i) => `${i + 1}. ${s.name} (${s.role})`).join('\n')}\n\nEnter staff number to add:`
                        );
                        
                        if (staffId) {
                          const index = parseInt(staffId) - 1;
                          if (index >= 0 && index < availableStaff.length) {
                            handleAddMemberToTeam(selectedTeam.id!, availableStaff[index].id!);
                          }
                        }
                      }}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      + Add Member
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {staff.filter(s => selectedTeam.memberIds.includes(s.id!) && s.isActive).map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{member.name}</div>
                            <div className="text-xs text-gray-500">{member.role} • {member.mobile}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            member.onDuty ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {member.onDuty ? 'On Duty' : 'Off Duty'}
                          </span>
                          <button
                            onClick={() => handleRemoveMemberFromTeam(selectedTeam.id!, member.id!)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Remove from team"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active Tasks */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Active Tasks</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {tasks.filter(t => 
                      t.assignedTo.type === 'team' && 
                      t.assignedTo.id === selectedTeam.id &&
                      ['pending', 'in-progress'].includes(t.status)
                    ).map((task) => (
                      <div key={task.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{task.title}</h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            task.priority === 'high' ? 'bg-red-100 text-red-800' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{task.description}</p>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            task.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {task.status.replace('-', ' ')}
                          </span>
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="w-3 h-3 mr-1" />
                            Due: {new Date(task.dueAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {tasks.filter(t => 
                      t.assignedTo.type === 'team' && 
                      t.assignedTo.id === selectedTeam.id &&
                      ['pending', 'in-progress'].includes(t.status)
                    ).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <div>No active tasks</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => handleNotifyTeam(selectedTeam)}
                  className="bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                >
                  Notify Entire Team
                </button>
                <button
                  onClick={() => openEditModal(selectedTeam)}
                  className="bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 font-medium transition-colors"
                >
                  Edit Team Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsPage;