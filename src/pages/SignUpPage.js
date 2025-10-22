import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom'; // Import Link and useNavigate

const SignUpPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate(); // Hook for navigation

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      // Create user profile in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: email.split('@')[0], // Default display name
        photoURL: '', // Initialize photoURL
        online: false, // Initial online status
        last_active: null, // Initial last active time
        lastReadTimes: {} // Initial read times map
      });
      // Navigate to home page after successful signup
      navigate('/'); 
    } catch (error) {
      alert(`Sign up failed: ${error.message}`);
    }
  };

  const styles = {
    page: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)' },
    card: { background: 'var(--card-bg)', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '380px', textAlign: 'center' },
    title: { fontSize: '24px', fontWeight: 'bold', margin: '0 0 30px 0', color: 'var(--text-primary)' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' },
    input: { padding: '12px 15px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--background)' },
    button: { padding: '12px', fontSize: '15px', fontWeight: '500', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', transition: 'background 0.2s' },
    toggleText: { fontSize: '14px', color: 'var(--text-secondary)', marginTop: '20px' },
    toggleLink: { color: 'var(--primary)', textDecoration: 'none', fontWeight: '500' }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Create Your Account</h1>
        <form onSubmit={handleSignUp} style={styles.form}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required style={styles.input} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min. 6 characters)" required style={styles.input} />
          <button type="submit" style={styles.button} onMouseOver={(e) => e.currentTarget.style.background = 'var(--primary-dark)'} onMouseOut={(e) => e.currentTarget.style.background = 'var(--primary)'}>
            Sign Up
          </button>
        </form>
        <p style={styles.toggleText}>
          Already have an account?{' '}
          <Link to="/login" style={styles.toggleLink}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignUpPage;