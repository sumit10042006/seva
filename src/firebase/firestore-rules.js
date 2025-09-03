// Firestore Security Rules for Seva+ Admin Dashboard
// Copy these rules to your Firebase Console > Firestore Database > Rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Staff collection - Admin only
    match /staff/{staffId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role in ['admin', 'manager'];
    }
    
    // Teams collection - Admin and Managers
    match /teams/{teamId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role in ['admin', 'manager'];
    }
    
    // Tasks collection - All authenticated users can read, Admin/Manager can write
    match /tasks/{taskId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role in ['admin', 'manager', 'supervisor'];
    }
    
    // Issues collection - All authenticated users
    match /issues/{issueId} {
      allow read, write: if request.auth != null;
    }
    
    // Facilities collection - All authenticated users can read, Admin/Manager can write
    match /facilities/{facilityId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role in ['admin', 'manager'];
    }
    
    // Notifications collection - Admin and Managers
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role in ['admin', 'manager'];
    }
    
    // Ads collection - Admin and Managers
    match /ads/{adId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role in ['admin', 'manager'];
    }
    
    // Shifts collection - Admin and Managers
    match /shifts/{shiftId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role in ['admin', 'manager'];
    }
    
    // Headcounts collection - All authenticated users
    match /headcounts/{headcountId} {
      allow read, write: if request.auth != null;
    }
    
    // Audit trails - Read only for admins
    match /staff-audit/{auditId} {
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin';
      allow create: if request.auth != null;
    }
    
    // Bulk uploads - Admin only
    match /bulk-uploads/{uploadId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role in ['admin', 'manager'];
    }
    
    // Admin users collection
    match /admins/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin';
    }
  }
}