import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Send, MessageSquare, Mail, Phone, Users, User, Clock, CheckCircle, XCircle, X } from 'lucide-react';
import { Notification, StaffMember, Team } from '../../types/admin';
import { getCurrentUser } from '../../firebase/auth';

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientType, setRecipientType] = useState<'individual' | 'team' | 'zone'>('individual');

  const [newNotification, setNewNotification] = useState({
    message: '',
    channel: 'sms' as 'whatsapp' | 'sms' | 'email',
    templateId: '',
    scheduledFor: ''
  });

  const templates = [
    { id: 'shift-reminder', name: 'Shift Reminder', message: 'Your shift starts in 30 minutes. Please report to your assigned zone.' },
    { id: 'task-assigned', name: 'Task Assigned', message: 'A new task has been assigned to you. Please check your dashboard.' },
    { id: 'emergency-alert', name: 'Emergency Alert', message: 'URGENT: Emergency situation in your zone. Please respond immediately.' },
    { id: 'shift-end', name: 'Shift End', message: 'Your shift has ended. Thank you for your service today.' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const notificationsQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
      const [notificationsSnapshot, staffSnapshot, teamsSnapshot] = await Promise.all([
        getDocs(notificationsQuery),
        getDocs(collection(db, 'staff')),
        getDocs(collection(db, 'teams'))
      ]);
      
      setNotifications(notificationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[]);
      setStaff(staffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StaffMember[]);
      setTeams(teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Team[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedRecipients.length === 0) {
      alert('Please select at least one recipient');
      return;
    }

    try {
      const currentUser = getCurrentUser();
      let recipients: string[] = [];

      if (recipientType === 'individual') {
        recipients = selectedRecipients.map(staffId => {
          const staffMember = staff.find(s => s.id === staffId);
          return staffMember?.mobile || '';
        }).filter(Boolean);
      } else if (recipientType === 'team') {
        selectedRecipients.forEach(teamId => {
          const team = teams.find(t => t.id === teamId);
          if (team) {
            const teamMembers = staff.filter(s => team.memberIds.includes(s.id!));
            recipients.push(...teamMembers.map(s => s.mobile));
          }
        });
      } else if (recipientType === 'zone') {
        selectedRecipients.forEach(zone => {
          const zoneStaff = staff.filter(s => s.zoneId === zone);
          recipients.push(...zoneStaff.map(s => s.mobile));
        });
      }

      const notificationData = {
        to: recipients,
        channel: newNotification.channel,
        message: newNotification.message,
        templateId: newNotification.templateId,
        status: 'pending',
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'unknown'
      };

      if (newNotification.scheduledFor) {
        (notificationData as any).scheduledFor = new Date(newNotification.scheduledFor);
      }

      await addDoc(collection(db, 'notifications'), notificationData);
      
      setShowComposeModal(false);
      setNewNotification({
        message: '',
        channel: 'sms',
        templateId: '',
        scheduledFor: ''
      });
      setSelectedRecipients([]);
      
      fetchData();
      alert(`Notification queued for ${recipients.length} recipients!`);
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Failed to send notification');
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return <MessageSquare className="w-4 h-4 text-green-600" />;
      case 'sms': return <Phone className="w-4 h-4 text-blue-600" />;
      case 'email': return <Mail className="w-4 h-4 text-gray-600" />;
      default: return <MessageSquare className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
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
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          <p className="text-sm text-gray-600 mt-1">Send and manage notifications to staff</p>
        </div>
        <button
          onClick={() => setShowComposeModal(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Send className="h-4 w-4 mr-2" />
          Compose
        </button>
      </div>

      {/* Notifications History */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Notification History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipients</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {notifications.map((notification) => (
                <tr key={notification.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 line-clamp-2">
                      {notification.message}
                    </div>
                    {notification.templateId && (
                      <div className="text-xs text-gray-500 mt-1">
                        Template: {templates.find(t => t.id === notification.templateId)?.name}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getChannelIcon(notification.channel)}
                      <span className="ml-2 text-sm text-gray-900 capitalize">{notification.channel}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{notification.to.length} recipients</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(notification.status)}
                      <span className="ml-2 text-sm text-gray-900 capitalize">{notification.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {notification.sentAt ? 
                      new Date(notification.sentAt).toLocaleString() : 
                      new Date(notification.createdAt).toLocaleString()
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Compose Notification</h2>
              <button
                onClick={() => setShowComposeModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSendNotification} className="p-6 space-y-6">
              {/* Recipient Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
                <div className="flex space-x-4 mb-4">
                  {['individual', 'team', 'zone'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setRecipientType(type as any);
                        setSelectedRecipients([]);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        recipientType === type ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {recipientType === 'individual' && (
                    <div className="space-y-2">
                      {staff.filter(s => s.isActive).map((member) => (
                        <div key={member.id} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`staff-${member.id}`}
                            checked={selectedRecipients.includes(member.id!)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRecipients(prev => [...prev, member.id!]);
                              } else {
                                setSelectedRecipients(prev => prev.filter(id => id !== member.id));
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`staff-${member.id}`} className="ml-3 text-sm text-gray-700">
                            {member.name} ({member.role}) - {member.mobile}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}

                  {recipientType === 'team' && (
                    <div className="space-y-2">
                      {teams.map((team) => (
                        <div key={team.id} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`team-${team.id}`}
                            checked={selectedRecipients.includes(team.id!)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRecipients(prev => [...prev, team.id!]);
                              } else {
                                setSelectedRecipients(prev => prev.filter(id => id !== team.id));
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`team-${team.id}`} className="ml-3 text-sm text-gray-700">
                            {team.name} ({team.memberIds.length} members)
                          </label>
                        </div>
                      ))}
                    </div>
                  )}

                  {recipientType === 'zone' && (
                    <div className="space-y-2">
                      {['North', 'South', 'East', 'West', 'Central'].map((zone) => {
                        const zoneStaff = staff.filter(s => s.zoneId === zone);
                        return (
                          <div key={zone} className="flex items-center">
                            <input
                              type="checkbox"
                              id={`zone-${zone}`}
                              checked={selectedRecipients.includes(zone)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecipients(prev => [...prev, zone]);
                                } else {
                                  setSelectedRecipients(prev => prev.filter(id => id !== zone));
                                }
                              }}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <label htmlFor={`zone-${zone}`} className="ml-3 text-sm text-gray-700">
                              {zone} Zone ({zoneStaff.length} staff)
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Channel Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
                <div className="flex space-x-4">
                  {['sms', 'whatsapp', 'email'].map((channel) => (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => setNewNotification({ ...newNotification, channel: channel as any })}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium ${
                        newNotification.channel === channel ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {getChannelIcon(channel)}
                      <span className="capitalize">{channel}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template (Optional)</label>
                <select
                  value={newNotification.templateId}
                  onChange={(e) => {
                    const template = templates.find(t => t.id === e.target.value);
                    setNewNotification({
                      ...newNotification,
                      templateId: e.target.value,
                      message: template?.message || newNotification.message
                    });
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Custom Message</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newNotification.message}
                  onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={4}
                  placeholder="Enter your message"
                  required
                />
                <div className="text-xs text-gray-500 mt-1">
                  {newNotification.message.length}/160 characters
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={newNotification.scheduledFor}
                  onChange={(e) => setNewNotification({ ...newNotification, scheduledFor: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Leave empty to send immediately
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                <div className="text-sm text-gray-900 mb-2">{newNotification.message}</div>
                <div className="text-xs text-gray-500">
                  Will be sent to {selectedRecipients.length} {recipientType}(s) via {newNotification.channel}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Send className="w-4 h-4" />
                  <span>{newNotification.scheduledFor ? 'Schedule' : 'Send Now'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;