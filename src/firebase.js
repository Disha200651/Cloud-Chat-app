import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database"; // <-- IMPORT RTDB

const firebaseConfig = {
  apiKey: "AIzaSyDm_rBmwgiUAE4yDmZ4Yq28wX9fZORopME",
  authDomain: "mycloudchatapp2025-7d60a.firebaseapp.com",
  projectId: "mycloudchatapp2025-7d60a",
  storageBucket: "mycloudchatapp2025-7d60a.firebasestorage.app",
  messagingSenderId: "164556682281",
  databaseURL: "https://mycloudchatapp2025-7d60a-default-rtdb.asia-southeast1.firebasedatabase.app/",
  appId: "1:164556682281:web:b9b869df7d576b3b261838",
  measurementId: "G-K60GFC64F0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services you ARE using
export const auth = getAuth(app);
export const db = getFirestore(app); // Firestore for messages, users, rooms
export const rtdb = getDatabase(app); // <-- EXPORT RTDB for presence