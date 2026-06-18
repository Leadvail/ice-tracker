import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from './supabase';

// Dynamic Options Parser for Criteria
const getCriteriaOptions = (critRow) => {
  if (!critRow) return [];
  if (critRow.options_json && Array.isArray(critRow.options_json)) {
    return critRow.options_json.map(o => ({ text: o.text || o.label || o.option, score: Number(o.score || o.weight) }));
  }
  const opts = [];
  for (let i = 1; i <= 5; i++) {
    const text = critRow[`option${i}_text`] || critRow[`option${i}`];
    const score = critRow[`option${i}_score`] || critRow[`score${i}`];
    if (text && score != null) {
      opts.push({ text: text.toString(), score: Number(score) });
    }
  }
  if (opts.length === 0) {
    opts.push({ text: "More than 10", score: 10 });
    opts.push({ text: "Between 6 and 10", score: 5 });
    opts.push({ text: "Between 1 and 5", score: 1 });
  }
  return opts;
};

export default function TFAWorkspace({ session }) {
  const navigate = useNavigate();
  const { objectiveId } = useParams();
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Andy Vaillant';
  const userEmail = session?.user?.email || 'andy.vaillant@london-fire.gov.uk'; // Fallback for local testing

  // Core Data State
  const [isLoading, setIsLoading] = useState(true);
  const [objectiveMeta, setObjectiveMeta] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [analyticsMap, setAnalyticsMap] = useState({});
  const [criteriaMap, setCriteriaMap] = useState({});

  // Interaction State
  const [activeOutcomeId, setActiveOutcomeId] = useState(null);
  const [activeTab, setActiveTab] = useState(1); // 1 to 10
  const [showResearch, setShowResearch] = useState(false);
  const [saveMode, setSaveMode] = useState('One Outcome');
  
  // OAI Overlay State
  const [showOAIPanel, setShowOAIPanel] = useState(false);
  const [oaiComplexity, setOaiComplexity] = useState(0);
  const [oaiRisk, setOaiRisk] = useState(0);
  const [oaiExposure, setOaiExposure] = useState(0);
  const [oaiRationaleComments, setOaiRationaleComments] = useState('');
  
  const [oaiMap, setOaiMap] = useState({});
  
  // Local modifications before save (mapped by comp_id)
  const [localAssessments, setLocalAssessments] = useState({});
  const [savedAssessments, setSavedAssessments] = useState({});
  
  // Fetch Routine
  useEffect(() => {
    const fetchWorkspaceData = async () => {
      setIsLoading(true);
      try {
        if (!objectiveId) throw new Error("No objective ID provided.");
        
        // 1. Fetch exact objective
        const { data: metaData, error: metaErr } = await supabase
          .from('competency_framework')
          .select('*')
          .eq('id', objectiveId)
          .single();
          
        if (metaErr) throw metaErr;
        setObjectiveMeta(metaData);
        
        const polId = metaData.policy_id || '';
        const elTitle = metaData.element_title || '';
        const lObj = metaData.learning_objective || '';

        // 2. Fetch Playlist
        let allOutcomes = [];
        let fwPage = 0;
        const fwPageSize = 1000;
        let fwKeepFetching = true;

        while (fwKeepFetching) {
          const fromRange = fwPage * fwPageSize;
          const toRange = fromRange + fwPageSize - 1;

          let query = supabase.from('competency_framework').select('*').range(fromRange, toRange);
          if (polId) query = query.eq('policy_id', polId); else query = query.is('policy_id', null);
          if (elTitle) query = query.eq('element_title', elTitle); else query = query.is('element_title', null);
          if (lObj) query = query.eq('learning_objective', lObj); else query = query.is('learning_objective', null);

          const { data: outData, error: outErr } = await query;
          if (outErr) throw outErr;
          
          if (outData && outData.length > 0) {
            allOutcomes = [...allOutcomes, ...outData];
            if (outData.length < fwPageSize) fwKeepFetching = false;
            else fwPage++;
          } else {
            fwKeepFetching = false;
          }
        }
        
        allOutcomes = allOutcomes.filter(row => row.learning_outcome && row.learning_outcome.trim() !== '');
        allOutcomes.sort((a, b) => a.id - b.id);
        setPlaylist(allOutcomes);
        if (allOutcomes.length > 0) setActiveOutcomeId(allOutcomes[0].id);

        const compids = allOutcomes.map(o => o.id.toString());
        
        // 3a. Fetch view_tfa_v2_panel_analytics for playlist metrics
        let allAnalytics = [];
        let aPage = 0;
        const aPageSize = 1000;
        let aKeepFetching = true;

        while (aKeepFetching) {
          const fromRange = aPage * aPageSize;
          const toRange = fromRange + aPageSize - 1;

          const { data: aData, error: aErr } = await supabase
            .from('view_tfa_v2_panel_analytics')
            .select('*')
            .range(fromRange, toRange);

          if (aErr) {
            console.error("Error fetching analytics, may not be implemented:", aErr);
            aKeepFetching = false;
          } else if (aData && aData.length > 0) {
            allAnalytics = [...allAnalytics, ...aData];
            if (aData.length < aPageSize) aKeepFetching = false;
            else aPage++;
          } else {
            aKeepFetching = false;
          }
        }

        const anMap = {};
        allAnalytics.forEach(row => {
          const cid = row.comp_id != null ? row.comp_id.toString().trim() : null;
          if (cid) anMap[cid] = row;
        });
        setAnalyticsMap(anMap);

        // 3c. Fetch OAI consolidated results
        let allConsolidated = [];
        let cPage = 0;
        const cPageSize = 1000;
        let cKeepFetching = true;
        
        while (cKeepFetching) {
          const fromRange = cPage * cPageSize;
          const toRange = fromRange + cPageSize - 1;
          const { data: cData, error: cErr } = await supabase
            .from('tfa_v2_consolidated_results')
            .select('*')
            .range(fromRange, cPageSize);
            
          if (cErr) {
            console.error("Error fetching consolidated results:", cErr);
            cKeepFetching = false;
          } else if (cData && cData.length > 0) {
            allConsolidated = [...allConsolidated, ...cData];
            if (cData.length < cPageSize) cKeepFetching = false;
            else cPage++;
          } else {
            cKeepFetching = false;
          }
        }
        
        const oMap = {};
        allConsolidated.forEach(row => {
          const cid = row.comp_id != null ? row.comp_id.toString().trim() : null;
          if (cid) oMap[cid] = row;
        });
        setOaiMap(oMap);

        // 3b. Fetch SME scores for authenticated user
        let smeScores = [];
        const { data: myScores, error: myScoresErr } = await supabase
          .from('tfa_v2_sme_scores')
          .select('*')
          .eq('sme_email', userEmail);
        
        if (!myScoresErr && myScores) smeScores = myScores;

        const myMap = {};
        smeScores.forEach(row => {
          const cid = row.comp_id != null ? row.comp_id.toString().trim() : null;
          if (cid) myMap[cid] = row;
        });

        // Map to local state
        const defaultLocal = {};
        allOutcomes.forEach(out => {
          const cid = out.id.toString();
          const existing = myMap[cid];
          
          defaultLocal[cid] = {
            comp_id: cid,
            sme_email: userEmail,
            sme_name: userName,
            raw_scores: existing?.raw_scores || Array(10).fill(null),
            raw_responses: existing?.raw_responses || Array(10).fill(''),
            raw_comments: existing?.raw_comments || Array(10).fill(''),
          };
        });
        // We defer setLocalAssessments(defaultLocal) until criteria are loaded.

        // 4. Fetch the 10-step criteria config
        const { data: critData, error: critErr } = await supabase
          .from('tfa_v2_criteria_config')
          .select('*');
          
        if (critErr) {
            console.error("Criteria fetch error:", critErr);
        }
        
        const cMap = {};
        if (critData && critData.length > 0) {
          critData.forEach(row => {
            const num = row.criterion_number || row.id; 
            cMap[num] = row;
          });
        }
        setCriteriaMap(cMap);

        // 5. Auto-calculate Criterion 2 (Number of learning outcomes)
        const outcomeCount = allOutcomes.length;
        const c2Row = cMap[2];
        if (c2Row) {
          const c2Opts = getCriteriaOptions(c2Row);
          let selectedOpt = null;
          for (const opt of c2Opts) {
            const t = opt.text.toLowerCase();
            if (t.includes('more than') || t.includes('>')) {
              const num = parseInt(t.match(/\d+/)?.[0] || '10');
              if (outcomeCount > num) { selectedOpt = opt; break; }
            } else if (t.includes('between') || t.includes('-')) {
              const nums = t.match(/\d+/g);
              if (nums && nums.length >= 2) {
                const min = parseInt(nums[0]);
                const max = parseInt(nums[1]);
                if (outcomeCount >= min && outcomeCount <= max) { selectedOpt = opt; break; }
              }
            } else if (t.includes('less than') || t.includes('<')) {
              const num = parseInt(t.match(/\d+/)?.[0] || '1');
              if (outcomeCount < num) { selectedOpt = opt; break; }
            } else if (t.includes('1 and 5') || t.includes('1-5')) {
               if (outcomeCount >= 1 && outcomeCount <= 5) { selectedOpt = opt; break; }
            }
          }
          if (!selectedOpt && c2Opts.length > 0) selectedOpt = c2Opts[c2Opts.length - 1];

          if (selectedOpt) {
            Object.keys(defaultLocal).forEach(cid => {
              // Override criterion 2 with automated logic
              defaultLocal[cid].raw_responses[1] = selectedOpt.text;
              defaultLocal[cid].raw_scores[1] = selectedOpt.score;
              defaultLocal[cid].raw_comments[1] = `Auto-calculated: Found ${outcomeCount} learning outcomes within this objective.`;
            });
          }
        }
        
        setSavedAssessments(JSON.parse(JSON.stringify(defaultLocal)));
        setLocalAssessments(defaultLocal);

      } catch (err) {
        console.error("Workspace init error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWorkspaceData();
  }, [objectiveId, userEmail]);

  // Derived Values
  const activeLocalAss = activeOutcomeId ? localAssessments[activeOutcomeId.toString()] : null;
  const activeAnalytics = activeOutcomeId ? analyticsMap[activeOutcomeId.toString()] : null;
  const activeOaiRecord = activeOutcomeId ? oaiMap[activeOutcomeId.toString()] : null;
  const savedOaiNet = activeOaiRecord ? (Number(activeOaiRecord.oai_complexity_adj || 0) + Number(activeOaiRecord.oai_risk_adj || 0) + Number(activeOaiRecord.oai_exposure_adj || 0)) : 0;

  // 10-step check
  const isTabComplete = (ass, tabNum) => {
    if (!ass) return false;
    const idx = tabNum - 1;
    const resp = ass.raw_responses[idx];
    const score = ass.raw_scores[idx];
    const comm = ass.raw_comments[idx];
    return !!(resp && resp.toString().trim() && score !== null && score !== undefined && comm && comm.toString().trim());
  };

  const isAssessmentFullyComplete = (ass) => {
    if (!ass) return false;
    for (let i = 1; i <= 10; i++) {
      if (!isTabComplete(ass, i)) return false;
    }
    return true;
  };

  const isPlaylistAllComplete = useMemo(() => {
    if (playlist.length === 0) return false;
    return playlist.every(out => {
      const cid = out.id.toString();
      const count = Number(analyticsMap[cid]?.panel_count) || 0;
      return count >= 1;
    });
  }, [playlist, analyticsMap]);

  // UDA Math Engine
  const calculateScoreFromLocal = (localAss) => {
    if (!localAss) return 0;
    const w = [0.05, 0.05, 0.10, 0.10, 0.15, 0.05, 0.15, 0.15, 0.10, 0.10];
    let total = 0;
    let anyScore = false;
    for (let i = 0; i < 10; i++) {
      const s = Number(localAss.raw_scores[i]);
      if (!isNaN(s) && s > 0) {
        total += (s * w[i]);
        anyScore = true;
      }
    }
    return anyScore ? Number(total.toFixed(2)) : 0;
  };

  const activeTotalScore = useMemo(() => calculateScoreFromLocal(activeLocalAss), [activeLocalAss]);

  const getFrequencyResult = (t) => {
    if (t === 0) return { label: 'Not Assessed', color: '#9ca3af', bg: '#f3f4f6' };
    
    // Negatively accelerated human retention power function curves
    if (t <= 2.0) return { label: 'Every 4 years', color: '#16a34a', bg: '#dcfce7' }; // Green
    if (t <= 4.0) return { label: 'Every 2 years', color: '#84cc16', bg: '#ecfccb' }; // Light Green
    if (t <= 6.0) return { label: 'Every year', color: '#b45309', bg: '#fef3c7' }; // Amber
    if (t <= 8.0) return { label: 'Every 6 months', color: '#ea580c', bg: '#ffedd5' }; // Orange
    return { label: 'Every 3 months', color: '#991b1b', bg: '#fee2e2' }; // Deep Red (8.1 - 10.0)
  };

  const frequencyResult = useMemo(() => getFrequencyResult(activeTotalScore), [activeTotalScore]);

  const previewAdjustedScore = useMemo(() => {
    if (activeTotalScore === 0) return 0;
    let base = activeTotalScore;
    let adj = oaiComplexity + oaiRisk + oaiExposure;
    let finalScore = base + adj;
    if (finalScore < 0.25) finalScore = 0.25; 
    if (finalScore > 10.0) finalScore = 10.0;
    return Number(finalScore.toFixed(2));
  }, [activeTotalScore, oaiComplexity, oaiRisk, oaiExposure]);

  const previewFrequencyResult = useMemo(() => getFrequencyResult(previewAdjustedScore), [previewAdjustedScore]);

  const savedAdjustedScore = useMemo(() => {
    if (activeTotalScore === 0) return 0;
    let base = activeTotalScore;
    let finalScore = base + savedOaiNet;
    if (finalScore < 0.25) finalScore = 0.25; 
    if (finalScore > 10.0) finalScore = 10.0;
    return Number(finalScore.toFixed(2));
  }, [activeTotalScore, savedOaiNet]);

  const savedAdjustedFrequency = useMemo(() => getFrequencyResult(savedAdjustedScore), [savedAdjustedScore]);


  const handleUpdateActiveAssArray = (arrayName, tabNum, value) => {
    if (!activeOutcomeId) return;
    setLocalAssessments(prev => {
      const next = { ...prev };
      const cid = activeOutcomeId.toString();
      
      const newArray = [...next[cid][arrayName]];
      newArray[tabNum - 1] = value;
      
      next[cid] = { ...next[cid], [arrayName]: newArray };
      return next;
    });
  };

  const handleSave = async () => {
    if (!activeOutcomeId) return;
    try {
      const cid = activeOutcomeId.toString();
      const currentAss = { ...localAssessments[cid] };

      // Ensure arrays have 10 elements
      currentAss.raw_scores = currentAss.raw_scores.slice(0, 10);
      currentAss.raw_responses = currentAss.raw_responses.slice(0, 10);
      currentAss.raw_comments = currentAss.raw_comments.slice(0, 10);

      let payloads = [];

      let copyOAI = false;
      const activeOai = oaiMap[cid];
      const activeNetOai = activeOai ? (Number(activeOai.oai_complexity_adj || 0) + Number(activeOai.oai_risk_adj || 0) + Number(activeOai.oai_exposure_adj || 0)) : 0;

      if (saveMode === 'All Outcomes') {
        if (activeNetOai !== 0) {
          copyOAI = window.confirm("This assessment has an active Operational Adjustment (OAI). Do you wish to copy this adjustment to all outcomes as well?");
        }
        playlist.forEach(out => {
          const outCid = out.id.toString();
          payloads.push({
            ...currentAss,
            comp_id: outCid
          });
        });
      } else {
        payloads.push(currentAss);
      }

      const { error } = await supabase
        .from('tfa_v2_sme_scores')
        .upsert(payloads, { onConflict: 'comp_id, sme_email' });

      if (error) throw error;
      
      // If copyOAI is true, also upsert OAI to all outcomes
      if (copyOAI && saveMode === 'All Outcomes') {
        let oaiPayloads = [];
        playlist.forEach(out => {
          const outCid = out.id.toString();
          oaiPayloads.push({
            comp_id: outCid,
            oai_complexity_adj: activeOai.oai_complexity_adj,
            oai_risk_adj: activeOai.oai_risk_adj,
            oai_exposure_adj: activeOai.oai_exposure_adj,
            oai_rationale_comments: activeOai.oai_rationale_comments,
            predicted_retention: activeOai.predicted_retention,
            refresher_frequency: activeOai.refresher_frequency
          });
        });

        const { error: oaiError } = await supabase
          .from('tfa_v2_consolidated_results')
          .upsert(oaiPayloads, { onConflict: 'comp_id' });
        
        if (oaiError) throw oaiError;
        
        setOaiMap(prev => {
           const next = { ...prev };
           oaiPayloads.forEach(p => {
             next[p.comp_id] = p;
           });
           return next;
        });
      }
      
      // Instantly refresh the Panel Progress analytics for the modified outcomes
      const compIdsToRefresh = payloads.map(p => p.comp_id);
      const { data: refreshedAnalytics } = await supabase
        .from('view_tfa_v2_panel_analytics')
        .select('*')
        .in('comp_id', compIdsToRefresh);
        
      if (refreshedAnalytics) {
        setAnalyticsMap(prev => {
          const next = { ...prev };
          refreshedAnalytics.forEach(row => {
            const rowCid = row.comp_id != null ? row.comp_id.toString().trim() : null;
            if (rowCid) next[rowCid] = row;
          });
          return next;
        });
      }
      
      if (saveMode === 'All Outcomes') {
        setLocalAssessments(prev => {
          const next = { ...prev };
          payloads.forEach(p => {
             next[p.comp_id] = { ...p };
          });
          setSavedAssessments(JSON.parse(JSON.stringify(next)));
          return next;
        });
        if (copyOAI) {
          alert('SME Panel Score & OAI Adjustments saved successfully across ALL outcomes!');
        } else {
          alert('SME Panel Score saved successfully across ALL outcomes!');
        }
        setSaveMode('One Outcome');
      } else {
        setSavedAssessments(prev => {
          const next = { ...prev };
          next[currentAss.comp_id] = JSON.parse(JSON.stringify(currentAss));
          return next;
        });
        alert('SME Panel Score saved successfully!');
      }
    } catch (err) {
      console.error("Save error:", err);
      alert('Error saving assessment: ' + err.message);
    }
  };

  const handleSaveOAI = async () => {
    if (!activeOutcomeId || !oaiRationaleComments.trim()) return;
    try {
      const payload = {
        comp_id: activeOutcomeId.toString(),
        oai_complexity_adj: oaiComplexity,
        oai_risk_adj: oaiRisk,
        oai_exposure_adj: oaiExposure,
        oai_rationale_comments: oaiRationaleComments,
        predicted_retention: previewFrequencyResult.label,
        refresher_frequency: previewFrequencyResult.label
      };

      const { error } = await supabase
        .from('tfa_v2_consolidated_results')
        .upsert(payload, { onConflict: 'comp_id' });

      if (error) throw error;
      
      // Refresh local analytics map for this comp_id
      const { data: refreshedAnalytics } = await supabase
        .from('view_tfa_v2_panel_analytics')
        .select('*')
        .eq('comp_id', activeOutcomeId.toString());
        
      if (refreshedAnalytics && refreshedAnalytics.length > 0) {
        setAnalyticsMap(prev => {
          const next = { ...prev };
          next[activeOutcomeId.toString()] = refreshedAnalytics[0];
          return next;
        });
      }

      setOaiMap(prev => {
        const next = { ...prev };
        next[activeOutcomeId.toString()] = {
          ...payload
        };
        return next;
      });

      alert('OAI Adjustments saved successfully!');
      setShowOAIPanel(false);
    } catch (err) {
      console.error("OAI Save error:", err);
      alert('Error saving OAI adjustments: ' + err.message);
    }
  };

  const handleExit = () => {
    const dirtyOutcomes = [];
    playlist.forEach(out => {
      const cid = out.id.toString();
      const local = localAssessments[cid];
      const saved = savedAssessments[cid];
      if (local && saved) {
        const isDirty = JSON.stringify(local.raw_scores) !== JSON.stringify(saved.raw_scores) ||
                        JSON.stringify(local.raw_responses) !== JSON.stringify(saved.raw_responses) ||
                        JSON.stringify(local.raw_comments) !== JSON.stringify(saved.raw_comments);
        if (isDirty) {
          dirtyOutcomes.push(out.learning_outcome || out.id);
        }
      }
    });

    if (dirtyOutcomes.length > 0) {
      const msg = "You have unsaved changes in the following Learning Outcomes:\n\n" + 
                  dirtyOutcomes.map(d => "• " + d).join("\n") + 
                  "\n\nAre you sure you want to exit without saving?";
      if (!window.confirm(msg)) {
        return;
      }
    }
    navigate('/tfa-assessment');
  };

  if (isLoading) {
    return (
      <div className="tfa-loading-screen">
        <h2 className="tfa-loading-text">Loading 10-Step Workspace...</h2>
      </div>
    );
  }

  if (!objectiveMeta) {
    return (
      <div className="tfa-loading-screen">
        <h2 className="tfa-error-text">Error: Objective not found.</h2>
      </div>
    );
  }

  return (
    <div className="tfa-workspace-container">
      
      {/* Top Header Bar */}
      <div className="tfa-header-bar">
        <div className="tfa-header-left">
          <button onClick={() => navigate('/tfa-assessment')} className="tfa-back-button">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"></path>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <h1 className="tfa-header-title">
            Training Frequency Assessment
          </h1>
        </div>
        
        <div className="tfa-header-controls">
          <div className="tfa-control-group">
            <select 
              value={saveMode}
              onChange={(e) => setSaveMode(e.target.value)}
              className="tfa-save-mode-select"
            >
              <option value="One Outcome">One Outcome</option>
              <option value="All Outcomes">All Outcomes</option>
            </select>
            <button 
              onClick={handleSave}
              className="tfa-save-btn"
            >
              Save
            </button>
            <button 
              onClick={handleExit}
              className="tfa-exit-btn"
            >
              Exit
            </button>
          </div>

          <div className="tfa-user-profile">
            <span className="tfa-user-name">{userName}</span>
            <div className="tfa-user-avatar">
              <span className="tfa-avatar-icon">🧑‍🚒</span>
            </div>
          </div>
        </div>
      </div>

      <div className="tfa-workspace-main-content">
        
        {/* Center Workspace */}
        <div className="tfa-workspace-left">
          
          {/* Metadata Block (Moved down from header) */}
          <div className="tfa-workspace-metadata">
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '200px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Training Specification</span>
              <span style={{ fontSize: '1rem', color: '#111827', fontWeight: '500' }}>{objectiveMeta.policy_id}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '200px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Element</span>
              <span style={{ fontSize: '1rem', color: '#111827', fontWeight: '500' }}>{objectiveMeta.element_title}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '200px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Learning Type</span>
              <span style={{ fontSize: '1rem', color: '#111827', fontWeight: '500' }}>{objectiveMeta.learning_heading}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 2, minWidth: '300px', borderLeft: '4px solid #f59e0b', paddingLeft: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Learning Objective / Control Measure</span>
                {isPlaylistAllComplete && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </div>
              <span style={{ fontSize: '1.1rem', color: '#b45309', fontWeight: 'bold' }}>{objectiveMeta.learning_objective}</span>
            </div>
          </div>
          
          {/* Automated Conflict Banner */}
          {activeAnalytics?.moderation_required === true && !showOAIPanel && (
            <div style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '1rem', fontWeight: 'bold', textAlign: 'center', borderBottom: '2px solid #fde68a' }}>
              [!] Moderation Required: Panel Variance Exceeds Tolerance Limit
            </div>
          )}

          {showOAIPanel ? (
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #e9ecef', paddingBottom: '1rem' }}>
                <h2 style={{ color: '#111827', margin: 0, fontSize: '1.4rem' }}>Operational Adjustment Index (OAI) Configuration</h2>
                <button 
                  onClick={() => setShowOAIPanel(false)}
                  style={{ backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #ced4da', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Cancel
                </button>
              </div>

              <div style={{ display: 'flex', gap: '4rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '600px', flex: 1 }}>
                
                {/* Complexity */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold', color: '#111827', fontSize: '1.1rem' }}>Complexity Calibration</span>
                    <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>Adjust for cognitive and procedural processing changes.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => setOaiComplexity(Math.max(-5, oaiComplexity - 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #ced4da', backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', color: '#495057' }}>-</button>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', width: '30px', textAlign: 'center', color: oaiComplexity === 0 ? '#6c757d' : (oaiComplexity > 0 ? '#16a34a' : '#dc2626') }}>{oaiComplexity > 0 ? `+${oaiComplexity}` : oaiComplexity}</span>
                    <button onClick={() => setOaiComplexity(Math.min(5, oaiComplexity + 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #ced4da', backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', color: '#495057' }}>+</button>
                  </div>
                </div>

                {/* Risk */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold', color: '#111827', fontSize: '1.1rem' }}>Risk Calibration</span>
                    <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>Adjust for engineering control offsets.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => setOaiRisk(Math.max(-5, oaiRisk - 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #ced4da', backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', color: '#495057' }}>-</button>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', width: '30px', textAlign: 'center', color: oaiRisk === 0 ? '#6c757d' : (oaiRisk > 0 ? '#16a34a' : '#dc2626') }}>{oaiRisk > 0 ? `+${oaiRisk}` : oaiRisk}</span>
                    <button onClick={() => setOaiRisk(Math.min(5, oaiRisk + 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #ced4da', backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', color: '#495057' }}>+</button>
                  </div>
                </div>

                {/* Exposure */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold', color: '#111827', fontSize: '1.1rem' }}>Exposure Calibration</span>
                    <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>Adjust for daily field turnouts and routine application.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => setOaiExposure(Math.max(-5, oaiExposure - 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #ced4da', backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', color: '#495057' }}>-</button>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', width: '30px', textAlign: 'center', color: oaiExposure === 0 ? '#6c757d' : (oaiExposure > 0 ? '#16a34a' : '#dc2626') }}>{oaiExposure > 0 ? `+${oaiExposure}` : oaiExposure}</span>
                    <button onClick={() => setOaiExposure(Math.min(5, oaiExposure + 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #ced4da', backgroundColor: '#f8f9fa', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', color: '#495057' }}>+</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                  <label style={{ fontWeight: 'bold', color: '#111827', fontSize: '1rem' }}>Auditable Panel Rationale <span style={{ color: '#dc2626' }}>*</span></label>
                  <textarea 
                    placeholder="Provide justification for these operational adjustments..."
                    value={oaiRationaleComments}
                    onChange={(e) => setOaiRationaleComments(e.target.value)}
                    style={{ padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px', resize: 'vertical', minHeight: '100px', fontFamily: 'inherit', fontSize: '0.95rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button 
                    onClick={handleSaveOAI}
                    disabled={!oaiRationaleComments.trim()}
                    style={{ 
                      backgroundColor: oaiRationaleComments.trim() ? '#16a34a' : '#9ca3af', 
                      color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: '4px', 
                      fontWeight: 'bold', cursor: oaiRationaleComments.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '1rem'
                    }}
                  >
                    Save & Return
                  </button>
                </div>
              </div>

              {/* Preview Panel to the right */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '300px', backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <h3 style={{ margin: 0, color: '#495057', fontSize: '1.1rem', borderBottom: '1px solid #ced4da', paddingBottom: '0.5rem' }}>Live OAI Preview</h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6c757d', fontWeight: 'bold' }}>Base UDA Score</span>
                  <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#111827' }}>{activeTotalScore}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6c757d', fontWeight: 'bold' }}>Net Adjustment</span>
                  <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: (oaiComplexity + oaiRisk + oaiExposure) > 0 ? '#16a34a' : ((oaiComplexity + oaiRisk + oaiExposure) < 0 ? '#dc2626' : '#6c757d') }}>
                    {(oaiComplexity + oaiRisk + oaiExposure) > 0 ? '+' : ''}{oaiComplexity + oaiRisk + oaiExposure}
                  </span>
                </div>
                
                <div style={{ borderTop: '2px dashed #ced4da', margin: '0.5rem 0' }}></div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#111827', fontWeight: 'bold', fontSize: '1.1rem' }}>Adjusted Total</span>
                  <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#003399' }}>{previewAdjustedScore}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                  <span style={{ color: '#111827', fontWeight: 'bold', fontSize: '0.9rem' }}>Projected Frequency</span>
                  <div style={{ backgroundColor: previewFrequencyResult.bg, color: previewFrequencyResult.color, padding: '0.75rem 1rem', borderRadius: '4px', fontWeight: 'bold', border: `1px solid ${previewFrequencyResult.color}`, width: '100%', textAlign: 'center', fontSize: '1.1rem' }}>
                    {previewFrequencyResult.label}
                  </div>
                </div>

              </div>

            </div>
            </div>
          ) : (
            <div style={{ padding: '1rem 2rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontWeight: 'bold', color: '#374151', marginBottom: '0.5rem' }}>Select Criterion:</div>
            
            {/* 1-10 Strip */}
            <div className="tfa-criteria-strip">
              {[...Array(10)].map((_, i) => {
                const num = i + 1;
                const isFilled = isTabComplete(activeLocalAss, num);
                const isCurrent = activeTab === num;
                return (
                  <div 
                    key={num}
                    onClick={() => {
                      setActiveTab(num);
                      setShowResearch(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem',
                      cursor: 'pointer', padding: '0.2rem 0.5rem',
                      borderBottom: isCurrent ? '3px solid #003399' : '3px solid transparent',
                      color: isCurrent ? '#003399' : '#374151',
                      fontWeight: isCurrent ? 'bold' : 'normal',
                      fontSize: '1.2rem',
                      flexShrink: 0
                    }}
                  >
                    {num}
                    {isFilled && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem', flex: 1 }}>
              
              {/* Form Area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#111827', fontSize: '1.1rem' }}>Criterion {activeTab} - Question</span>
                  <span 
                    onClick={() => setShowResearch(!showResearch)}
                    title="View Research Justification"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', border: '1px solid #003399', color: '#003399', fontSize: '0.8rem', cursor: 'pointer', backgroundColor: showResearch ? '#e0e7ff' : 'transparent' }}
                  >
                    i
                  </span>
                </div>
                
                {showResearch && criteriaMap[activeTab]?.research_justification && (
                  <div style={{ padding: '1rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', color: '#1e3a8a', fontSize: '0.9rem' }}>
                    <strong>Research Justification:</strong><br/>
                    {criteriaMap[activeTab].research_justification}
                  </div>
                )}
                
                <div style={{ fontSize: '1.2rem', color: '#111827', fontWeight: 'bold' }}>
                  {criteriaMap[activeTab]?.question_text || criteriaMap[activeTab]?.question || "Loading criterion question..."}
                </div>

                {criteriaMap[activeTab]?.description && (
                  <div style={{ fontSize: '0.95rem', color: '#4b5563', marginTop: '-0.5rem' }}>
                    <strong>Description:</strong> {criteriaMap[activeTab].description}
                  </div>
                )}

                {criteriaMap[activeTab]?.significance && (
                  <div style={{ fontSize: '0.95rem', color: '#4b5563', marginTop: '-0.5rem' }}>
                    <strong>Significance:</strong> {criteriaMap[activeTab].significance}
                  </div>
                )}
                
                <div style={{ borderTop: '2px solid #e9ecef', paddingTop: '1rem', display: 'flex', gap: '1rem', marginTop: 'auto' }}>
                  <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 'bold', color: '#111827', fontSize: '0.9rem' }}>Criterion Response</label>
                    <select 
                      value={activeLocalAss?.raw_responses[activeTab - 1] || ''}
                      onChange={(e) => {
                        const text = e.target.value;
                        handleUpdateActiveAssArray('raw_responses', activeTab, text);
                        
                        const opts = getCriteriaOptions(criteriaMap[activeTab]);
                        const opt = opts.find(o => o.text === text);
                        if (opt) {
                          handleUpdateActiveAssArray('raw_scores', activeTab, opt.score);
                        } else {
                          handleUpdateActiveAssArray('raw_scores', activeTab, null);
                        }
                      }}
                      style={{ padding: '0.75rem', border: '1px solid #003399', borderRadius: '4px', color: '#111827', backgroundColor: '#fff', fontSize: '1rem' }}
                    >
                      <option value="">Select Option</option>
                      {getCriteriaOptions(criteriaMap[activeTab]).map((opt, idx) => (
                        <option key={idx} value={opt.text}>{opt.text}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ width: '100px', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                    <label style={{ fontWeight: 'bold', color: '#111827', fontSize: '0.9rem' }}>Criterion Score</label>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', paddingTop: '0.5rem' }}>
                      {activeLocalAss?.raw_scores[activeTab - 1] ?? '-'}
                    </div>
                  </div>

                  <div style={{ flex: '2', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontWeight: 'bold', color: '#111827', fontSize: '0.9rem' }}>Criterion Comments</label>
                    <textarea 
                      placeholder="Rationale for score"
                      value={activeLocalAss?.raw_comments[activeTab - 1] || ''}
                      onChange={(e) => handleUpdateActiveAssArray('raw_comments', activeTab, e.target.value)}
                      style={{ padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px', resize: 'none', height: '42px', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
                
                <div style={{ borderTop: '2px solid #e9ecef', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
                    <span style={{ fontWeight: 'bold', color: '#111827', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total UDA</span>
                    {savedOaiNet !== 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#6b7280', textDecoration: 'line-through' }}>{activeTotalScore}</span>
                        <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#003399' }}>{savedAdjustedScore}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#111827' }}>{activeTotalScore}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '150px' }}>
                    <span style={{ fontWeight: 'bold', color: '#111827', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Refresher Frequency</span>
                    {savedOaiNet !== 0 ? (
                      <div style={{ backgroundColor: savedAdjustedFrequency.bg, color: savedAdjustedFrequency.color, padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 'bold', border: `1px solid ${savedAdjustedFrequency.color}`, width: '100%', textAlign: 'center' }}>
                        {savedAdjustedFrequency.label}
                      </div>
                    ) : (
                      <div style={{ backgroundColor: frequencyResult.bg, color: frequencyResult.color, padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 'bold', border: `1px solid ${frequencyResult.color}`, width: '100%', textAlign: 'center' }}>
                        {frequencyResult.label}
                      </div>
                    )}
                  </div>
                  
                  {/* OAI BUTTON */}
                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: '2rem' }}>
                    <button 
                      onClick={() => {
                        const o = oaiMap[activeOutcomeId?.toString()];
                        setOaiComplexity(o ? Number(o.oai_complexity_adj || 0) : 0);
                        setOaiRisk(o ? Number(o.oai_risk_adj || 0) : 0);
                        setOaiExposure(o ? Number(o.oai_exposure_adj || 0) : 0);
                        setOaiRationaleComments(o ? (o.oai_rationale_comments || '') : '');
                        setShowOAIPanel(true);
                      }}
                      style={{ backgroundColor: '#1e293b', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                      Configure OAI Adjustments
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                    <div style={{ width: '20px', height: '20px', border: '2px solid #ced4da', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isAssessmentFullyComplete(activeLocalAss) && <div style={{width:'12px', height:'12px', backgroundColor:'#16a34a'}}></div>}
                    </div>
                    <span style={{ color: '#6c757d', fontSize: '0.9rem' }}>10-Step Complete</span>
                  </div>
                </div>

                {savedOaiNet !== 0 && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.85rem', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #bae6fd' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    A Panel Adjustment of {(savedOaiNet > 0 ? '+' : '') + savedOaiNet} has been applied to this score based on Operational Adjustments.
                  </div>
                )}

              </div>
              
              {/* Options Hint Pane */}
              <div style={{ width: '250px', color: '#6c757d', fontSize: '0.95rem', paddingTop: '2rem' }}>
                This is scored by selecting one of the following options:<br/><br/>
                {getCriteriaOptions(criteriaMap[activeTab]).map((opt, idx) => (
                  <div key={idx} style={{ marginBottom: '0.2rem' }}>{opt.text}</div>
                ))}
              </div>
              
            </div>
          </div>
          )}
        </div>

        {/* Right Playlist Panel */}
        <div className="tfa-workspace-right">
          
          <div style={{ padding: '1rem', borderBottom: '1px solid #e9ecef', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '0.95rem' }}>
              Learning Outcomes within objective: {playlist.length}
            </div>
            <button style={{ backgroundColor: '#003399', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '6px', fontWeight: 'bold', width: '100%', fontSize: '0.9rem' }}>
              Set Refresher Points
            </button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {playlist.map(out => {
              const cid = out.id.toString();
              const panelCount = Number(analyticsMap[cid]?.panel_count) || 0;
              const isAssComplete = panelCount >= 1;
              const isActive = activeOutcomeId === out.id;
              
              let frequencyLabel = "";
              let frequencyColor = "#111827";
              let frequencyBg = "transparent";
              if (isAssComplete) {
                const localAss = localAssessments[cid];
                const localScore = calculateScoreFromLocal(localAss);
                const baseScore = localScore > 0 ? localScore : (Number(analyticsMap[cid]?.final_weighted_score) || 0);
                
                const oaiRec = oaiMap[cid];
                let finalScore = baseScore;
                
                if (oaiRec) {
                   const netOai = (Number(oaiRec.oai_complexity_adj) || 0) + (Number(oaiRec.oai_risk_adj) || 0) + (Number(oaiRec.oai_exposure_adj) || 0);
                   finalScore = baseScore + netOai;
                   if (finalScore < 0.25) finalScore = 0.25;
                   if (finalScore > 10.0) finalScore = 10.0;
                }
                
                const freqRes = getFrequencyResult(finalScore);
                frequencyLabel = freqRes.label;
                frequencyColor = freqRes.color;
                frequencyBg = freqRes.bg;
              }
              
              return (
                <div 
                  key={out.id}
                  onClick={() => {
                    setActiveOutcomeId(out.id);
                    setActiveTab(1); // Reset to tab 1 on change
                    setShowResearch(false);
                  }}
                  style={{ 
                    border: '1px solid #dee2e6', padding: '1rem', borderRadius: '4px', cursor: 'pointer',
                    borderLeft: isActive ? '4px solid #003399' : '4px solid transparent',
                    boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    backgroundColor: isActive ? '#f8f9fa' : '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '1rem', marginBottom: '0.5rem' }}>
                    {out.learning_outcome}
                  </div>
                  {isAssComplete && (
                    <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ backgroundColor: frequencyBg, color: frequencyColor, padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85rem', border: `1px solid ${frequencyColor}` }}>
                        {frequencyLabel}
                      </span>
                    </div>
                  )}
                  <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ color: isAssComplete ? '#16a34a' : '#111827', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      Panel Progress: {panelCount} / 1 Signed Off
                    </div>
                  </div>
                  <div style={{ color: '#374151', fontSize: '0.8rem', textAlign: 'center' }}>
                    Acquisition: FFD
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', color: '#adb5bd', fontSize: '0.75rem' }}>
                    <span>BPA</span><span>DaMOP</span><span>MoS</span><span>CPD</span><span>BAU</span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>
      
    </div>
  );
}
