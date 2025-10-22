import React from 'react';
import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const Navbar = () => {
  const styles = {
    navContainer: {
      width: '80px', height: '100vh', background: '#1e293b',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '20px 0', flexShrink: 0
    },
    navItem: {
      width: '48px', height: '48px', borderRadius: '12px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#94a3b8', textDecoration: 'none',
      marginBottom: '10px', transition: 'all 0.2s'
    },
    activeNavItem: { background: 'var(--primary)', color: 'white' },
    bottomNav: { marginTop: 'auto' }
  };
  
  const activeStyle = { ...styles.navItem, ...styles.activeNavItem };

  return (
    <nav style={styles.navContainer}>
      <NavLink to="/" style={({ isActive }) => isActive ? activeStyle : styles.navItem} title="Home">🏠</NavLink>
      <NavLink to="/profile" style={({ isActive }) => isActive ? activeStyle : styles.navItem} title="Profile">👤</NavLink>
      <div style={styles.bottomNav}>
        <button onClick={() => signOut(auth)} style={{...styles.navItem, border: 'none', cursor: 'pointer'}} title="Sign Out">🚪</button>
      </div>
    </nav>
  );
};

export default Navbar;