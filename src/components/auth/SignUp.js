import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from '../../firebase';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: email.split('@')[0],
      });
    } catch (error) {
      alert(`Sign up failed: ${error.message}`);
    }
  };

  const styles = {
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    input: { padding: '12px 15px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--background)' },
    button: { padding: '12px', fontSize: '15px', fontWeight: '500', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', transition: 'background 0.2s' }
  };

  return (
    <form onSubmit={handleSignUp} style={styles.form}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required style={styles.input} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required style={styles.input} />
      <button type="submit" style={styles.button} onMouseOver={(e) => e.currentTarget.style.background = 'var(--primary-dark)'} onMouseOut={(e) => e.currentTarget.style.background = 'var(--primary)'}>
        Sign Up
      </button>
    </form>
  );
};

export default SignUp;