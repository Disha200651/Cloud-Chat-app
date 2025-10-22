import { useEffect } from 'react';
import { auth, rtdb, db } from '../firebase';
import { ref, onValue, set, onDisconnect, remove } from "firebase/database";
// 'updateDoc' removed from import as it's not used
import { doc, serverTimestamp, setDoc } from "firebase/firestore"; 

const PresenceManager = () => {
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      // console.log("PresenceManager Effect: No user, skipping setup.");
      return; 
    }
    // console.log(`PresenceManager Effect: Setting up for user ${user.uid}`);

    const userStatusDocRef = doc(db, 'users', user.uid);
    const userStatusRtdbRef = ref(rtdb, `/status/${user.uid}`);
    const connectedRef = ref(rtdb, '.info/connected');
    let unsubscribeConnected;

    unsubscribeConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // console.log(`PresenceManager: RTDB connection confirmed for ${user.uid}. Setting online status.`);
        set(userStatusRtdbRef, true);
        setDoc(userStatusDocRef, {
            online: true,
            last_active: serverTimestamp(),
        }, { merge: true }).catch(error => console.error("Error setting initial Firestore status:", error));

        onDisconnect(userStatusRtdbRef).set(false).then(() => {
          return setDoc(userStatusDocRef, {
              online: false,
              last_active: serverTimestamp(),
          }, { merge: true });
        }).catch(error => console.error("Error setting onDisconnect status:", error));
      }
    }, (error) => {
        console.error("Error listening to RTDB connection status:", error);
    });

    return () => {
      // console.log(`PresenceManager Cleanup: Running for user ${user.uid}`);
      if (unsubscribeConnected) {
        unsubscribeConnected();
      }
      remove(userStatusRtdbRef).catch(err => {/* Ignore potential errors on cleanup */});
      onDisconnect(userStatusRtdbRef).cancel().catch(err => {/* Ignore potential errors on cleanup */});
    };
  }, [user]);

  return null;
};

export default PresenceManager;