export interface StaffMember {
  id?: string;
  name: string;
  mobile: string; // E.164 format
  email?: string;
  role: 'admin' | 'manager' | 'staff' | 'supervisor';
  teamIds: string[];
  onDuty: boolean;
  shift: 'red' | 'orange' | 'green'; // morning/afternoon/night
  lastSeenAt: Date | any;
  address?: string;
  createdAt: Date | any;
  createdBy: string;
  isActive: boolean;
  zoneId?: string;
}

export interface Team {
  id?: string;
  name: string;
  description: string;
  leaderId: string;
  memberIds: string[];
  zoneIds: string[];
  defaultShift: 'red' | 'orange' | 'green';
  capacity: number;
  createdAt: Date | any;
  isActive: boolean;
}

export interface Zone {
  id?: string;
  name: string;
  center: {
    lat: number;
    lng: number;
  };
  polygon?: Array<{lat: number; lng: number}>;
  createdAt: Date | any;
  isActive: boolean;
}

export interface Facility {
  id?: string;
  code: string;
  type: 'toilet' | 'bin' | 'water' | 'helpdesk';
  zoneId: string;
  lat: number;
  lng: number;
  capacity?: number;
  status: 'available' | 'occupied' | 'maintenance' | 'full' | 'out-of-order';
  lastUpdated: Date | any;
  qrId?: string;
  photos: string[];
  createdAt: Date | any;
  assignedTaskId?: string;
}

export interface QRCode {
  id?: string;
  facilityId: string;
  type: 'public' | 'staff';
  version: number;
  shortUrl: string;
  pngUrl?: string;
  svgUrl?: string;
  printedBy?: string;
  placedAt?: Date | any;
  verifiedBy?: string;
  createdAt: Date | any;
  isActive: boolean;
}

export interface Task {
  id?: string;
  title: string;
  description: string;
  facilityId?: string;
  zoneId: string;
  assignedTo: {
    type: 'staff' | 'team';
    id: string;
  };
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed' | 'verified';
  createdAt: Date | any;
  createdBy: string;
  dueAt: Date | any;
  slaMinutes: number;
  photosBefore: string[];
  photosAfter: string[];
  startedAt?: Date | any;
  completedAt?: Date | any;
  verifiedAt?: Date | any;
}

export interface Issue {
  id?: string;
  facilityId?: string;
  zoneId: string;
  category: 'cleanliness' | 'maintenance' | 'safety' | 'accessibility' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  photos: string[];
  reportedAt: Date | any;
  reportedBy: {
    anonymous: boolean;
    contact?: string;
    name?: string;
  };
  status: 'open' | 'assigned' | 'in-progress' | 'resolved' | 'closed';
  assignedTo?: {
    type: 'staff' | 'team';
    id: string;
  };
  resolvedAt?: Date | any;
}

export interface Shift {
  id?: string;
  zoneId: string;
  name: string;
  startTime: string; // HH:mm format
  endTime: string;
  assignedStaffIds: string[];
  requiredStaff: number;
  createdAt: Date | any;
  date: string; // YYYY-MM-DD
}

export interface Headcount {
  id?: string;
  zoneId: string;
  count: number;
  source: 'manual' | 'api' | 'estimated';
  confidence: number; // 0-1
  timestamp: Date | any;
}

export interface Notification {
  id?: string;
  to: string[]; // phone numbers or staff IDs
  channel: 'whatsapp' | 'sms' | 'email';
  message: string;
  templateId?: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  createdAt: Date | any;
  sentAt?: Date | any;
  providerResponse?: any;
}

export interface StaffAudit {
  id?: string;
  staffId: string;
  action: 'create' | 'update' | 'deactivate' | 'activate';
  changes: Record<string, any>;
  performedBy: string;
  timestamp: Date | any;
  ipAddress?: string;
}

export interface Ad {
  id?: string;
  title: string;
  type: 'announcement' | 'sponsored' | 'emergency';
  description: string;
  location?: string;
  validFrom: Date | any;
  validTo: Date | any;
  contact?: string;
  status: 'draft' | 'published' | 'expired';
  approvedBy?: string;
  createdAt: Date | any;
  createdBy: string;
}

export interface BulkUpload {
  id?: string;
  fileName: string;
  fileUrl: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  columnMapping: Record<string, string>;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date | any;
  createdBy: string;
  processedAt?: Date | any;
  successCount?: number;
  errorFileUrl?: string;
}

export interface CoverageData {
  zoneId: string;
  requiredStaff: number;
  assignedStaff: number;
  delta: number;
  status: 'adequate' | 'understaffed' | 'overstaffed';
  lastUpdated: Date | any;
}