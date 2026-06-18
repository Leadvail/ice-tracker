import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Login failed: " + error.message);
      setIsLoading(false);
    } else {
      navigate('/');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f6f8', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <div style={{ maxWidth: '450px', width: '100%', padding: '2.5rem', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e9ecef' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', color: '#003399', fontSize: '1.5rem', fontWeight: 'bold' }}>Welcome to the LFB Training and Assessment Portal</h2>
          <p style={{ color: '#6c757d', margin: 0 }}>Please log in to continue</p>
        </div>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#495057', fontWeight: '600', fontSize: '0.9rem' }}>Email</label>
            <input 
              type="email" 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #ced4da', backgroundColor: '#fff', color: '#212529', fontSize: '1rem' }}
              placeholder="Enter your email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#495057', fontWeight: '600', fontSize: '0.9rem' }}>Password</label>
            <input 
              type="password" 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #ced4da', backgroundColor: '#fff', color: '#212529', fontSize: '1rem' }}
              placeholder="Enter your password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', backgroundColor: '#003399', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }} disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
