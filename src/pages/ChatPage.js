import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
// *** ALL NECESSARY IMPORTS PRESENT AND USED ***
import {
  collection, addDoc, serverTimestamp, query, orderBy,
  onSnapshot, doc, getDoc, updateDoc, arrayUnion, arrayRemove,
  where, getDocs, deleteDoc, setDoc // setDoc is needed for typing
} from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useParams, useNavigate, Navigate } from 'react-router-dom'; // Ensure Navigate is imported
import Navbar from '../components/Navbar';
import RoomList from '../components/RoomList';

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const CLOUDINARY_CLOUD_NAME = "de3olzxvq"; // Replace if different
const CLOUDINARY_UPLOAD_PRESET = "izx1ajle"; // Replace if different


const ChatPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [loadingAI, setLoadingAI] = useState(false);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [isMember, setIsMember] = useState(false);
    const [loadingMembership, setLoadingMembership] = useState(true);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [roomMembers, setRoomMembers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [editingMessageId, setEditingMessageId] = useState(null); // State for editing mode
    const [editingContent, setEditingContent] = useState(''); // State for edit input value
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const user = auth.currentUser;

    // --- Effect: Check Membership, Fetch Messages, Setup Typing Listener ---
    useEffect(() => {
        if (!roomId || !user) { navigate('/'); return; }
        setLoadingMembership(true); setIsMember(false); setMessages([]);
        const roomDocRef = doc(db, 'chat-rooms', roomId);
        let msgUnsubscribe = null, typingUnsubscribe = null;

        const checkMembershipAndSubscribe = async () => {
            try {
                const docSnap = await getDoc(roomDocRef);
                if (docSnap.exists()) {
                    const members = docSnap.data().members || [];
                    if (members.includes(user.uid)) {
                        setIsMember(true);
                        // Subscribe to messages
                        const msgQuery = query(collection(db, 'chat-rooms', roomId, 'messages'), orderBy('createdAt'));
                        msgUnsubscribe = onSnapshot(msgQuery, (snapshot) => { setMessages(snapshot.docs.map(d => ({ ...d.data(), id: d.id }))); });
                        // Subscribe to typing
                        const typingRef = collection(db, 'chat-rooms', roomId, 'typing');
                        typingUnsubscribe = onSnapshot(typingRef, (snapshot) => {
                            const now = new Date();
                            setTypingUsers(snapshot.docs.map(d => d.data()).filter(u => u.uid !== user?.uid && u.timestamp && (now.getTime() - u.timestamp.toDate().getTime()) < 3000));
                        });
                    } else { setIsMember(false); }
                } else {
                    console.error("Room not found, redirecting.");
                    navigate('/');
                 }
            } catch (error) { console.error("Error checking membership:", error); }
            finally { setLoadingMembership(false); }
        };
        checkMembershipAndSubscribe();
        // Cleanup
        return () => {
            if (msgUnsubscribe) msgUnsubscribe();
            if (typingUnsubscribe) typingUnsubscribe();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (user && roomId) { // Check roomId exists on cleanup
                 deleteDoc(doc(db, 'chat-rooms', roomId, 'typing', user.uid)).catch(()=>{});
            }
        };
    }, [user, roomId, navigate]);

    // Scroll to bottom
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // --- Function: Join Room ---
    const handleJoinRoom = async () => {
        if (!user || !roomId) return;
        const roomDocRef = doc(db, 'chat-rooms', roomId);
        try { await updateDoc(roomDocRef, { members: arrayUnion(user.uid) }); /* Listener updates state */ }
        catch (error) { console.error("Error joining room:", error); alert("Failed to join room."); }
    };

    // --- Function: Fetch and Show Members ---
    const handleShowMembers = async () => {
         if (!roomId || !user) return;
        setRoomMembers([]); setShowMembersModal(true);
        const roomDocRef = doc(db, 'chat-rooms', roomId);
        try {
            const roomSnap = await getDoc(roomDocRef);
            if (roomSnap.exists()) {
                const memberUIDs = roomSnap.data().members || [];
                if (memberUIDs.length > 0) {
                    const usersRef = collection(db, 'users');
                    const chunks = []; // Handle 'in' query limit (max 30 as of recent updates)
                    for (let i = 0; i < memberUIDs.length; i += 30) { chunks.push(memberUIDs.slice(i, i + 30)); }
                    const memberProfiles = [];
                    for (const chunk of chunks) {
                        const q = query(usersRef, where('uid', 'in', chunk));
                        const userSnaps = await getDocs(q);
                        userSnaps.forEach(doc => {
                           memberProfiles.push({
                                uid: doc.data().uid || doc.id, // Prefer uid field if exists
                                displayName: doc.data().displayName || doc.data().email,
                                photoURL: doc.data().photoURL,
                                online: doc.data().online
                            });
                        });
                    }
                    setRoomMembers(memberProfiles);
                }
            }
        } catch (error) { console.error("Error fetching room members:", error); }
    };

    // --- Function: Send Message ---
    // --- Function: Send Message --- (Includes @Mention Parsing)
    const sendMessage = async (content, type = 'text', senderDisplayName = null) => {
        // Ensure user is logged in and a member before sending
        if (!user || !isMember) return;
        
        let displayName, photoURL, senderUid;

        // Determine sender details (AI or the current user)
        if (senderDisplayName === 'AI Assistant') {
            displayName = 'AI Assistant';
            senderUid = 'gemini-ai-assistant';
            photoURL = '/ai-avatar.png'; // Example path for AI avatar
        } else {
            // Fetch the current user's profile information from Firestore
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef); // Fetch user doc
            // Use displayName from profile, fallback to email if not set
            displayName = userDocSnap.exists() ? (userDocSnap.data().displayName || user.email) : user.email;
            // Use photoURL from profile, fallback to empty string
            photoURL = userDocSnap.exists() ? (userDocSnap.data().photoURL || '') : '';
            senderUid = user.uid;
        }

        // --- Mention Parsing Logic ---
        const mentions = []; // Array to store UIDs of mentioned users
        const mentionRegex = /@(\w+)/g; // Simple regex to find @ followed by word characters
        let match;
        const potentialNames = []; // Store potential display names found (e.g., "Chandu")

        // Extract all potential names mentioned in the message content
        while ((match = mentionRegex.exec(content)) !== null) {
            potentialNames.push(match[1]); // Add the captured name to the list
        }

        // If any potential names were found, attempt to resolve them to User IDs
        if (potentialNames.length > 0) {
            // !!! CAVEAT: Client-side lookup of ALL users is INEFFICIENT for large user bases !!!
            // In a production app, consider searching only current room members or using a backend.
            const usersRef = collection(db, 'users');
            try {
                // Fetch all documents from the 'users' collection
                const usersSnapshot = await getDocs(usersRef);
                usersSnapshot.forEach(userDoc => {
                    const userData = userDoc.data();
                    // Check if this user's displayName matches any of the mentioned names (case-insensitive)
                    if (potentialNames.some(name => (userData.displayName || '').toLowerCase() === name.toLowerCase())) {
                        // If a match is found, add the user's UID to the mentions array (if it exists and isn't already there)
                        if (userData.uid && !mentions.includes(userData.uid)) {
                           mentions.push(userData.uid);
                        }
                    }
                });
                console.log("Resolved mention UIDs:", mentions); // Log resolved UIDs for debugging
            } catch (error) {
                console.error("Error fetching users for mentions:", error);
                // Proceed without mentions if the user lookup fails
            }
        }
        // --- END Mention Parsing ---

        // Add the message document to the Firestore subcollection for the current room
        await addDoc(collection(db, 'chat-rooms', roomId, 'messages'), {
            content: content,           // The actual message text or file URL
            type: type,                 // 'text', 'image', or 'file'
            uid: senderUid,             // UID of the sender (user or AI)
            displayName: displayName,   // Display name of the sender
            photoURL: photoURL,         // Avatar URL of the sender
            createdAt: serverTimestamp(), // Timestamp for ordering
            reactions: {},              // Initialize empty map for reactions
            mentions: mentions          // Store the array of resolved mentioned User IDs
        });
    };

    // --- Function: Handle Send Button/Enter Key ---
    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        const content = message.trim();
        if (content === '' || !isMember) return;
        if (content.toLowerCase().startsWith('@ai')) { await handleAskAI(content.substring(3).trim()); }
        else { await sendMessage(content, 'text'); }
        setMessage('');
        // Stop typing indicator after sending
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (user) { deleteDoc(doc(db, 'chat-rooms', roomId, 'typing', user.uid)).catch(()=>{}); }
    };

    // --- Function: Handle File Upload ---
    const handleFileUpload = async (e) => {
        if (!isMember) return;
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, { method: 'POST', body: formData });
            const data = await response.json();
            if (response.ok) await sendMessage(data.secure_url, data.resource_type === 'image' ? 'image' : 'file');
            else throw new Error(data.error.message);
        } catch (error) { console.error("Upload Error:", error); alert(`Upload failed: ${error.message}`); }
        finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    };

    // --- Function: Handle Ask AI ---
    const handleAskAI = async (prompt) => {
        if (!isMember) return;
        const aiPrompt = prompt || "Respond to the conversation context.";
        if (messages.length === 0 && !prompt) return alert("Send a message first for context!");
        setLoadingAI(true);
        let historyForAI = [];
        try {
            historyForAI = messages.map(msg => {
                let text = (typeof msg.content === 'string') ? msg.content : '[Non-text content]';
                if (msg.type === 'image' || msg.type === 'file') text = `[User uploaded ${msg.type}]`;
                return { role: msg.uid === 'gemini-ai-assistant' ? "model" : "user", parts: [{ text }] };
            }).filter(item => item.parts[0].text);
            // console.log("Sending history to AI:", JSON.stringify(historyForAI, null, 2));
            const chat = model.startChat({ history: historyForAI });
            const result = await chat.sendMessage([{ text: aiPrompt }]);
            await sendMessage(result.response.text(), 'text', 'AI Assistant');
        } catch (error) {
            console.error("Gemini API Error:", error);
            if (error instanceof Error && error.message.includes('API key not valid')) { alert("AI Error: Invalid API Key."); }
            else { alert("Failed to get AI response."); }
        } finally { setLoadingAI(false); }
    };

    // --- Function: Handle Reactions ---
    const handleReaction = async (messageId, emoji) => {
        if (!user || !roomId || !isMember) return;
        const messageRef = doc(db, 'chat-rooms', roomId, 'messages', messageId);
        const reactionKey = `reactions.${emoji}`;
        try {
            const messageSnap = await getDoc(messageRef);
            if (!messageSnap.exists()) return;
            const reactions = messageSnap.data().reactions || {};
            const usersWhoReacted = reactions[emoji] || [];
            if (usersWhoReacted.includes(user.uid)) { await updateDoc(messageRef, { [reactionKey]: arrayRemove(user.uid) }); }
            else { await updateDoc(messageRef, { [reactionKey]: arrayUnion(user.uid) }); }
        } catch (error) { console.error("Error updating reaction:", error); }
    };

     // --- Function: Handle Typing ---
     const handleTyping = () => {
        if (!user || !roomId || !isMember) return;
        const typingDocRef = doc(db, 'chat-rooms', roomId, 'typing', user.uid);
        setDoc(typingDocRef, { uid: user.uid, displayName: user.displayName || user.email, timestamp: serverTimestamp() });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => { deleteDoc(typingDocRef).catch(()=>{}); }, 2000);
    };

    // --- Function: Start Editing ---
    const handleStartEdit = (msg) => {
        if (!user || msg.uid !== user.uid || msg.type !== 'text' || msg.uid === 'gemini-ai-assistant') return;
        setEditingMessageId(msg.id);
        setEditingContent(msg.content);
    };

    // --- Function: Cancel Editing ---
    const handleCancelEdit = () => { setEditingMessageId(null); setEditingContent(''); };

    // --- Function: Save Edit ---
    const handleSaveEdit = async () => {
        if (!editingMessageId || !user || !isMember || !editingContent.trim()) return;
        const messageRef = doc(db, 'chat-rooms', roomId, 'messages', editingMessageId);
        try {
            await updateDoc(messageRef, { content: editingContent.trim(), editedAt: serverTimestamp() });
            handleCancelEdit();
        } catch (error) { console.error("Error saving edit:", error); alert("Failed to save edit."); }
    };

    // --- Function: Delete Message ---
    const handleDeleteMessage = async (messageId) => {
        if (!user || !isMember) return;
        if (window.confirm("Delete this message?")) {
            const messageRef = doc(db, 'chat-rooms', roomId, 'messages', messageId);
            try { await deleteDoc(messageRef); }
            catch (error) { console.error("Error deleting message:", error); alert("Failed to delete message."); }
        }
    };

    // --- Function: Format Timestamp ---
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
     };

    // --- Styles Object ---
    const styles = {
        pageLayout: { display: 'flex', height: '100vh' },
        sidebar: { width: '280px', flexShrink: 0, display: 'flex' },
        chatContainer: { flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--chat-bg)'},
        chatLayout: { width: '100%', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' },
        header: { padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)' },
        headerInfo: { display: 'flex', flexDirection: 'column' },
        roomName: { margin: 0, fontSize: '18px', fontWeight: 'bold' },
        userName: { margin: 0, fontSize: '12px', color: 'var(--text-secondary)' },
        headerActions: { display: 'flex', gap: '10px', alignItems: 'center' },
        button: { padding: '8px 16px', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', transition: 'background 0.2s' },
        iconButton: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-secondary)', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' },
        messagesList: { flex: 1, overflowY: 'auto', padding: '24px' },
        messageGroup: { display: 'flex', marginBottom: '20px', alignItems: 'flex-start', gap: '10px', position: 'relative' },
        sentGroup: { justifyContent: 'flex-end', flexDirection: 'row-reverse' },
        receivedGroup: { justifyContent: 'flex-start' },
        avatar: { width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', background: '#eee', flexShrink: 0, marginTop: '20px'},
        messageContentWrapper: { display: 'flex', flexDirection: 'column' },
        sentContentWrapper: { alignItems: 'flex-end'},
        receivedContentWrapper: { alignItems: 'flex-start'},
        bubble: { padding: '12px 16px', borderRadius: '18px', maxWidth: '100%', wordWrap: 'break-word', fontSize: '15px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', position: 'relative' },
        sentBubble: { background: 'var(--sent-bubble-bg)', color: 'white' },
        receivedBubble: { background: 'var(--received-bubble-bg)', border: '1px solid var(--border-color)' },
        aiBubble: { background: 'var(--ai-bubble-bg)', border: '1px solid #d1d5db' },
        senderDetails: { marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' },
        timestamp: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' },
        editedIndicator: { fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '5px', fontStyle: 'italic' },
        reactionsContainer: { display: 'flex', gap: '4px', marginTop: '5px', flexWrap: 'wrap', justifyContent: 'flex-start' },
        reactionBadge: { background: 'var(--hover-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2px 6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' },
        messageActionsContainer: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'var(--card-bg)', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', display: 'none', zIndex: 10, padding: '4px', gap: '4px',marginLeft: '8px' },
        sentActionsContainer: { right: '105%' },
        receivedActionsContainer: { left: '105%' },
        actionButton: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '0.8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',marginLeft: '1px' },
        editInput: { width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--primary)', outline: 'none', fontSize: '15px', margin: '5px 0', minHeight: '50px', resize: 'vertical' },
        editButtons: { display: 'flex', gap: '5px', marginTop: '5px', justifyContent: 'flex-end' },
        editSaveButton: { padding: '4px 8px', fontSize: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
        editCancelButton: { padding: '4px 8px', fontSize: '12px', background: 'var(--text-secondary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
        form: { padding: '24px', borderTop: '1px solid var(--border-color)', background: 'var(--background-white)' },
        inputWrapper: { display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--background)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border-color)' },
        input: { flex: 1, padding: '10px', border: 'none', background: 'transparent', outline: 'none', fontSize: '15px' },
        typingIndicator: { height: '24px', padding: '0 24px', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' },
        joinContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center', background: 'var(--chat-bg)' },
        joinButton: { padding: '12px 25px', fontSize: '16px', fontWeight: '500', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', marginTop: '20px', transition: 'background 0.2s' },
        modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
        modalContent: { background: 'white', padding: '30px', borderRadius: '12px', minWidth: '300px', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' },
        modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' },
        modalTitle: { margin: 0, fontSize: '18px', fontWeight: 'bold'},
        closeButton: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-secondary)' },
        memberList: { listStyle: 'none', padding: 0, margin: 0 },
        memberItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border-color)' },
        memberAvatar: { width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' },
        memberName: { fontWeight: '500' },
        memberStatus: { marginLeft: 'auto', fontSize: '12px', color: 'var(--text-secondary)' },
        onlineIndicatorSmall: { width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', marginLeft: '5px'}
    };
    // --- End Styles ---

    if (!user) return <Navigate to="/login" replace />;
    if (loadingMembership) return <div style={{textAlign: 'center', marginTop: '40px'}}>Loading Room...</div>;

    return (
        <div style={styles.pageLayout}>
            <Navbar />
            <aside style={styles.sidebar}><RoomList /></aside>
            <div style={styles.chatContainer}>
                {isMember ? (
                    <div style={styles.chatLayout}>
                        <header style={styles.header}>
                            <div style={styles.headerInfo}>
                                <h2 style={styles.roomName}>{roomId}</h2>
                                <p style={styles.userName}>Signed in as {user.displayName || user.email}</p>
                            </div>
                            <div style={styles.headerActions}>
                                <button onClick={handleShowMembers} style={{ ...styles.button, background: 'var(--text-secondary)' }}> Members </button>
                                <button onClick={() => handleAskAI()} disabled={loadingAI} style={{ ...styles.button, background: loadingAI ? '#9ca3af' : 'var(--primary)' }}> {loadingAI ? 'Thinking...' : 'Ask AI'} </button>
                            </div>
                        </header>
                        <main style={styles.messagesList}>
                            {/* --- COMPLETE Message Mapping --- */}
                            {messages.map((msg) => {
                                const isSent = msg.uid === user.uid;
                                const isAI = msg.uid === 'gemini-ai-assistant';
                                const senderName = isAI ? 'AI Assistant' : (msg.displayName || 'User');
                                const avatarSrc = msg.photoURL || `https://ui-avatars.com/api/?name=${senderName.replace(/\s+/g, '+')}&background=random&color=fff`;
                                const reactions = msg.reactions || {};
                                const isEditing = editingMessageId === msg.id;

                                return (
                                    <div
                                        key={msg.id}
                                        style={{ ...styles.messageGroup, ...(isSent ? styles.sentGroup : styles.receivedGroup) }}
                                        onMouseEnter={() => !isEditing && setHoveredMessageId(msg.id)}
                                        onMouseLeave={() => setHoveredMessageId(null)}
                                    >
                                        {!isSent && <img src={avatarSrc} alt={senderName} style={styles.avatar} />}
                                        <div style={{...styles.messageContentWrapper, ...(isSent ? styles.sentContentWrapper : styles.receivedContentWrapper)}}>
                                            {!isSent && <div style={styles.senderDetails}>{senderName}</div>}
                                            {/* Wrapper for bubble + action buttons */}
                                            <div style={{ position: 'relative' }}>
                                                <div style={{...styles.bubble, ...(isAI ? styles.aiBubble : (isSent ? styles.sentBubble : styles.receivedBubble))}}>
                                                    {isEditing ? (
                                                        // Edit Mode
                                                        <div>
                                                            <textarea style={styles.editInput} value={editingContent} onChange={(e) => setEditingContent(e.target.value)} rows={Math.max(2, editingContent.split('\n').length)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); } if (e.key === 'Escape') { handleCancelEdit(); } }} />
                                                            <div style={styles.editButtons}> <button onClick={handleCancelEdit} style={styles.editCancelButton}>Cancel (Esc)</button> <button onClick={handleSaveEdit} style={styles.editSaveButton}>Save (Enter)</button> </div>
                                                        </div>
                                                    ) : (
                                                        // Normal Content Display
                                                        <>
                                                            {msg.type === 'image' ? <img src={msg.content} alt="Uploaded" style={{ maxWidth: '250px', borderRadius: '8px', display: 'block' }} />
                                                            : msg.type === 'file' ? <a href={msg.content} target="_blank" rel="noopener noreferrer" style={{ color: isSent ? 'white' : 'var(--primary)' }}>Download File</a>
                                                            : <span style={{ whiteSpace: 'pre-wrap'}}>{msg.content}</span>}
                                                        </>
                                                    )}
                                                </div>
                                                {/* Action Buttons */}
                                                {!isEditing && (
                                                    <div style={{ ...styles.messageActionsContainer, ...(isSent ? styles.sentActionsContainer : styles.receivedActionsContainer), display: hoveredMessageId === msg.id && !isAI ? 'flex' : 'none' }}>
                                                        <button style={styles.actionButton} onClick={() => handleReaction(msg.id, '👍')} title="Like">👍</button>
                                                        <button style={styles.actionButton} onClick={() => handleReaction(msg.id, '❤️')} title="Love">❤️</button>
                                                        <button style={styles.actionButton} onClick={() => handleReaction(msg.id, '😂')} title="Laugh">😂</button>
                                                        {isSent && msg.type === 'text' && (<button style={styles.actionButton} onClick={() => handleStartEdit(msg)} title="Edit">✏️</button> )}
                                                        {isSent && (<button style={styles.actionButton} onClick={() => handleDeleteMessage(msg.id)} title="Delete">🗑️</button> )}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Reactions Display */}
                                            {!isEditing && Object.keys(reactions).length > 0 && (
                                                <div style={styles.reactionsContainer}>
                                                   {Object.entries(reactions).map(([emoji, users]) => ( users && users.length > 0 && ( <div key={emoji} style={{...styles.reactionBadge, ...(users.includes(user.uid) ? { background: 'var(--primary-light)', borderColor: 'var(--primary)' } : {})}} onClick={() => handleReaction(msg.id, emoji)} title={users.map(uid => uid === user.uid ? 'You' : 'Someone').join(', ')} > <span>{emoji}</span> <span style={{fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '3px'}}>{users.length}</span> </div> ))) }
                                                </div>
                                            )}
                                            {/* Timestamp and Edited */}
                                            <div style={styles.timestamp}>
                                                {formatTimestamp(msg.createdAt)}
                                                {msg.editedAt && <span style={styles.editedIndicator}> (edited)</span>}
                                            </div>
                                        </div>
                                        {isSent && <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=random&color=fff`} alt="My Avatar" style={styles.avatar} />}
                                    </div>
                                );
                            })}
                            {/* --- END Message Mapping --- */}
                            <div ref={messagesEndRef} />
                        </main>
                         <div style={styles.typingIndicator}> {typingUsers.length > 0 && `${typingUsers.map(u => u.displayName || 'Someone').join(', ')} ${typingUsers.length > 1 ? 'are' : 'is'} typing...`} </div>
                        <footer style={styles.form}>
                            <div style={styles.inputWrapper}>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                                <button onClick={() => fileInputRef.current.click()} disabled={uploading || loadingAI} style={{ ...styles.iconButton, opacity: (uploading || loadingAI) ? 0.5 : 1 }}>📎</button>
                                <input type="text" value={message} onChange={(e) => {setMessage(e.target.value); handleTyping();}} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(e)} placeholder="Type a message or @ai..." style={styles.input} disabled={loadingAI} />
                                <button type="submit" onClick={handleSendMessage} style={{ ...styles.button, background: 'var(--primary)' }} disabled={loadingAI}> {loadingAI ? 'AI...' : 'Send'} </button>
                            </div>
                        </footer>
                    </div>
                ) : ( // Render Join Room View
                     <div style={styles.joinContainer}> <h2>Join {roomId}</h2> <p>You need to join this room.</p> <button onClick={handleJoinRoom} style={styles.joinButton}> Join Room </button> </div>
                )}
            </div>
             {/* Members Modal */}
             {showMembersModal && ( <div style={styles.modalOverlay} onClick={() => setShowMembersModal(false)}> <div style={styles.modalContent} onClick={e => e.stopPropagation()}> <div style={styles.modalHeader}> <h3 style={styles.modalTitle}>Members in #{roomId}</h3> <button style={styles.closeButton} onClick={() => setShowMembersModal(false)}>&times;</button> </div> <ul style={styles.memberList}> {roomMembers.length > 0 ? roomMembers.map(member => ( <li key={member.uid} style={styles.memberItem}> <img src={member.photoURL || `https://...`} alt={member.displayName} style={styles.memberAvatar}/> <span style={styles.memberName}>{member.displayName}</span> {member.online && <span style={styles.onlineIndicatorSmall}></span>} </li> )) : ( <li>Loading...</li> )} </ul> </div> </div> )}
        </div>
    );
};

export default ChatPage;