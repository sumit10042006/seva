import React, { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '../../firebase/config';
import { X, Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { getCurrentUser } from '../../firebase/auth';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CSVRow {
  [key: string]: string;
}

interface ValidationError {
  row: number;
  field: string;
  error: string;
}

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'validation' | 'processing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validRows, setValidRows] = useState<CSVRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiredFields = {
    name: 'Name',
    mobile: 'Mobile',
    role: 'Role'
  };

  const optionalFields = {
    email: 'Email',
    team_name: 'Team Name',
    shift: 'Shift',
    address: 'Address'
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    // Check file size (max 10MB)
    if (uploadedFile.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    // Check file type
    const allowedTypes = ['.csv', '.xlsx'];
    const fileExtension = uploadedFile.name.toLowerCase().slice(uploadedFile.name.lastIndexOf('.'));
    if (!allowedTypes.includes(fileExtension)) {
      alert('Please upload a CSV or XLSX file');
      return;
    }

    setFile(uploadedFile);
    parseCSV(uploadedFile);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV must have at least a header row and one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: CSVRow = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      setHeaders(headers);
      setCsvData(rows);
      setStep('mapping');
    };
    reader.readAsText(file);
  };

  const handleColumnMapping = () => {
    // Validate that all required fields are mapped
    const missingFields = Object.keys(requiredFields).filter(field => !columnMapping[field]);
    if (missingFields.length > 0) {
      alert(`Please map the following required fields: ${missingFields.join(', ')}`);
      return;
    }

    validateData();
    setStep('validation');
  };

  const validateData = () => {
    const errors: ValidationError[] = [];
    const valid: CSVRow[] = [];

    csvData.forEach((row, index) => {
      const rowErrors: ValidationError[] = [];
      
      // Validate name
      const name = row[columnMapping.name]?.trim();
      if (!name) {
        rowErrors.push({ row: index + 1, field: 'name', error: 'Name is required' });
      } else if (name.length < 2) {
        rowErrors.push({ row: index + 1, field: 'name', error: 'Name must be at least 2 characters' });
      }

      // Validate mobile (E.164)
      const mobile = row[columnMapping.mobile]?.trim();
      const mobileRegex = /^(\+91)?[6-9]\d{9}$/;
      if (!mobile) {
        rowErrors.push({ row: index + 1, field: 'mobile', error: 'Mobile is required' });
      } else if (!mobileRegex.test(mobile)) {
        rowErrors.push({ row: index + 1, field: 'mobile', error: 'Invalid mobile format' });
      }

      // Validate role
      const role = row[columnMapping.role]?.trim().toLowerCase();
      const validRoles = ['admin', 'manager', 'supervisor', 'staff'];
      if (!role) {
        rowErrors.push({ row: index + 1, field: 'role', error: 'Role is required' });
      } else if (!validRoles.includes(role)) {
        rowErrors.push({ row: index + 1, field: 'role', error: 'Invalid role' });
      }

      // Validate email if provided
      const email = row[columnMapping.email]?.trim();
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          rowErrors.push({ row: index + 1, field: 'email', error: 'Invalid email format' });
        }
      }

      if (rowErrors.length === 0) {
        valid.push(row);
      } else {
        errors.push(...rowErrors);
      }
    });

    setValidationErrors(errors);
    setValidRows(valid);
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    setStep('processing');

    try {
      const currentUser = getCurrentUser();
      
      // Upload file to storage
      const fileRef = ref(storage, `bulk-uploads/${Date.now()}-${file?.name}`);
      const uploadResult = await uploadBytes(fileRef, file!);
      const fileUrl = await getDownloadURL(uploadResult.ref);

      // Create bulk upload record
      const bulkUploadDoc = await addDoc(collection(db, 'bulk-uploads'), {
        fileName: file?.name,
        fileUrl,
        totalRows: csvData.length,
        validRows: validRows.length,
        errorRows: validationErrors.length,
        columnMapping,
        status: 'processing',
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'unknown'
      });

      // Process valid rows
      const batch = validRows.map(row => ({
        name: row[columnMapping.name],
        mobile: row[columnMapping.mobile].startsWith('+91') ? 
          row[columnMapping.mobile] : `+91${row[columnMapping.mobile]}`,
        email: row[columnMapping.email] || '',
        role: row[columnMapping.role].toLowerCase(),
        teamIds: [],
        onDuty: false,
        shift: row[columnMapping.shift]?.toLowerCase() || 'red',
        address: row[columnMapping.address] || '',
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'unknown',
        isActive: true,
        lastSeenAt: serverTimestamp()
      }));

      // Add all staff members
      for (const staffData of batch) {
        await addDoc(collection(db, 'staff'), staffData);
      }

      // Update bulk upload status
      await updateDoc(doc(db, 'bulk-uploads', bulkUploadDoc.id), {
        status: 'completed',
        processedAt: serverTimestamp(),
        successCount: validRows.length
      });

      alert(`Successfully imported ${validRows.length} staff members!`);
      onSuccess();
      onClose();

    } catch (error) {
      console.error('Error processing bulk upload:', error);
      alert('Error processing upload. Please try again.');
      setStep('validation');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadErrorReport = () => {
    const errorReport = validationErrors.map(error => ({
      Row: error.row,
      Field: error.field,
      Error: error.error
    }));

    const csv = [
      Object.keys(errorReport[0]).join(','),
      ...errorReport.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'validation-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Bulk Upload Staff</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isProcessing}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              {['upload', 'mapping', 'validation', 'processing'].map((stepName, index) => (
                <div key={stepName} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === stepName ? 'bg-indigo-600 text-white' :
                    ['upload', 'mapping', 'validation'].indexOf(step) > index ? 'bg-green-600 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-700 capitalize">{stepName}</span>
                  {index < 3 && <div className="w-8 h-0.5 bg-gray-200 ml-4"></div>}
                </div>
              ))}
            </div>
          </div>

          {/* Upload Step */}
          {step === 'upload' && (
            <div className="text-center">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 hover:border-indigo-400 transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Staff CSV/XLSX</h3>
                <p className="text-gray-600 mb-4">
                  Required columns: Name, Mobile, Role<br />
                  Optional: Email, Team Name, Shift, Address
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
                >
                  Choose File
                </button>
                {file && (
                  <div className="mt-4 text-sm text-gray-600">
                    Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mapping Step */}
          {step === 'mapping' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Map Columns</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Required Fields</h4>
                  {Object.entries(requiredFields).map(([field, label]) => (
                    <div key={field} className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {label} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={columnMapping[field] || ''}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Select column...</option>
                        {headers.map(header => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Optional Fields</h4>
                  {Object.entries(optionalFields).map(([field, label]) => (
                    <div key={field} className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                      <select
                        value={columnMapping[field] || ''}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">Select column...</option>
                        {headers.map(header => (
                          <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-700 mb-3">Preview (First 10 rows)</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.values(requiredFields).concat(Object.values(optionalFields)).map(label => (
                          <th key={label} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {csvData.slice(0, 10).map((row, index) => (
                        <tr key={index}>
                          {Object.keys(requiredFields).concat(Object.keys(optionalFields)).map(field => (
                            <td key={field} className="px-4 py-2 text-sm text-gray-900">
                              {row[columnMapping[field]] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleColumnMapping}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Continue to Validation
                </button>
              </div>
            </div>
          )}

          {/* Validation Step */}
          {step === 'validation' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Validation Summary</h3>
                {validationErrors.length > 0 && (
                  <button
                    onClick={downloadErrorReport}
                    className="flex items-center space-x-2 text-red-600 hover:text-red-800"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Error Report</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-green-900">Valid Rows</h4>
                      <p className="text-green-700">{validRows.length} rows ready to import</p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-red-900">Invalid Rows</h4>
                      <p className="text-red-700">{validationErrors.length} errors found</p>
                    </div>
                  </div>
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-700 mb-3">Validation Errors</h4>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {validationErrors.map((error, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{error.row}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{error.field}</td>
                            <td className="px-4 py-2 text-sm text-red-600">{error.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={validRows.length === 0}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  Import {validRows.length} Valid Rows
                </button>
              </div>
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Upload</h3>
              <p className="text-gray-600">Please wait while we import your staff data...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};