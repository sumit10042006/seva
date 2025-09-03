import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { X, User, Plus, Save } from 'lucide-react';
import { StaffMember, Team } from '../../types/admin';
import { getCurrentUser } from '../../firebase/auth';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingStaff?: StaffMember | null;
}

export const AddStaffModal: React.FC<AddStaffModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  editingStaff 
}) => {
  const [formData, setFormData] = useState<Omit<StaffMember, 'id'>>({
    name: '',
    mobile: '',
    email: '',
    role: 'staff',
    teamIds: [],
    onDuty: false,
    shift: 'red',
    lastSeenAt: new Date(),
    createdAt: new Date(),
    createdBy: '',
    isActive: true
  });
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      fetchTeams();
      if (editingStaff) {
        setFormData({
          name: editingStaff.name,
          mobile: editingStaff.mobile,
          email: editingStaff.email || '',
          role: editingStaff.role,
          teamIds: editingStaff.teamIds || [],
          onDuty: editingStaff.onDuty,
          shift: editingStaff.shift,
          lastSeenAt: editingStaff.lastSeenAt,
          createdAt: editingStaff.createdAt,
          createdBy: editingStaff.createdBy,
          isActive: editingStaff.isActive,
          address: editingStaff.address,
          zoneId: editingStaff.zoneId
        });
      } else {
        // Reset form for new staff
        setFormData({
          name: '',
          mobile: '',
          email: '',
          role: 'staff',
          teamIds: [],
          onDuty: false,
          shift: 'red',
          lastSeenAt: new Date(),
          createdAt: new Date(),
          createdBy: '',
          isActive: true
        });
      }
    }
  }, [isOpen, editingStaff]);

  const fetchTeams = async () => {
    try {
      const teamsSnapshot = await getDocs(collection(db, 'teams'));
      const teamsData = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Team[];
      setTeams(teamsData);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Mobile validation (E.164 format)
    const mobileRegex = /^\+91[6-9]\d{9}$/;
    if (!formData.mobile.trim()) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!mobileRegex.test(formData.mobile)) {
      newErrors.mobile = 'Mobile must be in E.164 format (+91XXXXXXXXXX)';
    }

    // Email validation (optional but if provided must be valid)
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
      
      // Email suggestion for common typos
      if (formData.email.includes('gmail.con')) {
        newErrors.email = 'Did you mean gmail.com?';
      }
    }

    // Role validation
    if (!formData.role) {
      newErrors.role = 'Role is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const currentUser = getCurrentUser();
      
      const staffData = {
        ...formData,
        mobile: formData.mobile.startsWith('+91') ? formData.mobile : `+91${formData.mobile}`,
        createdAt: editingStaff ? formData.createdAt : serverTimestamp(),
        createdBy: editingStaff ? formData.createdBy : (currentUser?.uid || 'unknown'),
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (editingStaff && editingStaff.id) {
        // Update existing staff
        await updateDoc(doc(db, 'staff', editingStaff.id), staffData);
        
        // Create audit record for update
        await addDoc(collection(db, 'staff-audit'), {
          staffId: editingStaff.id,
          action: 'update',
          changes: staffData,
          performedBy: currentUser?.uid || 'unknown',
          timestamp: serverTimestamp()
        });
      } else {
        // Create new staff
        const docRef = await addDoc(collection(db, 'staff'), staffData);
        
        // Create audit record for creation
        await addDoc(collection(db, 'staff-audit'), {
          staffId: docRef.id,
          action: 'create',
          changes: staffData,
          performedBy: currentUser?.uid || 'unknown',
          timestamp: serverTimestamp()
        });
      }

      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        name: '',
        mobile: '',
        email: '',
        role: 'staff',
        teamIds: [],
        onDuty: false,
        shift: 'red',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        createdBy: '',
        isActive: true
      });
      setErrors({});
      
    } catch (error) {
      console.error('Error saving staff:', error);
      alert('Failed to save staff member. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length <= 10) {
      setFormData({ ...formData, mobile: value });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter full name"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Mobile */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                +91
              </span>
              <input
                type="tel"
                value={formData.mobile.replace('+91', '')}
                onChange={handleMobileChange}
                className={`flex-1 px-4 py-3 border rounded-r-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  errors.mobile ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="9876543210"
                maxLength={10}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Format: +91XXXXXXXXXX</p>
            {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address (Optional)
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                errors.email ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="john@example.com"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>

          {/* Role and Shift */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  errors.role ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select Role</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="supervisor">Supervisor</option>
                <option value="staff">Staff</option>
              </select>
              {errors.role && <p className="mt-1 text-sm text-red-600">{errors.role}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift
              </label>
              <select
                value={formData.shift}
                onChange={(e) => setFormData({ ...formData, shift: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="red">Red (Morning)</option>
                <option value="orange">Orange (Afternoon)</option>
                <option value="green">Green (Night)</option>
              </select>
            </div>
          </div>

          {/* Teams */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign to Teams
            </label>
            <div className="grid grid-cols-2 gap-3 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center">
                  <input
                    id={`team-${team.id}`}
                    type="checkbox"
                    checked={formData.teamIds.includes(team.id!)}
                    onChange={(e) => {
                      const teamIds = e.target.checked
                        ? [...formData.teamIds, team.id!]
                        : formData.teamIds.filter(id => id !== team.id);
                      setFormData({ ...formData, teamIds });
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor={`team-${team.id}`} className="ml-2 text-sm text-gray-700">
                    {team.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address (Optional)
            </label>
            <textarea
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
              placeholder="Enter address"
            />
          </div>

          {/* On Duty Status */}
          <div className="flex items-center">
            <input
              id="onDuty"
              type="checkbox"
              checked={formData.onDuty}
              onChange={(e) => setFormData({ ...formData, onDuty: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="onDuty" className="ml-2 text-sm text-gray-700">
              Currently on duty
            </label>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {editingStaff ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isSubmitting ? 'Saving...' : editingStaff ? 'Update Staff' : 'Add Staff Member'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};