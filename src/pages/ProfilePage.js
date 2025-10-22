import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore'; // Added getDoc
import { db, auth } from '../firebase';
import Navbar from '../components/Navbar'; // Assuming Navbar component exists
import { Navigate } from 'react-router-dom'; // Import Navigate for redirect

// --- CLOUDINARY CONFIG (Ensure these match your settings) ---
const CLOUDINARY_CLOUD_NAME = "de3olzxvq";
const CLOUDINARY_UPLOAD_PRESET = "izx1ajle"; // Ensure this preset name is correct

const ProfilePage = () => {
  const user = auth.currentUser;
  const [displayName, setDisplayName] = useState(''); // Initialize empty
  const [photoURL, setPhotoURL] = useState(''); // Initialize empty
  const [uploading, setUploading] = useState(false); // Used for button state
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Fetch initial profile data from Firestore
  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      getDoc(userDocRef).then((docSnap) => { // Use getDoc
        if (docSnap.exists()) {
          setDisplayName(docSnap.data().displayName || ''); // Set fetched name
          setPhotoURL(docSnap.data().photoURL || ''); // Set fetched avatar URL
        } else {
          // If no profile doc yet, use email as placeholder name
          setDisplayName(user.email || '');
          setPhotoURL('');
        }
        setLoadingProfile(false);
      }).catch(error => {
        console.error("Error fetching user profile:", error);
        setLoadingProfile(false);
      });
    } else {
      setLoadingProfile(false); // No user, stop loading
    }
  }, [user]); // Re-run if user object changes

  // Handle saving the updated display name
  const handleNameUpdate = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || !user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userDocRef, { displayName: displayName.trim() });
      alert('Display name updated successfully!');
    } catch (error) {
      console.error("Error updating profile:", error);
      alert('Failed to update display name.');
    }
  };

  // Handle uploading a new avatar image
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    setUploading(true); // Uses setUploading
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, {
          method: 'POST',
          body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        const newPhotoURL = data.secure_url;
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { photoURL: newPhotoURL }); // Update Firestore
        setPhotoURL(newPhotoURL); // Update local state for immediate feedback
        alert('Profile picture updated!');
      } else {
        throw new Error(data.error.message);
      }
    } catch (error) {
      console.error("Cloudinary Upload Error:", error);
      alert(`Avatar upload failed: ${error.message}`);
    } finally {
      setUploading(false); // Uses setUploading
    }
  };

  // Styles ARE used in the JSX below
  const styles = {
    pageLayout: { display: 'flex', height: '100vh', background: 'var(--background)' },
    content: { flex: 1, padding: '40px', maxWidth: '600px', margin: '40px auto', background: 'var(--card-bg)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'},
    title: { marginBottom: '30px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', fontSize: '24px', fontWeight: 'bold' },
    form: { display: 'flex', flexDirection: 'column', gap: '25px' }, // Increased gap
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' }, // Increased gap
    label: { fontWeight: '500', fontSize: '14px', color: 'var(--text-secondary)' },
    input: { padding: '12px 15px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '15px' }, // Adjusted padding/fontSize
    button: { padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '15px', transition: 'background 0.2s' },
    disabledButton: { background: '#9ca3af', cursor: 'not-allowed' },
    avatarPreview: { width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', marginBottom: '15px', border: '3px solid var(--border-color)', background: '#eee' }, // Larger avatar, added background
    avatarLabel: { ...{/* Copy relevant styles from button or label if needed, making it look clickable */}, fontWeight: '500', color: 'var(--primary)', cursor: 'pointer', fontSize: '14px', textAlign: 'center' }
  };

  if (loadingProfile) return <div>Loading profile...</div>;
  if (!user) return <Navigate to="/login" replace />; // Use Navigate component

  return (
    <div style={styles.pageLayout}>
      <Navbar />
      <div style={styles.content}>
        <h1 style={styles.title}>Your Profile</h1>

        {/* Avatar Display and Upload */}
        <div style={{ ...styles.inputGroup, alignItems: 'center', marginBottom: '30px' }}>
            <img
              // Use state photoURL, provide fallback using ui-avatars API
              src={photoURL || `https://ui-avatars.com/api/?name=${(displayName || user.email || 'User').replace(/\s+/g, '+')}&background=random&color=fff&size=100`}
              alt="Profile Avatar"
              style={styles.avatarPreview}
            />
            {/* Make the label visually distinct and act as the button */}
            <label htmlFor="avatar" style={styles.avatarLabel}>
              {uploading ? 'Uploading...' : 'Change Profile Picture'}
            </label>
            <input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }} // Hide the default file input visually
              disabled={uploading} // Use uploading state
            />
        </div>

        {/* Display Name Form */}
        <form onSubmit={handleNameUpdate} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="displayName" style={styles.label}>Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName} // Use state displayName
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you appear in chat"
              style={styles.input}
              required
            />
          </div>
          <button
            type="submit"
            // Apply disabled style conditionally
            style={{...styles.button, ...(uploading ? styles.disabledButton : {})}}
            disabled={uploading} // Use uploading state
            // Add hover effects
            onMouseOver={(e) => { if (!uploading) e.currentTarget.style.background = 'var(--primary-dark)'; }}
            onMouseOut={(e) => { if (!uploading) e.currentTarget.style.background = 'var(--primary)'; }}
          >
            Save Name
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;