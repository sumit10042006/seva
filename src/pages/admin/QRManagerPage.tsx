import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { QrCode, Download, Camera, CheckCircle, AlertTriangle, Plus, Eye } from 'lucide-react';
import { QRCode, Facility } from '../../types/admin';
import { getCurrentUser } from '../../firebase/auth';

const QRManagerPage: React.FC = () => {
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPlacementModal, setShowPlacementModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QRCode | null>(null);
  const [placementPhoto, setPlacementPhoto] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const qrSnapshot = await getDocs(collection(db, 'qrcodes'));
      const qrData = qrSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QRCode[];
      
      const facilitiesSnapshot = await getDocs(collection(db, 'facilities'));
      const facilitiesData = facilitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Facility[];
      
      setQrCodes(qrData);
      setFacilities(facilitiesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (selectedFacilities.length === 0) {
      alert('Please select facilities to generate QR codes for');
      return;
    }

    setIsGenerating(true);
    
    try {
      const currentUser = getCurrentUser();
      const generatedQRs = [];

      for (const facilityId of selectedFacilities) {
        const facility = facilities.find(f => f.id === facilityId);
        if (!facility) continue;

        // Generate QR code data
        const shortUrl = `https://seva.plus/qr/${facility.code}`;
        const qrData = {
          facilityId,
          type: 'public' as const,
          version: 1,
          shortUrl,
          createdAt: serverTimestamp(),
          isActive: true
        };

        const docRef = await addDoc(collection(db, 'qrcodes'), qrData);
        generatedQRs.push({ id: docRef.id, ...qrData });

        // Update facility with QR reference
        await updateDoc(doc(db, 'facilities', facilityId), {
          qrId: docRef.id,
          updatedAt: serverTimestamp()
        });
      }

      // Create download bundle (simulated)
      const bundle = {
        qrCodes: generatedQRs,
        generatedAt: new Date().toISOString(),
        generatedBy: currentUser?.uid
      };

      // In a real app, you'd generate actual QR code images
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-codes-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setSelectedFacilities([]);
      setShowGenerateModal(false);
      fetchData();
      alert(`Generated ${generatedQRs.length} QR codes successfully!`);
    } catch (error) {
      console.error('Error generating QR codes:', error);
      alert('Failed to generate QR codes');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlacementUpdate = async (qrId: string, status: 'printed' | 'placed' | 'verified') => {
    try {
      const currentUser = getCurrentUser();
      const updateData: any = {
        updatedAt: serverTimestamp()
      };

      if (status === 'printed') {
        updateData.printedBy = currentUser?.uid;
      } else if (status === 'placed') {
        updateData.placedAt = serverTimestamp();
        if (placementPhoto) {
          const photoRef = ref(storage, `qr-placements/${qrId}-${Date.now()}`);
          await uploadBytes(photoRef, placementPhoto);
          updateData.placementPhotoUrl = await getDownloadURL(photoRef);
        }
      } else if (status === 'verified') {
        updateData.verifiedBy = currentUser?.uid;
        updateData.verifiedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'qrcodes', qrId), updateData);

      // Create audit record
      await addDoc(collection(db, 'qrcode-events'), {
        qrId,
        action: status,
        performedBy: currentUser?.uid,
        timestamp: serverTimestamp(),
        metadata: updateData
      });

      setShowPlacementModal(false);
      setSelectedQR(null);
      setPlacementPhoto(null);
      fetchData();
      alert(`QR code marked as ${status} successfully!`);
    } catch (error) {
      console.error('Error updating placement:', error);
      alert('Failed to update placement status');
    }
  };

  const getPlacementStatus = (qr: QRCode) => {
    if (qr.verifiedBy) return { status: 'verified', color: 'bg-green-100 text-green-800' };
    if (qr.placedAt) return { status: 'placed', color: 'bg-blue-100 text-blue-800' };
    if (qr.printedBy) return { status: 'printed', color: 'bg-yellow-100 text-yellow-800' };
    return { status: 'generated', color: 'bg-gray-100 text-gray-800' };
  };

  const facilitiesWithoutQR = facilities.filter(f => !f.qrId);

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
          <h1 className="text-2xl font-bold text-gray-800">QR Code Manager</h1>
          <p className="text-sm text-gray-600 mt-1">Generate and manage QR codes for facilities</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <QrCode className="h-4 w-4 mr-2" />
          Generate QR Codes
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <QrCode className="h-8 w-8 text-indigo-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total QR Codes</p>
              <p className="text-2xl font-semibold text-gray-900">{qrCodes.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Verified</p>
              <p className="text-2xl font-semibold text-gray-900">
                {qrCodes.filter(qr => qr.verifiedBy).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Camera className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Placed</p>
              <p className="text-2xl font-semibold text-gray-900">
                {qrCodes.filter(qr => qr.placedAt).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-semibold text-gray-900">
                {facilitiesWithoutQR.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* QR Codes Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {qrCodes.map((qr) => {
                const facility = facilities.find(f => f.id === qr.facilityId);
                const placementStatus = getPlacementStatus(qr);
                
                return (
                  <tr key={qr.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {facility?.code || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 capitalize">{qr.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">v{qr.version}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${placementStatus.color}`}>
                        {placementStatus.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(qr.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => window.open(qr.shortUrl, '_blank')}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedQR(qr);
                            setShowPlacementModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Update Placement"
                        >
                          <Camera className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            // Download QR code (simulated)
                            const link = document.createElement('a');
                            link.href = qr.shortUrl;
                            link.download = `qr-${facility?.code || qr.id}.png`;
                            link.click();
                          }}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate QR Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Generate QR Codes</h2>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Select Facilities ({facilitiesWithoutQR.length} without QR codes)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {facilitiesWithoutQR.map((facility) => (
                  <div key={facility.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`facility-${facility.id}`}
                          checked={selectedFacilities.includes(facility.id!)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFacilities(prev => [...prev, facility.id!]);
                            } else {
                              setSelectedFacilities(prev => prev.filter(id => id !== facility.id));
                            }
                          }}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`facility-${facility.id}`} className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{facility.code}</div>
                          <div className="text-xs text-gray-500">{facility.type} • {facility.zoneId}</div>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {selectedFacilities.length} facilities selected
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setSelectedFacilities(facilitiesWithoutQR.map(f => f.id!))}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedFacilities([])}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleBulkGenerate}
                    disabled={selectedFacilities.length === 0 || isGenerating}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isGenerating ? 'Generating...' : `Generate ${selectedFacilities.length} QR Codes`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Placement Modal */}
      {showPlacementModal && selectedQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Update QR Placement</h2>
              <button
                onClick={() => setShowPlacementModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="w-32 h-32 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  {facilities.find(f => f.id === selectedQR.facilityId)?.code}
                </h3>
                <p className="text-sm text-gray-600">{selectedQR.shortUrl}</p>
              </div>

              {/* Placement Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Placement Photo (Required for placement verification)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPlacementPhoto(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handlePlacementUpdate(selectedQR.id!, 'printed')}
                  className="w-full bg-yellow-100 text-yellow-800 py-3 rounded-lg hover:bg-yellow-200 font-medium"
                >
                  Mark as Printed
                </button>
                <button
                  onClick={() => handlePlacementUpdate(selectedQR.id!, 'placed')}
                  disabled={!placementPhoto}
                  className="w-full bg-blue-100 text-blue-800 py-3 rounded-lg hover:bg-blue-200 font-medium disabled:opacity-50"
                >
                  Mark as Placed (Photo Required)
                </button>
                <button
                  onClick={() => handlePlacementUpdate(selectedQR.id!, 'verified')}
                  className="w-full bg-green-100 text-green-800 py-3 rounded-lg hover:bg-green-200 font-medium"
                >
                  Mark as Verified
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRManagerPage;