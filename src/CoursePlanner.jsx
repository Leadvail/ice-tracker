import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';

export default function CoursePlanner({ session }) {
  const navigate = useNavigate();
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Andy Vaillant';

  const [courses, setCourses] = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  
  const [courseDetails, setCourseDetails] = useState([]);
  const [activeDay, setActiveDay] = useState(null);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

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
      setCourseDetails(data || []);
      
      const uniqueDays = [...new Set(data.map(row => row.day_number || ''))]
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

  const getFirstLine = (text) => {
    if (!text) return '';
    return text.split('\n')[0].trim();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#F9FAFB', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 2rem',
        height: '60px',
        backgroundColor: '#F9FAFB',
        borderBottom: '2px solid #e9ecef',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#003399' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </button>
          <h1 style={{ margin: 0, color: '#003399', fontSize: '1.4rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>Course Planner</h1>
          
          {activeCourse && (
            <div style={{ marginLeft: '2rem', color: '#111827', fontWeight: 'bold', fontSize: '1.1rem' }}>
              {activeCourse.title} - {getFirstLine(activeCourse.course_description)} -
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#111827', fontSize: '0.95rem' }}>{userName}</span>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #ccc' }}>
            <span style={{ fontSize: '1.3rem' }}>🧑‍🚒</span>
          </div>
        </div>
      </div>

      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '1.5rem', gap: '1.5rem', boxSizing: 'border-box' }}>
        
        {/* Left Column: Master Directory Layout */}
        <div style={{ 
          flex: '0 0 55%', 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: '#fff', 
          borderRadius: '8px', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)', 
          border: '1px solid #dee2e6', 
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #dee2e6' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>Select a course to view:</h2>
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
                        borderLeft: isActive ? '4px solid #003399' : '4px solid transparent',
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
          <div style={{ padding: '1.5rem', borderTop: '1px solid #dee2e6', backgroundColor: '#fff' }}>
            <button style={{
              backgroundColor: '#00205b',
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
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)', 
          border: '1px solid #dee2e6',
          overflow: 'hidden'
        }}>
          {activeCourse ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              <div style={{ padding: '2rem 3rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h2 style={{ margin: 0, textAlign: 'center', fontSize: '1.6rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
                  {activeCourse.title} - {getFirstLine(activeCourse.course_description)}
                </h2>
                
                <div style={{ fontSize: '1.1rem', color: '#111827' }}>
                  <span style={{ color: '#374151' }}>Course Duration:</span> <span style={{ fontWeight: 'bold' }}>{uniqueDaysList.length} Days</span>
                </div>
                <div style={{ fontSize: '1.1rem', color: '#111827' }}>
                  <span style={{ color: '#374151' }}>Total Learning Outcomes:</span> <span style={{ fontWeight: 'bold' }}>{courseDetails.length}</span>
                </div>
              </div>

              {/* Slider Navigation */}
              <div style={{ padding: '2rem 3rem 0 3rem' }}>
                <div style={{ display: 'flex', borderBottom: '4px solid #dee2e6', gap: '2rem', paddingBottom: '0.5rem', overflowX: 'auto' }} className="cinematic-scroll">
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
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', backgroundColor: '#003399' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Session Metrics Summary */}
              {activeDay !== null && (
                <div style={{ padding: '2rem 3rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
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
                </div>
              )}

              {/* Action Placeholder */}
              <div style={{ padding: '1.5rem', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fff', marginTop: 'auto' }}>
                <button style={{
                  backgroundColor: '#00205b',
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
