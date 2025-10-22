import React, { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function TestSignup() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function runTest() {
      const email = `test+${Date.now()}@example.com`;
      const password = 'password123';
      try {
        const uc = await createUserWithEmailAndPassword(auth, email, password);
        const user = uc.user;
        await setDoc(doc(db, 'users', user.uid), { uid: user.uid, email: user.email });
        console.log('Test signup success', user.uid, email);
        setResult({ success: true, uid: user.uid, email });
      } catch (err) {
        console.error('Test signup error', err);
        setResult({ success: false, code: err.code, message: err.message });
      }
    }

    runTest();
  }, []);

  return (
    <div style={{padding:20}}>
      <h2>Test Signup</h2>
      {result === null && <p>Running test signup...</p>}
      {result && result.success && (
        <div>
          <p>Success! Created user: {result.email}</p>
          <p>UID: {result.uid}</p>
        </div>
      )}
      {result && !result.success && (
        <div>
          <p style={{color:'crimson'}}>Test signup failed</p>
          <p>Code: {result.code}</p>
          <p>Message: {result.message}</p>
        </div>
      )}
      <p>Check the browser console for full error details.</p>
    </div>
  );
}
