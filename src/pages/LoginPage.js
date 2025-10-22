import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Link } from 'react-router-dom'; // Import Link for navigation

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, email, password)
      .catch((error) => alert(error.message));
  };

  const styles = {
    page: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)' },
    card: { background: 'var(--card-bg)', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '380px', textAlign: 'center' }, // Added textAlign center
    title: { fontSize: '24px', fontWeight: 'bold', margin: '0 0 30px 0', color: 'var(--text-primary)' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }, // Reset textAlign for form
    input: { padding: '12px 15px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--background)' },
    button: { padding: '12px', fontSize: '15px', fontWeight: '500', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', transition: 'background 0.2s' },
    toggleText: { fontSize: '14px', color: 'var(--text-secondary)', marginTop: '20px' },
    toggleLink: { color: 'var(--primary)', textDecoration: 'none', fontWeight: '500' } // Use textDecoration none for Link
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Welcome Back!</h1>
        <form onSubmit={handleLogin} style={styles.form}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required style={styles.input} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required style={styles.input} />
          <button type="submit" style={styles.button} onMouseOver={(e) => e.currentTarget.style.background = 'var(--primary-dark)'} onMouseOut={(e) => e.currentTarget.style.background = 'var(--primary)'}>
            Login {/* Changed from Sign In */}
          </button>
        </form>
        <p style={styles.toggleText}>
          Don't have an account?{' '}
          <Link to="/signup" style={styles.toggleLink}>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;