import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

// Initialize sample data for development
export const initializeSampleData = async () => {
  try {
    // Sample staff data
    const sampleStaff = [
      {
        name: 'Rajesh Kumar',
        mobile: '+919876543210',
        email: 'rajesh@seva.com',
        role: 'manager',
        teamIds: [],
        onDuty: true,
        shift: 'red',
        zoneId: 'North',
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: 'system',
        lastSeenAt: serverTimestamp()
      },
      {
        name: 'Priya Sharma',
        mobile: '+919876543211',
        email: 'priya@seva.com',
        role: 'supervisor',
        teamIds: [],
        onDuty: false,
        shift: 'orange',
        zoneId: 'South',
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: 'system',
        lastSeenAt: serverTimestamp()
      },
      {
        name: 'Amit Singh',
        mobile: '+919876543212',
        email: 'amit@seva.com',
        role: 'staff',
        teamIds: [],
        onDuty: true,
        shift: 'green',
        zoneId: 'East',
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: 'system',
        lastSeenAt: serverTimestamp()
      }
    ];

    // Sample teams data
    const sampleTeams = [
      {
        name: 'Sanitation Team Alpha',
        description: 'Primary sanitation team for North zone',
        leaderId: '',
        memberIds: [],
        zoneIds: ['North'],
        defaultShift: 'red',
        capacity: 15,
        isActive: true,
        createdAt: serverTimestamp()
      },
      {
        name: 'Maintenance Team Beta',
        description: 'Facility maintenance and repair team',
        leaderId: '',
        memberIds: [],
        zoneIds: ['South', 'Central'],
        defaultShift: 'orange',
        capacity: 10,
        isActive: true,
        createdAt: serverTimestamp()
      }
    ];

    // Sample facilities data
    const sampleFacilities = [
      {
        code: 'T001',
        type: 'toilet',
        zoneId: 'North',
        lat: 25.3176,
        lng: 83.0131,
        capacity: 20,
        status: 'available',
        photos: [],
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      {
        code: 'W001',
        type: 'water',
        zoneId: 'North',
        lat: 25.3180,
        lng: 83.0135,
        capacity: 50,
        status: 'available',
        photos: [],
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      {
        code: 'B001',
        type: 'bin',
        zoneId: 'South',
        lat: 25.3170,
        lng: 83.0125,
        capacity: 100,
        status: 'full',
        photos: [],
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp()
      }
    ];

    // Sample tasks data
    const sampleTasks = [
      {
        title: 'Clean Toilet T001',
        description: 'Regular cleaning and maintenance of toilet facility T001',
        facilityId: '',
        zoneId: 'North',
        assignedTo: { type: 'team', id: '' },
        priority: 'medium',
        status: 'pending',
        createdAt: serverTimestamp(),
        createdBy: 'system',
        dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        slaMinutes: 120,
        photosBefore: [],
        photosAfter: []
      },
      {
        title: 'Empty Bin B001',
        description: 'Bin is full and needs immediate emptying',
        facilityId: '',
        zoneId: 'South',
        assignedTo: { type: 'team', id: '' },
        priority: 'high',
        status: 'in-progress',
        createdAt: serverTimestamp(),
        createdBy: 'system',
        dueAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
        slaMinutes: 60,
        photosBefore: [],
        photosAfter: []
      }
    ];

    // Sample issues data
    const sampleIssues = [
      {
        facilityId: '',
        zoneId: 'North',
        category: 'cleanliness',
        severity: 'medium',
        description: 'Toilet area needs deep cleaning due to heavy usage',
        photos: [],
        reportedAt: serverTimestamp(),
        reportedBy: { anonymous: false, contact: '+919876543213', name: 'Visitor' },
        status: 'open'
      },
      {
        facilityId: '',
        zoneId: 'East',
        category: 'maintenance',
        severity: 'high',
        description: 'Water tap is not working properly',
        photos: [],
        reportedAt: serverTimestamp(),
        reportedBy: { anonymous: true },
        status: 'assigned'
      }
    ];

    // Add sample data to collections
    console.log('Initializing sample data...');
    
    for (const staffData of sampleStaff) {
      await addDoc(collection(db, 'staff'), staffData);
    }
    
    for (const teamData of sampleTeams) {
      await addDoc(collection(db, 'teams'), teamData);
    }
    
    for (const facilityData of sampleFacilities) {
      await addDoc(collection(db, 'facilities'), facilityData);
    }
    
    for (const taskData of sampleTasks) {
      await addDoc(collection(db, 'tasks'), taskData);
    }
    
    for (const issueData of sampleIssues) {
      await addDoc(collection(db, 'issues'), issueData);
    }

    console.log('Sample data initialized successfully!');
    return true;
  } catch (error) {
    console.error('Error initializing sample data:', error);
    return false;
  }
};