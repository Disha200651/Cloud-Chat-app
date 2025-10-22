import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
// Ensure all necessary imports are included
import {
  collection, onSnapshot, doc, setDoc, serverTimestamp,
  query, orderBy, limit, where, getDocs
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate, useParams } from 'react-router-dom';

const RoomList = () => {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [userProfile, setUserProfile] = useState({ displayName: '', photoURL: '', lastReadTimes: {} });
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadStatus, setUnreadStatus] = useState({}); // { roomId: boolean } for general unread
  const [mentionStatus, setMentionStatus] = useState({}); // { roomId: boolean } for mentions
  const [lastMessageTimes, setLastMessageTimes] = useState({}); // { roomId: { timestamp: Timestamp, senderUid: string } | null }
  const user = auth.currentUser;
  const navigate = useNavigate();
  const { roomId: activeRoomId } = useParams();

  // Fetch rooms list
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'chat-rooms'), (snapshot) => {
      const fetchedRooms = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data()?.name || doc.id,
          ...doc.data()
      }));
      setRooms(fetchedRooms);
    });
    return () => unsubscribe();
  }, []);

  // Fetch user profile (including lastReadTimes)
  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => { // Listen for real-time updates
        if (docSnap.exists()) {
          setUserProfile({
            displayName: docSnap.data().displayName || user.email,
            photoURL: docSnap.data().photoURL || '',
            lastReadTimes: docSnap.data().lastReadTimes || {} // Get latest lastReadTimes
          });
        } else {
          setUserProfile({ displayName: user.email, photoURL: '', lastReadTimes: {} });
        }
      });
      return () => unsubscribe(); // Cleanup listener
    }
  }, [user]); // Re-run if user changes

  // Fetch Last Message Timestamp for Each Room
  useEffect(() => {
    if (rooms.length === 0) return;
    const listeners = rooms.map(room => {
      const messagesRef = collection(db, 'chat-rooms', room.id, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(1));
      return onSnapshot(q, (snapshot) => {
        setLastMessageTimes(prev => ({
          ...prev,
          [room.id]: snapshot.empty ? null : {
              timestamp: snapshot.docs[0].data().createdAt,
              senderUid: snapshot.docs[0].data().uid
          }
        }));
      }, (error) => {
          console.error(`Error fetching last message for room ${room.id}:`, error);
          setLastMessageTimes(prev => ({ ...prev, [room.id]: null }));
      });
    });
    return () => listeners.forEach(unsubscribe => unsubscribe());
  }, [rooms]);

  // Determine Unread Status (based on last message time vs last read time)
  useEffect(() => {
    if (!user || rooms.length === 0 || Object.keys(lastMessageTimes).length === 0) return;
    const newUnreadStatus = {};
    rooms.forEach(room => {
      const lastMsgInfo = lastMessageTimes[room.id];
      const userLastRead = userProfile.lastReadTimes[room.id];
      // Mark as unread ONLY IF last message exists, is newer than last read, AND not sent by current user
      newUnreadStatus[room.id] = !!(lastMsgInfo && lastMsgInfo.timestamp && lastMsgInfo.senderUid !== user.uid && (!userLastRead || lastMsgInfo.timestamp.seconds > userLastRead.seconds));
    });
    setUnreadStatus(newUnreadStatus);
  }, [rooms, lastMessageTimes, userProfile.lastReadTimes, user]);

  // Check for Unread Mentions (runs less frequently or triggered differently if needed)
  useEffect(() => {
    if (!user || rooms.length === 0 || !userProfile.lastReadTimes) return;

    const newMentionStatus = {};
    // Create an array of promises to check each room for mentions
    let checkPromises = rooms.map(async (room) => {
        const userLastRead = userProfile.lastReadTimes[room.id];
        // Optimization: Only query if the room is potentially unread based on simple unread status or no read time
        // More accurate: Check only if lastMessageTimes[room.id] > userLastRead
        if (unreadStatus[room.id] || !userLastRead) {
             const messagesRef = collection(db, 'chat-rooms', room.id, 'messages');
             // Query for unread messages mentioning the user in this room
             const mentionQuery = query(
                 messagesRef,
                 where('mentions', 'array-contains', user.uid),
                 // Only check messages newer than the last read time, if available
                 ...(userLastRead ? [where('createdAt', '>', userLastRead)] : []),
                 orderBy('createdAt', 'desc'), // Order by time to potentially limit checks later
                 limit(1) // We only need to know if at least one unread mention exists
             );
             try {
                 const mentionSnapshot = await getDocs(mentionQuery); // Use getDocs
                 newMentionStatus[room.id] = !mentionSnapshot.empty; // True if any unread mention found
             } catch (error) {
                 console.error(`Error checking mentions for room ${room.id}:`, error);
                 newMentionStatus[room.id] = false; // Default to false on error
             }
        } else {
            newMentionStatus[room.id] = false; // Room is already read, no need to check mentions
        }
    });

    // Update state after all checks are done
    Promise.all(checkPromises).then(() => {
        setMentionStatus(newMentionStatus);
    });
  // Rerun when basic unread status changes or last read times change
  }, [rooms, userProfile.lastReadTimes, user, unreadStatus]);


  // Handle creating a new room
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const roomName = newRoomName.trim();
    if (roomName === '' || !user) return;
    const newRoomId = roomName.toLowerCase().replace(/\s+/g, '-');
    try {
        await setDoc(doc(db, 'chat-rooms', newRoomId), {
            name: roomName,
            createdAt: serverTimestamp(),
            members: [user.uid] // Add creator as member
        });
        setNewRoomName('');
        navigate(`/room/${newRoomId}`);
    } catch (error) { console.error("Error creating room:", error); }
  };

  // Handle selecting a room from the list
  const handleSelectRoom = (roomId) => navigate(`/room/${roomId}`);

  // Filter rooms based on search term
  const filteredRooms = rooms.filter(room =>
    typeof room.name === 'string' &&
    room.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Styles object
  const styles = {
    container: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-color)' },
    header: { padding: '20px', borderBottom: '1px solid var(--border-color)' },
    title: { margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }, // Ensure consistent header color
    searchWrapper: { padding: '10px 20px', borderBottom: '1px solid var(--border-color)' },
    searchInput: { width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--background)', fontSize: '14px' }, // Slightly larger padding/font
    list: { listStyle: 'none', padding: '10px 20px', margin: 0, flex: 1, overflowY: 'auto' },
    // --- Refined List Item Styles ---
    listItem: {
      padding: '12px 15px', // Consistent padding
      cursor: 'pointer',
      borderRadius: '8px',
      marginBottom: '8px',
      fontSize: '15px', // Consistent font size
      fontWeight: '500', // Medium weight for readability
      color: 'var(--text-secondary)', // Default color for inactive rooms
      background: 'transparent', // Default transparent background
      border: 'none', // Remove default border
      boxShadow: 'none', // Remove default shadow
      transition: 'all 0.2s ease-in-out', // Keep smooth transition
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    activeListItem: {
      background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)',
      boxShadow: '0 4px 8px rgba(16, 185, 129, 0.2)', transform: 'translateY(-2px)',
    },
    indicatorsWrapper: { display: 'flex', alignItems: 'center', gap: '8px' },
    unreadDot: { width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, }, // Slightly smaller dot
    mentionBadge: { background: '#ef4444', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '11px', fontWeight: 'bold', flexShrink: 0, },
    form: { padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' },
    input: { flex: 1, padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--background)' },
    button: { padding: '10px 15px', border: 'none', background: 'var(--primary)', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' },
    profile: { padding: '15px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' },
    avatar: { width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', background: '#eee' },
    profileInfo: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    userName: { fontWeight: '500', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    signOutBtn: { background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: '500', padding: '5px' }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}><h1 style={styles.title}>Chat Rooms</h1></header>
      {/* Search Input */}
      <div style={styles.searchWrapper}>
        <input type="text" placeholder="Search rooms..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.searchInput} />
      </div>
      {/* Room List */}
      <ul style={styles.list}>
        {filteredRooms.map((room) => {
           const isActive = room.id === activeRoomId;
           const isUnread = unreadStatus[room.id] === true;
           const hasMention = mentionStatus[room.id] === true;
           const combinedStyle = {
             ...styles.listItem,
             ...(isActive ? styles.activeListItem : {}),
             // Bold if unread OR has mention (and not active)
             fontWeight: (isUnread || hasMention) && !isActive ? 'bold' : '500',
             color: isActive ? 'white' : 'var(--text-primary)' // Adjust color logic if needed
           };
           return (
             <li
               key={room.id}
               onClick={() => handleSelectRoom(room.id)}
               style={combinedStyle}
               onMouseOver={(e) => { if (!isActive) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'; } }}
               onMouseOut={(e) => { if (!isActive) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; } }}
             >
               <span>{room.name || 'Unnamed Room'}</span>
               {/* Display Mention Badge (@) or Unread Dot (🟢) */}
               <div style={styles.indicatorsWrapper}>
                   {hasMention && !isActive && <span style={styles.mentionBadge}>@</span>}
                   {isUnread && !hasMention && !isActive && <span style={styles.unreadDot}></span>}
               </div>
             </li>
           );
        })}
        {filteredRooms.length === 0 && searchTerm && <li style={{ padding: '10px 15px', color: 'var(--text-secondary)'}}>No rooms found.</li>}
      </ul>
      {/* Create Room Form */}
      <form onSubmit={handleCreateRoom} style={styles.form}>
        <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Create a room..." style={styles.input} />
        <button type="submit" style={styles.button}>+</button>
      </form>
      {/* Profile Section */}
      <div style={styles.profile}>
        <img src={userProfile.photoURL || `https://ui-avatars.com/api/?name=${userProfile.displayName}&background=random&color=fff`} alt="My Avatar" style={styles.avatar} />
        <div style={styles.profileInfo}> <span style={styles.userName} title={userProfile.displayName}>{userProfile.displayName}</span> </div>
        <button onClick={() => signOut(auth)} style={styles.signOutBtn} title="Sign Out">Sign Out</button>
      </div>
    </div>
  );
};

export default RoomList;