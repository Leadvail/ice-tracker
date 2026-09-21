import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

export default function AdminDashboard({ session }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAuthAndLoadData() {
      const email = session?.user?.email;
      if (!email) {
        navigate('/');
        return;
      }

      console.log("AdminDashboard Diagnostic: Checking auth for", email, "Session ID:", session?.user?.id);
      
      // Check if user is admin
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session?.user?.id)
        .maybeSingle();

      console.log("AdminDashboard Diagnostic: Role Data:", roleData, "Role Error:", roleError);

      if (roleError || roleData?.role !== 'admin') {
        navigate('/');
        return;
      }

      setIsAdmin(true);

      // Load all existing permissions globally
      const { data: permData, error: permError } = await supabase
        .from('user_module_permissions')
        .select('*')
        .order('email');

      console.log("Admin Fetch Result:", permData, permError);

      if (!permError && permData) {
        // Optionally filter out admin if we only want to show standard users, but for now we'll just render everything.
        setUsers(permData);
      }
      setIsLoading(false);
    }

    checkAuthAndLoadData();
  }, [session, navigate]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const togglePermission = async (email, field, currentValue) => {
    const newValue = !currentValue;
    
    const userRecord = users.find(u => u.email === email);
    
    // Optimistic UI update
    setUsers(users.map(u => u.email === email ? { ...u, [field]: newValue } : u));

    const { error } = await supabase
      .from('user_module_permissions')
      .update({ [field]: newValue })
      .eq('user_id', userRecord.user_id);

    if (error) {
      console.error("Mutation Error Details:", error?.message, error?.details);
      // Revert on error
      setUsers(users.map(u => u.email === email ? { ...u, [field]: currentValue } : u));
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) {
      alert("Email and password are required.");
      return;
    }
    
    setIsCreating(true);
    
    try {
      // Create a temporary client that does not persist session
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      );

      // Sign up the new user
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
      });

      if (authError) throw new Error(authError.message);

      const newUserId = authData?.user?.id;
      if (!newUserId) throw new Error("User creation failed, no ID returned.");

      // Upsert into profiles_portal
      const { error: profileError } = await supabase
        .from('profiles_portal')
        .upsert([
          {
            id: newUserId,
            email: newUserEmail,
            full_name: newUserName || '',
            updated_at: new Date().toISOString()
          }
        ], { onConflict: 'id' });

      if (profileError) {
        console.warn("Profiles Insert Warning:", profileError);
      }

      // Upsert into user_module_permissions
      const { error: permError } = await supabase
        .from('user_module_permissions')
        .upsert([
          {
            user_id: newUserId,
            email: newUserEmail,
            can_access_training_spec: false,
            can_access_competency_framework: false,
            can_access_course_planner: false,
            can_access_tfa: false,
            can_access_incident_command: false
          }
        ], { onConflict: 'user_id' });

      if (permError) {
        console.warn("Permissions Insert Warning:", permError);
      }

      // Reload users table
      const { data: permData } = await supabase.from('user_module_permissions').select('*').order('email');
      if (permData) setUsers(permData);

      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setShowCreateModal(false);
      alert("User account created successfully!");
    } catch (err) {
      console.error(err);
      alert("Error creating user: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading Admin Panel...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div style={{ padding: '3rem 4rem', backgroundColor: '#f9fafb', minHeight: '100vh', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#111827', margin: 0, fontSize: '2rem' }}>Admin Control Panel</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => setShowCreateModal(true)}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            + Create New User
          </button>
          <button 
            onClick={() => navigate('/')}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Back to Portal
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '1rem', color: '#374151', fontWeight: 'bold' }}>User Email</th>
              <th style={{ padding: '1rem', color: '#374151', fontWeight: 'bold', textAlign: 'center' }}>Training Spec</th>
              <th style={{ padding: '1rem', color: '#374151', fontWeight: 'bold', textAlign: 'center' }}>Competency FW</th>
              <th style={{ padding: '1rem', color: '#374151', fontWeight: 'bold', textAlign: 'center' }}>Course Planner</th>
              <th style={{ padding: '1rem', color: '#374151', fontWeight: 'bold', textAlign: 'center' }}>TFA</th>
              <th style={{ padding: '1rem', color: '#374151', fontWeight: 'bold', textAlign: 'center' }}>ICE</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.email} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '1rem', color: '#111827', fontWeight: '500' }}>{user.email}</td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <input type="checkbox" checked={!!user.can_access_training_spec} onChange={() => togglePermission(user.email, 'can_access_training_spec', !!user.can_access_training_spec)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <input type="checkbox" checked={!!user.can_access_competency_framework} onChange={() => togglePermission(user.email, 'can_access_competency_framework', !!user.can_access_competency_framework)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <input type="checkbox" checked={!!user.can_access_course_planner} onChange={() => togglePermission(user.email, 'can_access_course_planner', !!user.can_access_course_planner)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <input type="checkbox" checked={!!user.can_access_tfa} onChange={() => togglePermission(user.email, 'can_access_tfa', !!user.can_access_tfa)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <input type="checkbox" checked={!!user.can_access_incident_command} onChange={() => togglePermission(user.email, 'can_access_incident_command', !!user.can_access_incident_command)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No users found in user_module_permissions.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', color: '#111827' }}>Create New User</h2>
            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#374151' }}>Full Name (Optional)</label>
                <input 
                  type="text" 
                  value={newUserName} 
                  onChange={e => setNewUserName(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#374151' }}>Email Address *</label>
                <input 
                  type="email" 
                  value={newUserEmail} 
                  onChange={e => setNewUserEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#374151' }}>Initial Password *</label>
                <input 
                  type="password" 
                  value={newUserPassword} 
                  onChange={e => setNewUserPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  required
                  minLength={6}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '0.75rem 1rem', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isCreating}
                  style={{ padding: '0.75rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: isCreating ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isCreating ? 0.7 : 1 }}
                >
                  {isCreating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
