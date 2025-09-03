import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, Megaphone, Calendar, MapPin, User, Eye, Edit, Trash2, X, AlertTriangle } from 'lucide-react';
import { Ad } from '../../types/admin';
import { getCurrentUser } from '../../firebase/auth';

const AdsPage: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [showAdDetail, setShowAdDetail] = useState(false);

  const [newAd, setNewAd] = useState({
    title: '',
    type: 'announcement' as 'announcement' | 'sponsored' | 'emergency',
    description: '',
    location: '',
    validFrom: new Date().toISOString().slice(0, 16),
    validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    contact: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const adsSnapshot = await getDocs(collection(db, 'ads'));
      const adsData = adsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ad[];
      setAds(adsData);
    } catch (error) {
      console.error('Error fetching ads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const currentUser = getCurrentUser();
      
      await addDoc(collection(db, 'ads'), {
        ...newAd,
        validFrom: new Date(newAd.validFrom),
        validTo: new Date(newAd.validTo),
        status: newAd.type === 'sponsored' ? 'draft' : 'published',
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'unknown'
      });
      
      setShowCreateModal(false);
      setNewAd({
        title: '',
        type: 'announcement',
        description: '',
        location: '',
        validFrom: new Date().toISOString().slice(0, 16),
        validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        contact: ''
      });
      
      fetchData();
      alert('Ad created successfully!');
    } catch (error) {
      console.error('Error creating ad:', error);
      alert('Failed to create ad');
    }
  };

  const handleStatusUpdate = async (adId: string, newStatus: string) => {
    try {
      const currentUser = getCurrentUser();
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (newStatus === 'published') {
        updateData.approvedBy = currentUser?.uid;
      }

      await updateDoc(doc(db, 'ads', adId), updateData);
      fetchData();
      alert('Ad status updated successfully!');
    } catch (error) {
      console.error('Error updating ad status:', error);
      alert('Failed to update ad status');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'announcement': return <Megaphone className="w-4 h-4 text-blue-600" />;
      case 'sponsored': return <User className="w-4 h-4 text-green-600" />;
      case 'emergency': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Megaphone className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isExpired = (ad: Ad) => {
    return new Date(ad.validTo) < new Date();
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
          <h1 className="text-2xl font-bold text-gray-800">Ads & Announcements</h1>
          <p className="text-sm text-gray-600 mt-1">Manage public announcements and sponsored content</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Ad
        </button>
      </div>

      {/* Ads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ads.map((ad) => (
          <div key={ad.id} className={`bg-white rounded-lg shadow border-l-4 ${
            ad.type === 'emergency' ? 'border-red-500' :
            ad.type === 'sponsored' ? 'border-green-500' :
            'border-blue-500'
          }`}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(ad.type)}
                  <span className="text-sm font-medium text-gray-600 capitalize">{ad.type}</span>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(ad.status)}`}>
                  {ad.status}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">{ad.title}</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">{ad.description}</p>

              {ad.location && (
                <div className="flex items-center text-sm text-gray-500 mb-2">
                  <MapPin className="w-4 h-4 mr-1" />
                  {ad.location}
                </div>
              )}

              <div className="flex items-center text-sm text-gray-500 mb-4">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date(ad.validFrom).toLocaleDateString()} - {new Date(ad.validTo).toLocaleDateString()}
              </div>

              {isExpired(ad) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-4">
                  <span className="text-xs text-red-600 font-medium">Expired</span>
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedAd(ad);
                    setShowAdDetail(true);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 px-3 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  View Details
                </button>
                
                {ad.status === 'draft' && (
                  <button
                    onClick={() => handleStatusUpdate(ad.id!, 'published')}
                    className="bg-green-100 text-green-800 py-2 px-3 rounded-lg hover:bg-green-200 text-sm font-medium"
                  >
                    Publish
                  </button>
                )}
                
                {ad.status === 'published' && !isExpired(ad) && (
                  <button
                    onClick={() => handleStatusUpdate(ad.id!, 'expired')}
                    className="bg-red-100 text-red-800 py-2 px-3 rounded-lg hover:bg-red-200 text-sm font-medium"
                  >
                    Expire
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Ad Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Create New Ad</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateAd} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newAd.title}
                  onChange={(e) => setNewAd({ ...newAd, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ad title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <div className="flex space-x-4">
                  {['announcement', 'sponsored', 'emergency'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewAd({ ...newAd, type: type as any })}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium ${
                        newAd.type === type ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {getTypeIcon(type)}
                      <span className="capitalize">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newAd.description}
                  onChange={(e) => setNewAd({ ...newAd, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={4}
                  placeholder="Ad description"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location (Optional)</label>
                  <input
                    type="text"
                    value={newAd.location}
                    onChange={(e) => setNewAd({ ...newAd, location: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Specific location"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact</label>
                  <input
                    type="text"
                    value={newAd.contact}
                    onChange={(e) => setNewAd({ ...newAd, contact: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Contact information"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valid From</label>
                  <input
                    type="datetime-local"
                    value={newAd.validFrom}
                    onChange={(e) => setNewAd({ ...newAd, validFrom: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valid To</label>
                  <input
                    type="datetime-local"
                    value={newAd.validTo}
                    onChange={(e) => setNewAd({ ...newAd, validTo: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                  <span>Create Ad</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ad Detail Modal */}
      {showAdDetail && selectedAd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">{selectedAd.title}</h2>
              <button
                onClick={() => setShowAdDetail(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(selectedAd.type)}
                  <span className="text-sm font-medium text-gray-600 capitalize">{selectedAd.type}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(selectedAd.status)}`}>
                    {selectedAd.status}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                  <p className="text-sm text-gray-900">{selectedAd.description}</p>
                </div>

                {selectedAd.location && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Location</h4>
                    <p className="text-sm text-gray-900">{selectedAd.location}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Valid From</h4>
                    <p className="text-sm text-gray-900">{new Date(selectedAd.validFrom).toLocaleString()}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Valid To</h4>
                    <p className="text-sm text-gray-900">{new Date(selectedAd.validTo).toLocaleString()}</p>
                  </div>
                </div>

                {selectedAd.contact && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Contact</h4>
                    <p className="text-sm text-gray-900">{selectedAd.contact}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
                {selectedAd.status === 'draft' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedAd.id!, 'published')}
                    className="w-full bg-green-100 text-green-800 py-2 rounded-lg hover:bg-green-200 font-medium"
                  >
                    Publish Ad
                  </button>
                )}
                
                {selectedAd.status === 'published' && !isExpired(selectedAd) && (
                  <button
                    onClick={() => handleStatusUpdate(selectedAd.id!, 'expired')}
                    className="w-full bg-red-100 text-red-800 py-2 rounded-lg hover:bg-red-200 font-medium"
                  >
                    Expire Ad
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsPage;