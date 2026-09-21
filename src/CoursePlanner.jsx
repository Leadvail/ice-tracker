import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import Header from './Header';
import Sidebar from './Sidebar';

export default function CoursePlanner({ session }) {
  const navigate = useNavigate();
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Andy Vaillant';

  const [courses, setCourses] = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  
  const [courseDetails, setCourseDetails] = useState([]);
  const [activeDay, setActiveDay] = useState(null);
  const [viewSessionTab, setViewSessionTab] = useState('AM');
  const [expandedElements, setExpandedElements] = useState(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState(new Set());
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingMappings, setEditingMappings] = useState([]);
  const [competencyPool, setCompetencyPool] = useState([]);
  const [poolSearch, setPoolSearch] = useState('');
  const [poolPolicyFilter, setPoolPolicyFilter] = useState('');
  const [poolElementFilter, setPoolElementFilter] = useState('');
  const [poolHeadingFilter, setPoolHeadingFilter] = useState('');
  const [poolObjectiveFilter, setPoolObjectiveFilter] = useState('');
  const [activeTargetSlot, setActiveTargetSlot] = useState('Day 1 - AM');
  const [editModeTab, setEditModeTab] = useState('assigned');

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setIsLoadingCourses(true);
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('title', { ascending: true });
        
      if (error) throw error;
      setCourses(data || []);
      if (data && data.length > 0) {
        setActiveCourse(data[0]);
      }
    } catch (err) {
      console.error("Error fetching courses:", err);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  useEffect(() => {
    if (activeCourse) {
      fetchCourseDetails(activeCourse.title);
    } else {
      setCourseDetails([]);
    }
  }, [activeCourse]);

  const fetchCourseDetails = async (courseCode) => {
    setIsLoadingDetails(true);
    try {
      const { data, error } = await supabase
        .from('course_details')
        .select('*')
        .eq('course_code', courseCode);
        
      if (error) throw error;
      
      let detailsData = data || [];
      if (detailsData.length > 0) {
        const compIds = [...new Set(detailsData.map(d => d.comp_id).filter(Boolean))];
        const objectives = [...new Set(detailsData.map(d => d.learning_objective).filter(Boolean))];
        
        let compData = [];
        
        if (compIds.length > 0) {
          const { data: cData } = await supabase
            .from('competency_framework')
            .select('id, element_title, learning_objective, learning_outcome')
            .in('id', compIds);
          if (cData) compData.push(...cData);
        }
        
        if (objectives.length > 0) {
          const { data: oData } = await supabase
            .from('competency_framework')
            .select('id, element_title, learning_objective, learning_outcome')
            .in('learning_objective', objectives);
          if (oData) compData.push(...oData);
        }

        const compMap = {};
        const objMap = {};
        compData.forEach(c => {
          compMap[c.id] = c.learning_outcome;
          if (c.learning_objective && c.element_title) {
            objMap[`${c.element_title}::${c.learning_objective}`] = c.learning_outcome;
          }
        });
        
        detailsData = detailsData.map(d => ({
          ...d,
          learning_outcome: (d.comp_id && compMap[d.comp_id]) 
            ? compMap[d.comp_id] 
            : objMap[`${d.element_title}::${d.learning_objective}`]
        }));
      }
      
      setCourseDetails(detailsData);
      
      const uniqueDays = [...new Set(detailsData.map(row => row.day_number || ''))]
        .filter(Boolean)
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
          const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
          return numA - numB;
        });
      if (uniqueDays.length > 0) {
        setActiveDay(uniqueDays[0]);
      } else {
        setActiveDay(null);
      }
    } catch (err) {
      console.error("Error fetching course details:", err);
    } finally {
      setIsLoadingDetails(false);
    }
  };
  const [policies, setPolicies] = useState([]);

  const fetchCompetencyPool = async () => {
    try {
      const [compRes, polRes] = await Promise.all([
        supabase.from('competency_framework').select('*'),
        supabase.from('policies').select('*')
      ]);
      
      if (compRes.error) throw compRes.error;
      setCompetencyPool(compRes.data || []);
      
      if (polRes.error) throw polRes.error;
      setPolicies(polRes.data || []);
    } catch (err) {
      console.error("Error fetching competency pool or policies:", err);
    }
  };

  const openModal = async (course = null) => {
    await fetchCompetencyPool();
    if (course) {
      setEditingCourse({ ...course });
      // Fetch current mappings for this course
      const { data } = await supabase.from('course_details').select('*').eq('course_code', course.title);
      let detailsData = data || [];
      
      if (detailsData.length > 0) {
        const compIds = [...new Set(detailsData.map(d => d.comp_id).filter(Boolean))];
        const objectives = [...new Set(detailsData.map(d => d.learning_objective).filter(Boolean))];
        
        let compData = [];
        if (compIds.length > 0) {
          const { data: cData } = await supabase.from('competency_framework').select('id, element_title, learning_objective, learning_outcome').in('id', compIds);
          if (cData) compData.push(...cData);
        }
        if (objectives.length > 0) {
          const { data: oData } = await supabase.from('competency_framework').select('id, element_title, learning_objective, learning_outcome').in('learning_objective', objectives);
          if (oData) compData.push(...oData);
        }

        const compMap = {};
        const objMap = {};
        compData.forEach(c => {
          compMap[c.id] = c.learning_outcome;
          if (c.learning_objective && c.element_title) {
            objMap[`${c.element_title.trim()}::${c.learning_objective.trim()}`] = c.learning_outcome;
          }
        });
        
        detailsData = detailsData.map(d => ({
          ...d,
          learning_outcome: d.comp_id 
            ? compMap[d.comp_id] 
            : (objMap[`${d.element_title?.trim()}::${d.learning_objective?.trim()}`] || '')
        }));
      }

      setEditingMappings(detailsData);
      setEditModeTab('assigned');
    } else {
      setEditingCourse({
        title: '',
        course_title: '',
        staff_attending: '',
        course_description: '',
        course_duration: ''
      });
      setEditingMappings([]);
      setEditModeTab('search');
    }
    setActiveTargetSlot('Day 1 - AM');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCourse(null);
    setEditingMappings([]);
    setPoolSearch('');
    setPoolPolicyFilter('');
    setPoolElementFilter('');
    setPoolHeadingFilter('');
    setPoolObjectiveFilter('');
    setFilteredElements([]);
    setFilteredHeadings([]);
    setFilteredObjectives([]);
    setAvailableOutcomes([]);
    setCheckedOutcomes(new Set());
  };

  // --- Async Cascading Fetchers ---
  const [availableOutcomes, setAvailableOutcomes] = useState([]);
  const [checkedOutcomes, setCheckedOutcomes] = useState(new Set());
  const handlePolicyChange = async (e) => {
    const selectedPolicyNumber = e.target.value;
    setPoolPolicyFilter(selectedPolicyNumber);
    setPoolElementFilter('');
    setPoolHeadingFilter('');
    setPoolObjectiveFilter('');
    setFilteredElements([]);
    setFilteredHeadings([]);
    setFilteredObjectives([]);
    setAvailableOutcomes([]);
    setCheckedOutcomes(new Set());

    if (selectedPolicyNumber) {
      const { data, error } = await supabase
        .from('competency_framework')
        .select('element_title')
        .eq('policy_id', selectedPolicyNumber);
        
      if (error) {
        console.error("Error fetching elements:", error);
      } else {
        const uniqueElements = [...new Set(data.map(item => item.element_title).filter(Boolean))].sort();
        setFilteredElements(uniqueElements);
        console.log("Fetched Elements for Policy:", selectedPolicyNumber, data);
      }
    }
  };

  const handleElementChange = async (e) => {
    const selectedElement = e.target.value;
    setPoolElementFilter(selectedElement);
    setPoolHeadingFilter('');
    setPoolObjectiveFilter('');
    setFilteredHeadings([]);
    setFilteredObjectives([]);
    setAvailableOutcomes([]);

    if (selectedElement && poolPolicyFilter) {
      const { data, error } = await supabase
        .from('competency_framework')
        .select('learning_heading')
        .eq('policy_id', poolPolicyFilter)
        .eq('element_title', selectedElement);
        
      if (!error) {
        setFilteredHeadings([...new Set(data.map(item => item.learning_heading).filter(Boolean))].sort());
      }
    }
  };

  const handleHeadingChange = async (e) => {
    const selectedHeading = e.target.value;
    setPoolHeadingFilter(selectedHeading);
    setPoolObjectiveFilter('');
    setFilteredObjectives([]);
    setAvailableOutcomes([]);

    if (selectedHeading && poolPolicyFilter && poolElementFilter) {
      const { data, error } = await supabase
        .from('competency_framework')
        .select('learning_objective')
        .eq('policy_id', poolPolicyFilter)
        .eq('element_title', poolElementFilter)
        .eq('learning_heading', selectedHeading);
        
      if (!error) {
        setFilteredObjectives([...new Set(data.map(item => item.learning_objective).filter(Boolean))].sort());
      }
    }
  };

  const handleObjectiveChange = async (e) => {
    const selectedObjective = e.target.value;
    setPoolObjectiveFilter(selectedObjective);
    setAvailableOutcomes([]);

    if (selectedObjective && poolPolicyFilter && poolElementFilter && poolHeadingFilter) {
      const { data, error } = await supabase
        .from('competency_framework')
        .select('id, learning_outcome, element_title, learning_objective, policy_id')
        .eq('policy_id', poolPolicyFilter)
        .eq('element_title', poolElementFilter)
        .eq('learning_heading', poolHeadingFilter)
        .eq('learning_objective', selectedObjective);

      if (!error && data) {
        setAvailableOutcomes(data);
      }
    }
  };



  const handleDeleteCourse = async () => {
    if (!editingCourse.id) return;
    const originalCourse = courses.find(c => c.id === editingCourse.id);
    const originalTitle = originalCourse ? originalCourse.title : editingCourse.title;

    if (window.confirm(`Are you sure you want to delete the course "${originalTitle}"? This will permanently remove the course and all its assigned learning outcomes.`)) {
      setIsSaving(true);
      try {
        const { error: detailsError } = await supabase
          .from('course_details')
          .delete()
          .eq('course_code', originalTitle);
        if (detailsError) throw detailsError;

        const { error: courseError } = await supabase
          .from('courses')
          .delete()
          .eq('id', editingCourse.id);
        if (courseError) throw courseError;

        if (activeCourse?.id === editingCourse.id) {
          setActiveCourse(null);
          setCourseDetails([]);
        }

        await fetchCourses();
        closeModal();
      } catch (err) {
        console.error("Error deleting course:", err);
        alert("Failed to delete course: " + err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!editingCourse.title) {
      alert("Course Code is required.");
      return;
    }
    setIsSaving(true);
    try {
      // 1. Insert or update course metadata
      const payload = {
        title: editingCourse.title,
        course_title: editingCourse.course_title,
        staff_attending: editingCourse.staff_attending,
        course_description: editingCourse.course_description,
        course_duration: editingCourse.course_duration
      };
      
      let courseError = null;
      if (editingCourse.id) {
        const res = await supabase.from('courses').update(payload).eq('id', editingCourse.id);
        courseError = res.error;
      } else {
        const res = await supabase.from('courses').insert([payload]);
        courseError = res.error;
      }
      
      if (courseError) throw courseError;

      const originalCourse = courses.find(c => c.id === editingCourse.id);
      const originalTitle = originalCourse ? originalCourse.title : editingCourse.title;

      // 2. Delete existing mappings using original title
      const { error: deleteError } = await supabase
        .from('course_details')
        .delete()
        .eq('course_code', originalTitle);
      if (deleteError) throw deleteError;

      // 3. Insert new mappings
      if (editingMappings.length > 0) {
        // Prepare bulk insert
        const inserts = editingMappings.map(m => ({
          course_code: editingCourse.title,
          day_number: m.day_number,
          session: m.session,
          comp_id: m.comp_id,
          element_title: m.element_title,
          learning_objective: m.learning_objective
        }));
        const { error: insertError } = await supabase
          .from('course_details')
          .insert(inserts);
        if (insertError) throw insertError;
      }

      closeModal();
      await fetchCourses();
      if (activeCourse?.title === editingCourse.title) {
        fetchCourseDetails(editingCourse.title);
      }
    } catch (err) {
      console.error("Error saving course:", err);
      alert("Failed to save course. Check console for details.");
    } finally {
      setIsSaving(false);
    }
  };

  const uniqueDaysList = useMemo(() => {
    return [...new Set(courseDetails.map(row => row.day_number || ''))]
      .filter(Boolean)
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
  }, [courseDetails]);

  const activeDayStats = useMemo(() => {
    if (activeDay === null) return { total: 0, morning: 0, afternoon: 0 };
    
    const dayRows = courseDetails.filter(r => r.day_number === activeDay);
    const morningCount = dayRows.filter(r => r.session === 'AM').length;
    const afternoonCount = dayRows.filter(r => r.session === 'PM').length;
    
    return {
      total: dayRows.length,
      morning: morningCount,
      afternoon: afternoonCount
    };
  }, [courseDetails, activeDay]);

  // Cascading Filter Logic States
  const [filteredElements, setFilteredElements] = useState([]);
  const [filteredHeadings, setFilteredHeadings] = useState([]);
  const [filteredObjectives, setFilteredObjectives] = useState([]);

  const getFirstLine = (text) => {
    if (!text) return '';
    return text.split('\n')[0].trim();
  };

  const renderGroupedOutcomes = (outcomes, isEditMode = false) => {
    if (!outcomes || outcomes.length === 0) return null;
    
    // Group by Element -> Objective -> Items
    const grouped = outcomes.reduce((acc, r) => {
      const elKey = r.element_title;
      if (!acc[elKey]) {
        acc[elKey] = {
          element_title: r.element_title,
          objectives: {}
        };
      }
      
      const objKey = r.learning_objective;
      if (!acc[elKey].objectives[objKey]) {
        acc[elKey].objectives[objKey] = {
          learning_objective: r.learning_objective,
          items: []
        };
      }
      
      acc[elKey].objectives[objKey].items.push(r);
      return acc;
    }, {});

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {Object.entries(grouped).map(([elKey, elGroup]) => {
          const isElExpanded = expandedElements.has(elKey);
          
          return (
            <div key={elKey} style={{ border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#fff', overflow: 'hidden' }}>
              {/* Element Header */}
              <div 
                onClick={() => {
                  setExpandedElements(prev => {
                    const n = new Set(prev);
                    if (n.has(elKey)) n.delete(elKey);
                    else n.add(elKey);
                    return n;
                  });
                }}
                style={{ padding: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isElExpanded ? '#f3f4f6' : '#fff', transition: 'background-color 0.2s', borderBottom: isElExpanded ? '1px solid #d1d5db' : 'none' }}
              >
                <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '1rem' }}>
                  {elGroup.element_title}
                </div>
                <div style={{ color: '#6b7280', fontSize: '1.2rem', transform: isElExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>
                  ▼
                </div>
              </div>
              
              {/* Objectives List */}
              {isElExpanded && (
                <div style={{ padding: '0.5rem 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#f9fafb' }}>
                  {Object.entries(elGroup.objectives).map(([objKey, objGroup]) => {
                    const fullObjKey = `${elKey}::${objKey}`;
                    const isObjExpanded = expandedObjectives.has(fullObjKey);
                    
                    return (
                      <div key={fullObjKey} style={{ border: '1px solid #e5e7eb', borderRadius: '4px', backgroundColor: '#fff', overflow: 'hidden' }}>
                        <div 
                          onClick={() => {
                            setExpandedObjectives(prev => {
                              const n = new Set(prev);
                              if (n.has(fullObjKey)) n.delete(fullObjKey);
                              else n.add(fullObjKey);
                              return n;
                            });
                          }}
                          style={{ padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isObjExpanded ? '#f9fafb' : '#fff', transition: 'background-color 0.2s' }}
                        >
                          <div style={{ color: '#4b5563', fontSize: '0.9rem', fontStyle: 'italic' }}>
                            {objGroup.learning_objective} ({objGroup.items.length} outcomes)
                          </div>
                          <div style={{ color: '#9ca3af', fontSize: '1rem', transform: isObjExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>
                            ▼
                          </div>
                        </div>
                        
                        {isObjExpanded && (
                          <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {objGroup.items.map((r, i) => (
                              <div key={r.id || r.comp_id || i} style={{ color: '#111827', fontSize: '0.9rem', padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '4px', borderLeft: '3px solid #d1d5db', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>{r.learning_outcome || 'No outcome text provided.'}</div>
                                {isEditMode && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
                                    <span style={{ fontWeight: 'bold', color: '#374151', backgroundColor: '#e5e7eb', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem' }}>
                                      {r.day_number} {r.session && `- ${r.session}`}
                                    </span>
                                    <button 
                                      onClick={() => setEditingMappings(prev => prev.filter(item => item !== r))}
                                      style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#F9FAFB', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      <Header />

      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        <Sidebar session={session} />

        {/* Main Content Workspace */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#F9FAFB', overflow: 'hidden' }}>
          
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Header Area */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#111827' }} title="Back to Portal Home">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                </button>
                <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#111827', fontWeight: 700 }}>Course Planner</h1>
                {activeCourse && (
                  <div style={{ marginLeft: '1rem', color: '#4b5563', fontSize: '1.1rem', fontStyle: 'italic' }}>
                    {activeCourse.title} - {getFirstLine(activeCourse.course_description)} -
                  </div>
                )}
              </div>
            </div>

      {/* Main Split Layout Inner */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: '1.5rem', boxSizing: 'border-box' }}>
        
        {/* Left Column: Master Directory Layout */}
        <div style={{ 
          flex: '0 0 55%', 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: '#fff', 
          borderRadius: '8px', 
          border: '1px solid #e5e7eb', 
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#111827' }}>Select a course to view:</h2>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }} className="cinematic-scroll">
            {isLoadingCourses ? (
              <div style={{ padding: '1rem', color: '#374151', fontStyle: 'italic' }}>Loading courses...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {courses.map(course => {
                  const isActive = activeCourse?.title === course.title;
                  return (
                    <div 
                      key={course.title}
                      onClick={() => setActiveCourse(course)}
                      style={{
                        padding: '1.5rem',
                        cursor: 'pointer',
                        borderLeft: isActive ? '4px solid #111827' : '4px solid transparent',
                        backgroundColor: isActive ? '#F9FAFB' : '#fff',
                        borderTop: '1px solid #f1f3f5',
                        borderRight: '1px solid #f1f3f5',
                        borderBottom: '1px solid #f1f3f5',
                        borderRadius: '0 4px 4px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ fontWeight: 'bold', width: '150px', color: '#111827' }}>Course Code:</div>
                        <div style={{ color: '#374151' }}>{course.title}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ fontWeight: 'bold', width: '150px', color: '#111827' }}>Staff Attending:</div>
                        <div style={{ color: '#374151' }}>{course.staff_attending}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ fontWeight: 'bold', width: '150px', color: '#111827' }}>Course Description:</div>
                        <div style={{ color: '#374151', whiteSpace: 'pre-line', flex: 1 }}>{course.course_description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
              {/* Action Placeholder */}
              <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
                <button 
                  onClick={() => openModal()}
                  style={{
                  backgroundColor: '#111827',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem 2rem',
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}>
                  Create New Course
                </button>
              </div>
            </div>

            {/* Right Column: Cascading Schedule Matrix */}
            <div style={{ 
              flex: '1', 
              display: 'flex', 
              flexDirection: 'column', 
              backgroundColor: '#fff', 
              borderRadius: '8px', 
              border: '1px solid #e5e7eb',
              overflow: 'hidden'
            }}>
              {activeCourse ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  
                  <div style={{ padding: '2rem 3rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                      <h2 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '900', color: '#111827', marginBottom: '0.5rem', letterSpacing: '-0.5px' }}>
                        {activeCourse.title}
                      </h2>
                      <div style={{ fontSize: '1.1rem', color: '#4b5563', lineHeight: '1.6', maxWidth: '85%', margin: '0 auto' }}>
                        {getFirstLine(activeCourse.course_description)}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '1.1rem', color: '#111827' }}>
                      <span style={{ color: '#374151' }}>Course Duration:</span> <span style={{ fontWeight: 'bold' }}>{uniqueDaysList.length} Days</span>
                    </div>
                    <div style={{ fontSize: '1.1rem', color: '#111827' }}>
                      <span style={{ color: '#374151' }}>Total Learning Outcomes:</span> <span style={{ fontWeight: 'bold' }}>{courseDetails.length}</span>
                    </div>
                  </div>

                  {/* Slider Navigation */}
                  <div style={{ padding: '2rem 3rem 0 3rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '4px solid #dee2e6', gap: '2rem', paddingBottom: '0.5rem' }}>
                      {uniqueDaysList.map(day => {
                        const isActive = activeDay === day;
                        return (
                          <div 
                            key={day}
                            onClick={() => setActiveDay(day)}
                            style={{
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '1.1rem',
                              color: isActive ? '#111827' : '#111827',
                              position: 'relative',
                              paddingBottom: '0.5rem',
                              marginBottom: '-0.7rem' // Pull down to cover border
                            }}
                          >
                            {day}
                            {isActive && (
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', backgroundColor: '#111827' }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Session Metrics Summary */}
                  {activeDay !== null && (
                    <div style={{ padding: '2rem 3rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto' }} className="cinematic-scroll">
                      <div style={{ display: 'flex', gap: '2rem' }}>
                        <div style={{ fontWeight: 'bold', width: '150px', textAlign: 'right', color: '#111827' }}>Selected:</div>
                        <div style={{ color: '#374151' }}>{activeDay}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '2rem' }}>
                        <div style={{ fontWeight: 'bold', width: '150px', textAlign: 'right', color: '#111827' }}>Total Outcomes:</div>
                        <div style={{ color: '#374151' }}>{activeDayStats.total}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 'bold', width: '150px', textAlign: 'right', color: '#111827' }}>Session:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ fontStyle: 'italic', color: '#111827', width: '80px', textAlign: 'right' }}>Morning:</div>
                            <div style={{ color: '#374151' }}>{activeDayStats.morning}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ fontStyle: 'italic', color: '#111827', width: '80px', textAlign: 'right' }}>Afternoon:</div>
                            <div style={{ color: '#374151' }}>{activeDayStats.afternoon}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Detailed Allocated Outcomes UI Placeholder */}
                      <div style={{ marginTop: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e7eb', marginBottom: '1rem' }}>
                          <h3 style={{ fontSize: '1.2rem', color: '#111827', margin: 0, paddingBottom: '0.5rem' }}>Assigned Learning Outcomes</h3>
                          
                          {activeDay !== 'PCL' && (
                            <div style={{ display: 'flex', gap: '1rem' }}>
                              <button 
                                onClick={() => setViewSessionTab('AM')}
                                style={{ 
                                  background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer',
                                  fontWeight: 'bold', fontSize: '0.95rem',
                                  color: viewSessionTab === 'AM' ? '#047857' : '#6b7280',
                                  borderBottom: viewSessionTab === 'AM' ? '3px solid #047857' : '3px solid transparent',
                                  marginBottom: '-2px'
                                }}
                              >
                                AM Session
                              </button>
                              <button 
                                onClick={() => setViewSessionTab('PM')}
                                style={{ 
                                  background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer',
                                  fontWeight: 'bold', fontSize: '0.95rem',
                                  color: viewSessionTab === 'PM' ? '#b91c1c' : '#6b7280',
                                  borderBottom: viewSessionTab === 'PM' ? '3px solid #b91c1c' : '3px solid transparent',
                                  marginBottom: '-2px'
                                }}
                              >
                                PM Session
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Session Blocks */}
                        {activeDay === 'PCL' ? (
                          renderGroupedOutcomes(courseDetails.filter(r => r.day_number === activeDay && r.session === 'PCL'))
                        ) : (
                          renderGroupedOutcomes(courseDetails.filter(r => r.day_number === activeDay && r.session === viewSessionTab))
                        )}
                        
                        {courseDetails.filter(r => r.day_number === activeDay).length === 0 && (
                          <div style={{ color: '#6b7280', fontStyle: 'italic' }}>No outcomes assigned to this day.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Placeholder */}
                  <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fff', marginTop: 'auto' }}>
                    <button 
                      onClick={() => openModal(activeCourse)}
                      style={{
                      backgroundColor: '#111827',
                      color: '#fff',
                      border: 'none',
                      padding: '0.75rem 2rem',
                      borderRadius: '20px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}>
                      Edit Course
                    </button>
                  </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: '#374151', fontStyle: 'italic' }}>
              {isLoadingCourses ? 'Loading...' : 'Select a course from the left panel.'}
            </div>
          )}
        </div>
      </div>
      
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(17, 24, 39, 0.7)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem'
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '1400px', height: '90vh',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#111827', fontWeight: 'bold' }}>
                {editingCourse.id ? 'Edit Course' : 'Create New Course'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '0.5rem' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* Left Pane: Course Metadata */}
              <div style={{ flex: '0 0 35%', padding: '2rem', borderRight: '1px solid #e5e7eb', overflowY: 'auto' }} className="cinematic-scroll">
                <h3 style={{ margin: '0 0 1.5rem 0', color: '#111827', fontSize: '1.2rem' }}>Course Details</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#374151', fontSize: '0.9rem' }}>Course Code <span style={{ color: '#ef4444' }}>*</span></label>
                    <input 
                      type="text" 
                      value={editingCourse.title} 
                      onChange={(e) => setEditingCourse({...editingCourse, title: e.target.value.toUpperCase()})}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box' }}
                      placeholder="e.g. IC1SUB"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#374151', fontSize: '0.9rem' }}>Course Title</label>
                    <input 
                      type="text" 
                      value={editingCourse.course_title} 
                      onChange={(e) => setEditingCourse({...editingCourse, course_title: e.target.value})}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#374151', fontSize: '0.9rem' }}>Staff Attending</label>
                    <input 
                      type="text" 
                      value={editingCourse.staff_attending} 
                      onChange={(e) => setEditingCourse({...editingCourse, staff_attending: e.target.value})}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#374151', fontSize: '0.9rem' }}>Course Duration</label>
                    <input 
                      type="text" 
                      value={editingCourse.course_duration} 
                      onChange={(e) => setEditingCourse({...editingCourse, course_duration: e.target.value})}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box' }}
                      placeholder="e.g. 5 Day"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#374151', fontSize: '0.9rem' }}>Course Description</label>
                    <textarea 
                      value={editingCourse.course_description} 
                      onChange={(e) => setEditingCourse({...editingCourse, course_description: e.target.value})}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '1rem', minHeight: '120px', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Pane: Outcome Sequencer / Assigned Outcomes */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#F9FAFB' }}>
                  <button 
                    onClick={() => setEditModeTab('assigned')}
                    style={{ flex: 1, padding: '1rem', fontWeight: 'bold', background: 'none', border: 'none', borderBottom: editModeTab === 'assigned' ? '3px solid #111827' : '3px solid transparent', color: editModeTab === 'assigned' ? '#111827' : '#6b7280', fontSize: '1.1rem', cursor: 'pointer', outline: 'none' }}
                  >
                    Assigned Outcomes ({editingMappings.length})
                  </button>
                  <button 
                    onClick={() => setEditModeTab('search')}
                    style={{ flex: 1, padding: '1rem', fontWeight: 'bold', background: 'none', border: 'none', borderBottom: editModeTab === 'search' ? '3px solid #111827' : '3px solid transparent', color: editModeTab === 'search' ? '#111827' : '#6b7280', fontSize: '1.1rem', cursor: 'pointer', outline: 'none' }}
                  >
                    Add New Outcomes
                  </button>
                </div>

                {editModeTab === 'assigned' ? (
                  <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }} className="cinematic-scroll">
                    {editingMappings.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#6b7280', fontStyle: 'italic', marginTop: '2rem' }}>No outcomes assigned yet. Switch to "Add New Outcomes" to begin.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {renderGroupedOutcomes([...editingMappings].sort((a, b) => {
                           if (a.day_number !== b.day_number) return (a.day_number || '').localeCompare(b.day_number || '');
                           return (a.session || '').localeCompare(b.session || '');
                        }), true)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ padding: '2rem 2rem 1rem 2rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#F9FAFB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, color: '#111827', fontSize: '1.2rem' }}>Outcome Sequencer</h3>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: '#374151', fontSize: '0.9rem' }}>Target Slot:</span>
                          <select 
                            value={activeTargetSlot}
                            onChange={(e) => setActiveTargetSlot(e.target.value)}
                            style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #d1d5db', fontWeight: 'bold', color: '#111827' }}
                          >
                            <option value="PCL">Pre-Course Learning (PCL)</option>
                            {[...Array(10)].map((_, i) => (
                              <React.Fragment key={i}>
                                <option value={`Day ${i+1} - AM`}>Day {i+1} - AM</option>
                                <option value={`Day ${i+1} - PM`}>Day {i+1} - PM</option>
                              </React.Fragment>
                            ))}
                          </select>
                          <span style={{ backgroundColor: '#111827', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                            {(() => {
                              const targetDay = activeTargetSlot === 'PCL' ? 'PCL' : activeTargetSlot.split(' - ')[0];
                              const targetSession = activeTargetSlot === 'PCL' ? 'PCL' : activeTargetSlot.split(' - ')[1];
                              return editingMappings.filter(m => m.day_number === targetDay && m.session === targetSession).length;
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Pool Filters */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Search Bar */}
                        <input 
                          type="text" 
                          placeholder="Search competencies (optional)..."
                          value={poolSearch}
                          onChange={(e) => setPoolSearch(e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }}
                        />
                        
                        {/* Cascading Dropdowns */}
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <select
                            value={poolPolicyFilter}
                            onChange={handlePolicyChange}
                            style={{ flex: '1 1 200px', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.95rem' }}
                          >
                            <option value="">1. Select Policy</option>
                            {policies
                              .filter(pol => !pol.reference || pol.reference === 'CompetencyFramework')
                              .sort((a, b) => a.policy_number.localeCompare(b.policy_number))
                              .map(pol => (
                                <option key={pol.policy_number} value={pol.policy_number}>
                                  {`${pol.policy_number} - ${pol.policy_name}`}
                                </option>
                              ))
                            }
                          </select>

                          <select
                            value={poolElementFilter}
                            onChange={handleElementChange}
                            disabled={!poolPolicyFilter}
                            style={{ flex: '1 1 200px', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.95rem', backgroundColor: !poolPolicyFilter ? '#f3f4f6' : '#fff' }}
                          >
                            <option value="">2. Select Element</option>
                            {filteredElements.map(e => (
                              <option key={e} value={e}>{e}</option>
                            ))}
                          </select>

                          <select
                            value={poolHeadingFilter}
                            onChange={handleHeadingChange}
                            disabled={!poolElementFilter}
                            style={{ flex: '1 1 200px', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.95rem', backgroundColor: !poolElementFilter ? '#f3f4f6' : '#fff' }}
                          >
                            <option value="">3. Select Heading</option>
                            {filteredHeadings.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>

                          <select
                            value={poolObjectiveFilter}
                            onChange={handleObjectiveChange}
                            disabled={!poolHeadingFilter}
                            style={{ flex: '1 1 200px', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.95rem', backgroundColor: !poolHeadingFilter ? '#f3f4f6' : '#fff' }}
                          >
                            <option value="">4. Select Objective</option>
                            {filteredObjectives.map(o => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: 1, padding: '1rem 2rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      {(() => {
                        let outcomesToRender = [];
                        if (availableOutcomes.length > 0) {
                          outcomesToRender = availableOutcomes;
                        } else if (poolSearch) {
                          outcomesToRender = competencyPool.filter(c => {
                            if (poolPolicyFilter && c.policy_id !== poolPolicyFilter) return false;
                            if (poolElementFilter && c.element_title !== poolElementFilter) return false;
                            if (poolHeadingFilter && c.learning_heading !== poolHeadingFilter) return false;
                            if (poolObjectiveFilter && c.learning_objective !== poolObjectiveFilter) return false;
                            
                            const searchLower = poolSearch.toLowerCase();
                            return (c.element_title?.toLowerCase().includes(searchLower) || 
                                    c.learning_objective?.toLowerCase().includes(searchLower) ||
                                    c.policy_id?.toLowerCase().includes(searchLower) ||
                                    c.learning_outcome?.toLowerCase().includes(searchLower));
                          });
                        }

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', marginBottom: '0.5rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', color: '#111827' }}>
                                <input 
                                  type="checkbox" 
                                  checked={
                                    outcomesToRender.length > 0 && 
                                    outcomesToRender.every(comp => {
                                      const targetDay = activeTargetSlot === 'PCL' ? 'PCL' : activeTargetSlot.split(' - ')[0];
                                      const targetSession = activeTargetSlot === 'PCL' ? 'PCL' : activeTargetSlot.split(' - ')[1];
                                      const existingMapping = editingMappings.find(m => 
                                        (m.comp_id && m.comp_id == comp.id) || 
                                        (m.element_title?.trim() === comp.element_title?.trim() && m.learning_objective?.trim() === comp.learning_objective?.trim())
                                      );
                                      return existingMapping?.day_number === targetDay && existingMapping?.session === targetSession;
                                    })
                                  }
                                  onChange={(e) => {
                                    const targetDay = activeTargetSlot === 'PCL' ? 'PCL' : activeTargetSlot.split(' - ')[0];
                                    const targetSession = activeTargetSlot === 'PCL' ? 'PCL' : activeTargetSlot.split(' - ')[1];
                                    if (e.target.checked) {
                                      const newMappings = outcomesToRender
                                        .filter(comp => {
                                          const existingMapping = editingMappings.find(m => 
                                            (m.comp_id && m.comp_id == comp.id) || 
                                            (m.element_title?.trim() === comp.element_title?.trim() && m.learning_objective?.trim() === comp.learning_objective?.trim())
                                          );
                                          return !(existingMapping?.day_number === targetDay && existingMapping?.session === targetSession);
                                        })
                                        .map(comp => ({
                                          day_number: targetDay,
                                          session: targetSession,
                                          comp_id: comp.id,
                                          element_title: comp.element_title,
                                          learning_objective: comp.learning_objective,
                                          learning_outcome: comp.learning_outcome
                                        }));
                                      
                                      setEditingMappings(prev => {
                                        // filter out any old legacy matches before adding new ones
                                        const newlyAddedCompIds = new Set(newMappings.map(n => n.comp_id));
                                        const filtered = prev.filter(m => {
                                          if (newlyAddedCompIds.has(m.comp_id)) return false;
                                          if (!m.comp_id && newMappings.some(n => n.element_title?.trim() === m.element_title?.trim() && n.learning_objective?.trim() === m.learning_objective?.trim())) return false;
                                          return true;
                                        });
                                        return [...filtered, ...newMappings];
                                      });
                                    } else {
                                      setEditingMappings(prev => prev.filter(m => {
                                         const isHere = m.day_number === targetDay && m.session === targetSession;
                                         const isRendered = outcomesToRender.some(c => c.id == m.comp_id || (c.element_title?.trim() === m.element_title?.trim() && c.learning_objective?.trim() === m.learning_objective?.trim()));
                                         return !(isHere && isRendered);
                                      }));
                                    }
                                  }} 
                                  style={{ width: '16px', height: '16px' }}
                                /> Select All in {activeTargetSlot}
                              </label>
                            </div>
                            
                            <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', maxHeight: '280px', overflowY: 'auto' }} className="cinematic-scroll">
                              {outcomesToRender.map(comp => {
                                const targetDay = activeTargetSlot === 'PCL' ? 'PCL' : activeTargetSlot.split(' - ')[0];
                                const targetSession = activeTargetSlot === 'PCL' ? 'PCL' : activeTargetSlot.split(' - ')[1];
                                
                                const existingMapping = editingMappings.find(m => 
                                  (m.comp_id && m.comp_id == comp.id) || 
                                  (m.element_title?.trim() === comp.element_title?.trim() && m.learning_objective?.trim() === comp.learning_objective?.trim())
                                );
                                
                                const isAssignedHere = existingMapping?.day_number === targetDay && existingMapping?.session === targetSession;
                                const isAssignedElsewhere = existingMapping && !isAssignedHere;

                                const handleCheckboxChange = () => {
                                  if (isAssignedHere) {
                                    setEditingMappings(prev => prev.filter(m => m !== existingMapping));
                                  } else {
                                    setEditingMappings(prev => {
                                      const filtered = prev.filter(m => m !== existingMapping);
                                      return [...filtered, {
                                        day_number: targetDay,
                                        session: targetSession,
                                        comp_id: comp.id,
                                        element_title: comp.element_title,
                                        learning_objective: comp.learning_objective,
                                        learning_outcome: comp.learning_outcome
                                      }];
                                    });
                                  }
                                };

                                return (
                                  <div key={comp.id} style={{ 
                                    display: 'flex', padding: '1rem', borderBottom: '1px solid #e5e7eb',
                                    backgroundColor: isAssignedHere ? '#F3F4F6' : '#fff',
                                    opacity: isAssignedElsewhere ? 0.6 : 1,
                                    transition: 'all 0.2s',
                                    cursor: 'pointer'
                                  }}
                                  onClick={handleCheckboxChange}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '0.2rem', paddingRight: '1rem' }}>
                                      <input 
                                        type="checkbox" 
                                        checked={isAssignedHere}
                                        readOnly
                                        style={{ width: '18px', height: '18px', cursor: 'pointer', pointerEvents: 'none' }}
                                      />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 'bold' }}>
                                          {(() => {
                                            const pObj = policies.find(p => p.policy_number === comp.policy_id);
                                            return pObj ? `${comp.policy_id} - ${pObj.policy_name}` : comp.policy_id;
                                          })()}
                                        </span>
                                        {isAssignedElsewhere && (
                                          <span style={{ fontSize: '0.75rem', backgroundColor: '#fef3c7', color: '#d97706', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' }}>
                                            Assigned: {existingMapping.day_number} ({existingMapping.session})
                                          </span>
                                        )}
                                        {isAssignedHere && (
                                          <span style={{ fontSize: '0.75rem', backgroundColor: '#d1fae5', color: '#047857', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' }}>
                                            Assigned to {activeTargetSlot}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                                        {comp.element_title || 'Unnamed Element'}
                                      </div>
                                      <div style={{ color: '#4b5563', fontSize: '0.9rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                                        {comp.learning_objective || 'Unnamed Objective'}
                                      </div>
                                      <div style={{ color: '#111827', fontSize: '0.95rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '4px', borderLeft: '3px solid #d1d5db' }}>
                                        {comp.learning_outcome || 'No outcome text provided.'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {outcomesToRender.length === 0 && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontStyle: 'italic' }}>
                                  {poolSearch || poolObjectiveFilter ? 'No learning outcomes match the selected filters.' : 'Use the dropdowns or search bar above to load learning outcomes.'}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1.5rem 2rem', backgroundColor: '#F9FAFB', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {editingCourse.id && (
                  <button 
                    onClick={handleDeleteCourse}
                    style={{ padding: '0.75rem 1.5rem', borderRadius: '4px', border: '1px solid #ef4444', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                    disabled={isSaving}
                  >
                    Delete Course
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={closeModal}
                  style={{ padding: '0.75rem 2rem', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', color: '#374151' }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  style={{ padding: '0.75rem 2.5rem', borderRadius: '4px', border: 'none', backgroundColor: '#111827', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save & Publish Course'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

          </div>
        </div>
      </div>

      <style>
        {`
          .cinematic-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
          .cinematic-scroll::-webkit-scrollbar-track { background: #f1f3f5; border-radius: 4px; }
          .cinematic-scroll::-webkit-scrollbar-thumb { background: #ced4da; border-radius: 4px; }
          .cinematic-scroll::-webkit-scrollbar-thumb:hover { background: #adb5bd; }
        `}
      </style>
    </div>
  );
}
