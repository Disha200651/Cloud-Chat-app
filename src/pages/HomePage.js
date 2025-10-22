import React from 'react';
import RoomList from '../components/RoomList';
import Navbar from '../components/Navbar';

const HomePage = () => {
  const styles = {
    pageLayout: { display: 'flex', height: '100vh' },
    sidebar: { width: '280px', flexShrink: 0, display: 'flex' },
    mainContent: {
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px', textAlign: 'center',
    },
    welcomeCard: {
      background: 'var(--card-bg)', padding: '40px', borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)', maxWidth: '500px'
    },
    welcomeIcon: { fontSize: '48px', marginBottom: '20px', color: 'var(--primary)' },
    welcomeTitle: { fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '10px' },
    welcomeText: { fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.6' }
  };

  return (
    <div style={styles.pageLayout}>
      <Navbar />
      <aside style={styles.sidebar}><RoomList /></aside>
      <main style={styles.mainContent}>
        <div style={styles.welcomeCard}>
          <div style={styles.welcomeIcon}>💬</div>
          <h1 style={styles.welcomeTitle}>Welcome to Cloud Chat</h1>
          <p style={styles.welcomeText}>
            Select a room from the list to start chatting, or create a new one to begin a fresh conversation.
          </p>
        </div>
      </main>
    </div>
  );
};

export default HomePage;