import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { categoryMap } from './criteriaMap';

export default function TimelineBuilder({ user, onLogout }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({ name: '', description: '', officer_rank: '' });

  // Clock Settings State
  const [clockSettings, setClockSettings] = useState({ start_clock_time: '', start_clock_node_id: '' });
  
  // Form State
  const [editingNode, setEditingNode] = useState(null);
  const [formData, setFormData] = useState({
    node_id: '',
    title: '',
    time: '',
    length_mins: 0,
    node_type: 'node',
    detail: '',
    criteria: '',
    role_players: '',
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data } = await supabase.from('exercise_templates').select('*').order('created_at', { ascending: false });
    if (data) setTemplates(data);
  };

  const fetchNodes = async (templateId) => {
    const { data } = await supabase.from('timeline_nodes').select('*').eq('template_id', templateId).order('order_index', { ascending: true });
    if (data) setNodes(data);
  };

  const selectTemplate = (template) => {
    setSelectedTemplate(template);
    setClockSettings({
      start_clock_time: template.start_clock_time || '',
      start_clock_node_id: template.start_clock_node_id || ''
    });
    fetchNodes(template.id);
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    const payload = {
      ...newTemplateForm,
      timeline_data: [] // Provide empty array to satisfy legacy NOT NULL constraint
    };
    const { data, error } = await supabase.from('exercise_templates').insert(payload).select().single();
    if (error) {
      alert("Error creating template: " + error.message);
    } else {
      setShowNewTemplate(false);
      setNewTemplateForm({ name: '', description: '', officer_rank: '' });
      fetchTemplates();
      selectTemplate(data);
    }
  };

  const handleSaveClockSettings = async () => {
    if (!selectedTemplate) return;
    const { error } = await supabase.from('exercise_templates').update(clockSettings).eq('id', selectedTemplate.id);
    if (error) {
      alert("Error updating clock settings: " + error.message);
    } else {
      alert("Clock settings saved!");
      fetchTemplates(); // refresh
    }
  };

  const getNextAvailableTime = (currentNodes) => {
    if (!currentNodes || currentNodes.length === 0) return '';
    const lastNode = [...currentNodes].reverse().find(n => n.time && n.length_mins !== undefined);
    if (!lastNode) return '';
    
    const parts = lastNode.time.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      const nextMins = mins + (lastNode.length_mins || 0);
      const h = Math.floor(nextMins / 60);
      const m = nextMins % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
    return '';
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    if (!window.confirm("Are you sure you want to delete this entire exercise and all its injects? This action cannot be undone.")) return;
    
    const { error } = await supabase.from('exercise_templates').delete().eq('id', selectedTemplate.id);
    if (error) {
      alert("Error deleting template: " + error.message);
    } else {
      setSelectedTemplate(null);
      setNodes([]);
      setClockSettings({ start_clock_time: '', start_clock_node_id: '' });
      fetchTemplates();
    }
  };

  const handleSaveNode = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    // Convert CSV strings back to arrays
    const parseCSV = (str) => {
      if (Array.isArray(str)) return str;
      return str ? str.split(',').map(s => s.trim()).filter(s => s) : null;
    };

    const payload = {
      template_id: selectedTemplate.id,
      node_id: formData.node_id,
      title: formData.title,
      time: formData.time || null,
      length_mins: formData.length_mins,
      node_type: formData.node_type,
      detail: parseCSV(formData.detail),
      criteria: Array.isArray(formData.criteria) ? formData.criteria : parseCSV(formData.criteria),
      role_players: parseCSV(formData.role_players),
      order_index: editingNode ? editingNode.order_index : nodes.length,
    };

    if (editingNode) {
      await supabase.from('timeline_nodes').update(payload).eq('id', editingNode.id);
      await supabase.from('audit_logs').insert({ user_id: user.id, action: 'UPDATE_NODE', entity_type: 'timeline_nodes', entity_id: editingNode.id });
    } else {
      const { data } = await supabase.from('timeline_nodes').insert(payload).select().single();
      if (data) {
        await supabase.from('audit_logs').insert({ user_id: user.id, action: 'CREATE_NODE', entity_type: 'timeline_nodes', entity_id: data.id });
      }
    }

    setEditingNode(null);
    fetchNodes(selectedTemplate.id);
  };

  // When nodes update, and we are not editing, auto-fill the time
  useEffect(() => {
    if (!editingNode) {
      setFormData(prev => ({ ...prev, node_id: '', title: '', length_mins: 0, node_type: 'node', detail: '', criteria: [], role_players: '', time: getNextAvailableTime(nodes) }));
    }
  }, [nodes]);

  const handleEdit = (node) => {
    setEditingNode(node);
    setFormData({
      node_id: node.node_id || '',
      title: node.title || '',
      time: node.time || '',
      length_mins: node.length_mins || 0,
      node_type: node.node_type || 'node',
      detail: node.detail ? node.detail.join(', ') : '',
      criteria: node.criteria || [], // Now expects an array for checkboxes
      role_players: node.role_players ? node.role_players.join(', ') : '',
    });
  };

  const handleCancelEdit = () => {
    setEditingNode(null);
    setFormData({ node_id: '', title: '', time: getNextAvailableTime(nodes), length_mins: 0, node_type: 'node', detail: '', criteria: [], role_players: '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this node?")) return;
    await supabase.from('timeline_nodes').delete().eq('id', id);
    await supabase.from('audit_logs').insert({ user_id: user.id, action: 'DELETE_NODE', entity_type: 'timeline_nodes', entity_id: id });
    fetchNodes(selectedTemplate.id);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Timeline Builder</h2>
        {selectedTemplate && (
          <button onClick={() => setSelectedTemplate(null)} className="btn btn-primary">Back</button>
        )}
      </header>

      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Left Col: Template Selection & Node List */}
        <div style={{ flex: 1 }}>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Select Template</h3>
              <button className="btn" onClick={() => setShowNewTemplate(!showNewTemplate)}>
                {showNewTemplate ? 'Cancel' : '+ New Exercise'}
              </button>
            </div>
            
            {showNewTemplate ? (
              <form onSubmit={handleCreateTemplate} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input className="input" placeholder="Exercise Name" value={newTemplateForm.name} onChange={e => setNewTemplateForm({...newTemplateForm, name: e.target.value})} required />
                <input className="input" placeholder="Officer Rank (e.g., Station Commander)" value={newTemplateForm.officer_rank} onChange={e => setNewTemplateForm({...newTemplateForm, officer_rank: e.target.value})} required />
                <textarea className="input" placeholder="Description..." value={newTemplateForm.description} onChange={e => setNewTemplateForm({...newTemplateForm, description: e.target.value})} rows={3} required />
                <button type="submit" className="btn btn-primary">Create Exercise</button>
              </form>
            ) : (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <select className="input" onChange={(e) => selectTemplate(templates.find(t => t.id === e.target.value))} value={selectedTemplate?.id || ''} style={{ flex: 1 }}>
                  <option value="" disabled>-- Choose a template --</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {selectedTemplate && (
                  <button className="btn btn-danger" onClick={handleDeleteTemplate}>Delete Exercise</button>
                )}
              </div>
            )}
          </div>

          {selectedTemplate && !showNewTemplate && (
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h3>Clock Settings</h3>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label>Start Clocks Inject</label>
                  <select className="input" value={clockSettings.start_clock_node_id} onChange={e => setClockSettings({...clockSettings, start_clock_node_id: e.target.value})}>
                    <option value="">-- None --</option>
                    {nodes.map(n => <option key={n.id} value={n.node_id}>{n.title || n.node_id}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Start Time (HH:MM)</label>
                  <input className="input" placeholder="e.g. 15:22" value={clockSettings.start_clock_time} onChange={e => setClockSettings({...clockSettings, start_clock_time: e.target.value})} />
                </div>
                <button className="btn btn-primary" onClick={handleSaveClockSettings}>Save Settings</button>
              </div>
            </div>
          )}

          {selectedTemplate && (
            <div className="card">
              <h3>Timeline Nodes</h3>
              {nodes.map((node, i) => (
                <div key={node.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', marginBottom: '1rem', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{node.title} ({node.time})</strong>
                    <div>
                      <button onClick={() => handleEdit(node)} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem', marginRight: '0.5rem', fontSize: '0.8rem' }}>Edit</button>
                      <button onClick={() => handleDelete(node.id)} className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Delete</button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Type: {node.node_type} | ID: {node.node_id} | Length: {node.length_mins}m
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Node Editor Form */}
        {selectedTemplate && (
          <div style={{ flex: 1 }}>
            <div className="card">
              <h3>{editingNode ? 'Edit Node' : 'Add New Node'}</h3>
              <form onSubmit={handleSaveNode} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label>Node ID (e.g., 'inject-1')</label>
                  <input className="input" value={formData.node_id} onChange={e => setFormData({...formData, node_id: e.target.value})} required />
                </div>
                <div>
                  <label>Title</label>
                  <input className="input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label>Time (e.g., '15:32')</label>
                    <input className="input" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Length (Mins)</label>
                    <input type="number" className="input" value={formData.length_mins} onChange={e => setFormData({...formData, length_mins: parseInt(e.target.value, 10)})} />
                  </div>
                </div>
                <div>
                  <label>Node Type</label>
                  <select className="input" value={formData.node_type} onChange={e => setFormData({...formData, node_type: e.target.value})}>
                    <option value="node">Standard Node</option>
                    <option value="branch">Branch</option>
                    <option value="conditional">Conditional</option>
                  </select>
                </div>
                <div>
                  <label>Details (Comma separated)</label>
                  <textarea className="input" value={formData.detail} onChange={e => setFormData({...formData, detail: e.target.value})} rows={3} />
                </div>
                <div>
                  <label>Role Players (Comma separated)</label>
                  <input className="input" value={formData.role_players} onChange={e => setFormData({...formData, role_players: e.target.value})} />
                </div>
                <div>
                  <label>Criteria Settings</label>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    {Object.entries(categoryMap).map(([catName, catData]) => (
                      <div key={catName} style={{ marginBottom: '1rem' }}>
                        <strong style={{ color: catData.color }}>{catName}</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                          {catData.items.map(item => {
                            const isChecked = formData.criteria.includes(item);
                            return (
                              <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                <input 
                                  type="checkbox" 
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({ ...formData, criteria: [...formData.criteria, item] });
                                    } else {
                                      setFormData({ ...formData, criteria: formData.criteria.filter(c => c !== item) });
                                    }
                                  }}
                                />
                                {item}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Node</button>
                  {editingNode && (
                    <button type="button" className="btn" onClick={handleCancelEdit} style={{ flex: 1 }}>Cancel</button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
