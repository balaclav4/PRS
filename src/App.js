// Copy the ENTIRE content from the "prs-app" artifact above into this file
// The full app code is too large to display here, but you should copy
// all the code from the first artifact we created together

// It starts with:
// import React, { useState, useRef, useEffect } from 'react';
// import { Camera, Target, ... } from 'lucide-react';
// 
// const CompletePRSApp = () => {
//   ... (all your app code)
// };
//
// export default CompletePRSApp;

import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Target, Crosshair, Plus, Trash2, Download,
  Home, BarChart3, Settings, Save, X, Upload, ZoomIn, ZoomOut,
  Wind, Thermometer, Droplets, Calendar, Info, ChevronRight,
  CheckCircle, AlertCircle, TrendingUp, Award, FileText,
  Clock, File, Smartphone, Moon, Sun, Pencil, Wrench,
  ShoppingCart, ExternalLink, Package, Ruler, FlaskConical, RotateCcw
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import {
  addSession, getSessions, deleteSession,
  addRifle, getRifles, deleteRifle, updateRifle,
  addLoad, getLoads, deleteLoad, updateLoad,
  addTrainingImage, getTrainingDataCount
} from './services/firestore';
import * as XLSX from 'xlsx';

// Product recommendation card for affiliate marketing
const ProductCard = ({ category, name, description, reason }) => (
  <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 transition-colors">
    <div className="flex items-start justify-between mb-1">
      <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">{category}</span>
      <ExternalLink className="h-3 w-3 text-gray-400" />
    </div>
    <h4 className="font-medium text-gray-900 dark:text-white text-sm">{name}</h4>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    {reason && (
      <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 flex items-center">
        <Info className="h-3 w-3 mr-1" />
        {reason}
      </p>
    )}
    <button className="mt-2 w-full text-xs text-center py-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors">
      Find Best Price
    </button>
  </div>
);

const CompletePRSApp = () => {
  // Authentication state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // State management - using in-memory storage with persistence structure
  const [activeTab, setActiveTab] = useState('home');
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [sessions, setSessions] = useState([]);
  const [equipment, setEquipment] = useState({ rifles: [], loads: [] });
  
  // Capture state
  const [captureStep, setCaptureStep] = useState('upload');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [targetDiameter, setTargetDiameter] = useState('');
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [currentEditingTarget, setCurrentEditingTarget] = useState(null);

  // Drag and resize state for visual target adjustment
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragTargetId, setDragTargetId] = useState(null);
  const [resizeHandle, setResizeHandle] = useState(null); // 'nw', 'ne', 'se', 'sw'
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [justFinishedDragging, setJustFinishedDragging] = useState(false);
  const dragUpdateRef = useRef(null);

  // Pinch-to-zoom state for mobile
  const [isPinching, setIsPinching] = useState(false);
  const [initialPinchDistance, setInitialPinchDistance] = useState(0);
  const [initialPinchRadius, setInitialPinchRadius] = useState(0);

  // Shot dragging state
  const [draggingShotId, setDraggingShotId] = useState(null);
  const [shotDragOffset, setShotDragOffset] = useState({ x: 0, y: 0 });
  const [isOverTrash, setIsOverTrash] = useState(false);

  const [sessionData, setSessionData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    rifle: '',
    load: '',
    silencer: false,
    distance: 100,
    temperature: 70,
    humidity: 50,
    windSpeed: 0,
    windDirection: '12',
    pressure: 29.92,
    chronoData: null
  });
  
  // Analytics filters
  const [analyticsFilters, setAnalyticsFilters] = useState({
    rifle: 'all',
    load: 'all',
    session: 'all',
    silencer: 'all',
    distance: [0, 1000] // [min, max] in yards
  });

  // Analytics chart settings
  const [performanceMetric, setPerformanceMetric] = useState('velocity'); // 'velocity', 'groupSize', 'totalRounds', 'avgPOI'
  const [poiUnit, setPoiUnit] = useState('inches'); // 'inches', 'moa', 'mils'
  const [chartCollapsed, setChartCollapsed] = useState({
    groupSize: false,
    shotDistribution: false,
    performance: false
  });

  // Equipment form state
  const [showAddRifle, setShowAddRifle] = useState(false);
  const [showAddLoad, setShowAddLoad] = useState(false);
  const [editingRifle, setEditingRifle] = useState(null); // Rifle being edited (null = adding new)
  const [editingLoad, setEditingLoad] = useState(null); // Load being edited (null = adding new)
  const [newRifle, setNewRifle] = useState({ name: '', caliber: '', barrel: '', twist: '', scope: '' });
  const [newLoad, setNewLoad] = useState({
    name: '', caliber: '', bullet: '', bulletWeight: '',
    powder: '', charge: '', primer: '', brass: '', oal: '', cbto: '',
    bc: '', bcType: 'G1', muzzleVelocity: '', velocitySD: '',
    // Reloading measurements
    caseLength: '', trimLength: '', headspace: '', shoulderBump: '',
    neckDiameter: '', neckTension: '', bulletJump: '', chamberOAL: '',
    baseDiameter: '', shoulderDiameter: '', primerDepth: '', annealed: false
  });
  
  // Statistical comparison state
  const [comparisonType, setComparisonType] = useState('loads');
  const [comparisonA, setComparisonA] = useState('');
  const [comparisonB, setComparisonB] = useState('');
  const [showStatistics, setShowStatistics] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);

  // Session detail view state
  const [viewingSession, setViewingSession] = useState(null); // Session being viewed/edited
  const [expandedTargetPlots, setExpandedTargetPlots] = useState({}); // Track which target plots are expanded
  
  // Chrono data state
  const [showChronoImport, setShowChronoImport] = useState(false);
  const [chronoString, setChronoString] = useState('');
  
  // Mobile optimization state
  const [isMobile, setIsMobile] = useState(false);
  
  const fileInputRef = useRef(null);
  const chronoFileRef = useRef(null);

  // Authentication state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load user data when logged in
  useEffect(() => {
    if (user) {
      loadUserData();
    } else {
      // Clear data when logged out
      setSessions([]);
      setEquipment({ rifles: [], loads: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load all user data from Firestore
  const loadUserData = async () => {
    if (!user) return;

    setDataLoading(true);
    try {
      // Load sessions, rifles, and loads in parallel
      const [sessionsData, riflesData, loadsData] = await Promise.all([
        getSessions(user.uid),
        getRifles(user.uid),
        getLoads(user.uid)
      ]);

      setSessions(sessionsData);
      setEquipment({
        rifles: riflesData,
        loads: loadsData
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      alert('Failed to load your data. Please refresh the page.');
    } finally {
      setDataLoading(false);
    }
  };

  // Check for mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Dark mode management
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  // Toggle dark mode function
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // Note: All data persistence now handled by Firestore service layer

  // Parse chrono data from string or file
  const parseChronoData = (data) => {
    try {
      // Expected format: velocity values separated by commas, spaces, or newlines
      const velocities = data
        .split(/[\s,\n]+/)
        .map(v => parseFloat(v))
        .filter(v => !isNaN(v) && v > 0);
      
      if (velocities.length === 0) return null;
      
      const avg = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
      const sorted = [...velocities].sort((a, b) => a - b);
      const es = sorted[sorted.length - 1] - sorted[0];
      
      // Calculate standard deviation
      const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / velocities.length;
      const sd = Math.sqrt(variance);
      
      return {
        velocities,
        average: avg,
        es,
        sd,
        high: sorted[sorted.length - 1],
        low: sorted[0],
        count: velocities.length
      };
    } catch (error) {
      console.error('Error parsing chrono data:', error);
      return null;
    }
  };

  // Export to CSV function
  const exportToCSV = () => {
    const headers = [
      'Session Name', 'Date', 'Rifle', 'Load', 'Distance (yards)',
      'Temperature (°F)', 'Humidity (%)', 'Wind Speed (mph)', 'Wind Direction',
      'Avg Velocity (fps)', 'ES (fps)', 'SD (fps)',
      'Target #', 'Shot #', 'X (inches)', 'Y (inches)', 'Radius from Center (inches)',
      'Group Size (inches)', 'Mean Radius (inches)', 'Std Dev (inches)'
    ];
    
    const rows = [];
    
    sessions.forEach(session => {
      session.targets.forEach((target, targetIndex) => {
        const stats = target.stats || calculateGroupStats(target.shots, target.x, target.y, target.pixelsPerInch);
        
        if (target.shots.length === 0) {
          rows.push([
            session.name, session.date, session.rifle, session.load, session.distance,
            session.temperature, session.humidity, session.windSpeed, session.windDirection,
            session.chronoData?.average?.toFixed(0) || 'N/A',
            session.chronoData?.es?.toFixed(0) || 'N/A',
            session.chronoData?.sd?.toFixed(1) || 'N/A',
            targetIndex + 1, 'N/A', 'N/A', 'N/A', 'N/A',
            'N/A', 'N/A', 'N/A'
          ]);
        } else {
          target.shots.forEach((shot, shotIndex) => {
            const xInches = (shot.x - target.x) / target.pixelsPerInch;
            const yInches = (shot.y - target.y) / target.pixelsPerInch;
            const radiusInches = Math.sqrt(xInches * xInches + yInches * yInches);
            
            rows.push([
              session.name, session.date, session.rifle, session.load, session.distance,
              session.temperature, session.humidity, session.windSpeed, session.windDirection,
              session.chronoData?.average?.toFixed(0) || 'N/A',
              session.chronoData?.es?.toFixed(0) || 'N/A',
              session.chronoData?.sd?.toFixed(1) || 'N/A',
              targetIndex + 1, shotIndex + 1, xInches.toFixed(4), yInches.toFixed(4), radiusInches.toFixed(4),
              stats.sizeInches.toFixed(4), stats.meanRadiusInches.toFixed(4), stats.standardDevInches.toFixed(4)
            ]);
          });
        }
      });
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prs-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export filtered sessions to Excel
  const exportFilteredSessionsToExcel = (filteredSessions) => {
    if (!filteredSessions || filteredSessions.length === 0) {
      alert('No sessions to export');
      return;
    }

    // Create summary sheet data
    const summaryData = filteredSessions.map(session => {
      const validTargets = session.targets.filter(t => t.shots?.length >= 2 && t.stats);
      const totalShots = session.targets.reduce((sum, t) => sum + (t.shots?.length || 0), 0);
      const bestGroup = validTargets.length > 0
        ? Math.min(...validTargets.map(t => t.stats.sizeInches))
        : null;
      const avgMeanRadius = validTargets.length > 0
        ? validTargets.reduce((sum, t) => sum + t.stats.meanRadiusInches, 0) / validTargets.length
        : null;
      const avgStdDev = validTargets.length > 0
        ? validTargets.reduce((sum, t) => sum + t.stats.standardDevInches, 0) / validTargets.length
        : null;

      return {
        'Session Name': session.name,
        'Date': session.date,
        'Rifle': session.rifle,
        'Load': session.load,
        'Distance (yds)': session.distance || 100,
        'Silencer': session.silencer ? 'Yes' : 'No',
        'Targets': session.targets.length,
        'Total Shots': totalShots,
        'Best Group (in)': bestGroup?.toFixed(4) || 'N/A',
        'Avg Mean Radius (in)': avgMeanRadius?.toFixed(4) || 'N/A',
        'Avg Std Dev (in)': avgStdDev?.toFixed(4) || 'N/A',
        'Temp (°F)': session.temperature || 'N/A',
        'Humidity (%)': session.humidity || 'N/A',
        'Wind (mph)': session.windSpeed || 0,
        'Wind Dir': session.windDirection || 'N/A',
        'Pressure (inHg)': session.pressure || 'N/A',
        'Avg Velocity (fps)': session.chronoData?.average?.toFixed(0) || 'N/A',
        'ES (fps)': session.chronoData?.es?.toFixed(0) || 'N/A',
        'SD (fps)': session.chronoData?.sd?.toFixed(1) || 'N/A'
      };
    });

    // Create detailed shot data sheet
    const shotData = [];
    filteredSessions.forEach(session => {
      session.targets.forEach((target, targetIndex) => {
        const stats = target.stats || {};
        if (target.shots && target.shots.length > 0) {
          target.shots.forEach((shot, shotIndex) => {
            const xInches = (shot.x - target.x) / target.pixelsPerInch;
            const yInches = (shot.y - target.y) / target.pixelsPerInch;
            const radiusInches = Math.sqrt(xInches * xInches + yInches * yInches);

            shotData.push({
              'Session': session.name,
              'Date': session.date,
              'Rifle': session.rifle,
              'Load': session.load,
              'Distance': session.distance || 100,
              'Target #': targetIndex + 1,
              'Shot #': shotIndex + 1,
              'X Offset (in)': xInches.toFixed(4),
              'Y Offset (in)': yInches.toFixed(4),
              'Radius (in)': radiusInches.toFixed(4),
              'Group Size (in)': stats.sizeInches?.toFixed(4) || 'N/A',
              'Mean Radius (in)': stats.meanRadiusInches?.toFixed(4) || 'N/A',
              'Std Dev (in)': stats.standardDevInches?.toFixed(4) || 'N/A'
            });
          });
        }
      });
    });

    // Create workbook with multiple sheets
    const wb = XLSX.utils.book_new();

    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Session Summary');

    if (shotData.length > 0) {
      const shotWs = XLSX.utils.json_to_sheet(shotData);
      XLSX.utils.book_append_sheet(wb, shotWs, 'Shot Details');
    }

    // Generate and download
    const filename = `prs-filtered-sessions-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Export single session to Excel
  const exportSessionToExcel = (session) => {
    if (!session) return;

    const distance = session.distance || 100;

    // Session info sheet
    const sessionInfo = [{
      'Session Name': session.name,
      'Date': session.date,
      'Rifle': session.rifle,
      'Load': session.load,
      'Distance (yds)': distance,
      'Silencer': session.silencer ? 'Yes' : 'No',
      'Temperature (°F)': session.temperature || 'N/A',
      'Humidity (%)': session.humidity || 'N/A',
      'Wind Speed (mph)': session.windSpeed || 0,
      'Wind Direction': session.windDirection || 'N/A',
      'Pressure (inHg)': session.pressure || 'N/A',
      'Avg Velocity (fps)': session.chronoData?.average?.toFixed(0) || 'N/A',
      'ES (fps)': session.chronoData?.es?.toFixed(0) || 'N/A',
      'SD (fps)': session.chronoData?.sd?.toFixed(1) || 'N/A'
    }];

    // Target statistics sheet
    const targetStats = session.targets.map((target, index) => {
      const stats = target.stats || {};
      const groupSizeMOA = stats.sizeInches ? (stats.sizeInches * 95.5) / distance : null;
      const meanRadiusMOA = stats.meanRadiusInches ? (stats.meanRadiusInches * 95.5) / distance : null;
      const stdDevMOA = stats.standardDevInches ? (stats.standardDevInches * 95.5) / distance : null;

      return {
        'Target #': index + 1,
        'Shots': target.shots?.length || 0,
        'Group Size (in)': stats.sizeInches?.toFixed(4) || 'N/A',
        'Group Size (MOA)': groupSizeMOA?.toFixed(2) || 'N/A',
        'Mean Radius (in)': stats.meanRadiusInches?.toFixed(4) || 'N/A',
        'Mean Radius (MOA)': meanRadiusMOA?.toFixed(2) || 'N/A',
        'Std Dev (in)': stats.standardDevInches?.toFixed(4) || 'N/A',
        'Std Dev (MOA)': stdDevMOA?.toFixed(2) || 'N/A',
        'POI Vertical (in)': stats.groupCenterYInches ? (-stats.groupCenterYInches).toFixed(4) : 'N/A',
        'POI Horizontal (in)': stats.groupCenterXInches?.toFixed(4) || 'N/A'
      };
    });

    // Shot details sheet
    const shotDetails = [];
    session.targets.forEach((target, targetIndex) => {
      if (target.shots && target.shots.length > 0) {
        target.shots.forEach((shot, shotIndex) => {
          const xInches = (shot.x - target.x) / target.pixelsPerInch;
          const yInches = (shot.y - target.y) / target.pixelsPerInch;
          const radiusInches = Math.sqrt(xInches * xInches + yInches * yInches);

          shotDetails.push({
            'Target #': targetIndex + 1,
            'Shot #': shotIndex + 1,
            'X Offset (in)': xInches.toFixed(4),
            'Y Offset (in)': yInches.toFixed(4),
            'Radius from Target Center (in)': radiusInches.toFixed(4)
          });
        });
      }
    });

    // Create workbook
    const wb = XLSX.utils.book_new();

    const infoWs = XLSX.utils.json_to_sheet(sessionInfo);
    XLSX.utils.book_append_sheet(wb, infoWs, 'Session Info');

    const statsWs = XLSX.utils.json_to_sheet(targetStats);
    XLSX.utils.book_append_sheet(wb, statsWs, 'Target Statistics');

    if (shotDetails.length > 0) {
      const shotsWs = XLSX.utils.json_to_sheet(shotDetails);
      XLSX.utils.book_append_sheet(wb, shotsWs, 'Shot Details');
    }

    // Add chrono data if available
    if (session.chronoData?.shots && session.chronoData.shots.length > 0) {
      const chronoData = session.chronoData.shots.map((velocity, index) => ({
        'Shot #': index + 1,
        'Velocity (fps)': velocity
      }));
      const chronoWs = XLSX.utils.json_to_sheet(chronoData);
      XLSX.utils.book_append_sheet(wb, chronoWs, 'Chronograph');
    }

    // Generate and download
    const safeName = session.name.replace(/[^a-z0-9]/gi, '-').substring(0, 30);
    const filename = `prs-session-${safeName}-${session.date}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Statistical t-test function with error reporting
  const performTTest = (group1, group2, paired = false) => {
    // Check for empty groups
    if (group1.length === 0 && group2.length === 0) {
      return { error: 'Both groups have no data. Select groups with shot data to compare.' };
    }
    if (group1.length === 0) {
      return { error: 'Group A has no data. Select a group with shot data.' };
    }
    if (group2.length === 0) {
      return { error: 'Group B has no data. Select a group with shot data.' };
    }

    // Check for minimum sample size (need at least 2 per group for variance calculation)
    if (group1.length < 2) {
      return { error: `Group A has only ${group1.length} shot(s). T-test requires at least 2 shots per group.` };
    }
    if (group2.length < 2) {
      return { error: `Group B has only ${group2.length} shot(s). T-test requires at least 2 shots per group.` };
    }

    // Warn about low sample sizes (less reliable results)
    const lowSampleWarning = (group1.length < 5 || group2.length < 5)
      ? `Note: Small sample sizes (A: ${group1.length}, B: ${group2.length}) may produce unreliable results. Consider collecting more data.`
      : null;

    const mean1 = group1.reduce((sum, x) => sum + x, 0) / group1.length;
    const mean2 = group2.reduce((sum, x) => sum + x, 0) / group2.length;

    if (paired && group1.length !== group2.length) {
      return { error: 'Paired t-test requires equal sample sizes in both groups.' };
    }

    let tStat, df;

    if (paired) {
      const differences = group1.map((x, i) => x - group2[i]);
      const meanDiff = differences.reduce((sum, d) => sum + d, 0) / differences.length;
      const variance = differences.reduce((sum, d) => sum + Math.pow(d - meanDiff, 2), 0) / (differences.length - 1);
      if (variance === 0) {
        return { error: 'Cannot perform t-test: no variance in differences between groups.' };
      }
      const stdError = Math.sqrt(variance / differences.length);
      tStat = meanDiff / stdError;
      df = differences.length - 1;
    } else {
      const var1 = group1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (group1.length - 1);
      const var2 = group2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (group2.length - 1);

      // Check for zero variance
      if (var1 === 0 && var2 === 0) {
        return { error: 'Cannot perform t-test: both groups have zero variance (all values are identical).' };
      }

      const pooledSE = Math.sqrt(var1 / group1.length + var2 / group2.length);
      if (pooledSE === 0) {
        return { error: 'Cannot perform t-test: standard error is zero.' };
      }
      tStat = (mean1 - mean2) / pooledSE;
      df = group1.length + group2.length - 2;
    }

    // Check for NaN results
    if (isNaN(tStat) || !isFinite(tStat)) {
      return { error: 'T-test calculation produced invalid results. Check your data for anomalies.' };
    }

    const tCritical = 2.0;
    const significant = Math.abs(tStat) > tCritical;

    return {
      mean1: mean1.toFixed(4),
      mean2: mean2.toFixed(4),
      tStat: tStat.toFixed(4),
      df: Math.round(df),
      significant,
      pValue: significant ? '< 0.05' : '> 0.05',
      n1: group1.length,
      n2: group2.length,
      warning: lowSampleWarning
    };
  };

  // Get comparison data - using INDIVIDUAL SHOTS for proper statistical analysis
  const getComparisonData = () => {
    const groupsByLoad = {};
    const groupsByRifle = {};
    const groupsBySession = {};

    sessions.forEach(session => {
      session.targets.forEach(target => {
        if (target.shots.length >= 2) {
          const stats = target.stats || calculateGroupStats(target.shots, target.x, target.y, target.pixelsPerInch);

          // Store individual shot distances from center (more statistically valid)
          const shotDistances = target.shots.map(shot => {
            const dx = shot.x - target.x;
            const dy = shot.y - target.y;
            const distPx = Math.sqrt(dx * dx + dy * dy);
            return distPx / target.pixelsPerInch; // Convert to inches
          });

          if (!groupsByLoad[session.load]) groupsByLoad[session.load] = { groups: [], shots: [] };
          groupsByLoad[session.load].groups.push(stats.sizeInches);
          groupsByLoad[session.load].shots.push(...shotDistances); // Add individual shots

          if (!groupsByRifle[session.rifle]) groupsByRifle[session.rifle] = { groups: [], shots: [] };
          groupsByRifle[session.rifle].groups.push(stats.sizeInches);
          groupsByRifle[session.rifle].shots.push(...shotDistances);

          if (!groupsBySession[session.id]) groupsBySession[session.id] = { name: session.name, groups: [], shots: [] };
          groupsBySession[session.id].groups.push(stats.sizeInches);
          groupsBySession[session.id].shots.push(...shotDistances);
        }
      });
    });

    return { groupsByLoad, groupsByRifle, groupsBySession };
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target.result);
        setCaptureStep('setup');
        setSelectedTargets([]);
        setTargetDiameter('');
      };
      reader.readAsDataURL(file);
    }
  };

  // Find orange circle using edge detection
  // Convert RGB to HSV for better color detection
  const rgbToHsv = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    if (diff !== 0) {
      if (max === r) {
        h = 60 * (((g - b) / diff) % 6);
      } else if (max === g) {
        h = 60 * (((b - r) / diff) + 2);
      } else {
        h = 60 * (((r - g) / diff) + 4);
      }
    }
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : diff / max;
    const v = max;

    return { h, s, v };
  };

  // Improved color detection supporting multiple target colors
  const isTargetColor = (r, g, b, colorMode = 'orange') => {
    const hsv = rgbToHsv(r, g, b);

    // Orange detection (improved with HSV)
    if (colorMode === 'orange') {
      // Orange hue: 15-45 degrees, high saturation, medium-high value
      return (
        (hsv.h >= 10 && hsv.h <= 50) &&  // Orange hue range
        hsv.s >= 0.3 &&                   // Minimum saturation (not too gray)
        hsv.v >= 0.35                     // Minimum brightness (not too dark)
      );
    }

    // Black/dark target detection
    if (colorMode === 'black') {
      return hsv.v < 0.3;  // Low brightness
    }

    // White target detection
    if (colorMode === 'white') {
      return hsv.v > 0.7 && hsv.s < 0.2;  // High brightness, low saturation
    }

    // Red detection (for alternative targets)
    if (colorMode === 'red') {
      return (
        ((hsv.h >= 0 && hsv.h <= 15) || (hsv.h >= 345 && hsv.h <= 360)) &&
        hsv.s >= 0.4 &&
        hsv.v >= 0.3
      );
    }

    return false;
  };

  const findOrangeCircle = (clickX, clickY, imageData, width, height, colorMode = 'orange') => {
    const maxRadius = Math.min(width, height) / 3;  // Increased from 1/4 to 1/3
    const samples = 64;  // Increased from 32 to 64 for better accuracy
    const radii = [];

    // Adaptive step size based on image resolution
    const baseStepSize = Math.max(1, Math.floor(Math.min(width, height) / 1000));

    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);

      let lastTargetRadius = 0;
      let consecutiveNonTarget = 0;
      const maxGap = 20;  // Increased tolerance for gaps

      for (let r = 3; r < maxRadius; r += baseStepSize) {
        const x = Math.round(clickX + dx * r);
        const y = Math.round(clickY + dy * r);

        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          const red = imageData.data[idx];
          const green = imageData.data[idx + 1];
          const blue = imageData.data[idx + 2];

          const isTarget = isTargetColor(red, green, blue, colorMode);

          if (isTarget) {
            lastTargetRadius = r;
            consecutiveNonTarget = 0;
          } else if (lastTargetRadius > 0) {
            consecutiveNonTarget += baseStepSize;
            if (consecutiveNonTarget > maxGap) {
              break;  // Found edge
            }
          }
        }
      }

      // Lower minimum radius threshold
      if (lastTargetRadius > 5) {
        radii.push(lastTargetRadius);
      }
    }

    // More lenient threshold: require 40% successful samples instead of 50%
    if (radii.length < samples * 0.4) {
      return null;
    }

    // Calculate statistics for confidence
    radii.sort((a, b) => a - b);
    const median = radii[Math.floor(radii.length / 2)];
    const mean = radii.reduce((sum, r) => sum + r, 0) / radii.length;

    // Calculate standard deviation
    const variance = radii.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / radii.length;
    const stdDev = Math.sqrt(variance);

    // Calculate confidence score (0-1)
    const coefficientOfVariation = stdDev / mean;
    const confidence = Math.max(0, Math.min(1, 1 - coefficientOfVariation));

    // Use median instead of trimmed mean for better robustness
    // But if confidence is high, use mean for precision
    const finalRadius = confidence > 0.7 ? mean : median;

    return {
      radius: finalRadius,
      confidence: confidence,
      stdDev: stdDev,
      sampleCount: radii.length,
      allRadii: radii
    };
  };

  // Auto-detect bullet holes using OpenCV with improved multi-strategy detection
  const detectBulletHoles = async (target, imageUrl) => {
    return new Promise((resolve, reject) => {
      // Check if OpenCV is loaded
      if (!window.cv) {
        reject(new Error('OpenCV is not loaded yet. Please wait and try again.'));
        return;
      }

      const cv = window.cv;
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          // Load image into canvas
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // Get target region coordinates
          const currentX = target.adjustedX ?? target.x;
          const currentY = target.adjustedY ?? target.y;
          const currentRadius = target.adjustedRadius || target.radius;

          // Create LARGER region of interest (ROI) - search 3x radius to catch flyers
          const searchRadius = currentRadius * 3;
          const roiX = Math.max(0, Math.floor(currentX - searchRadius));
          const roiY = Math.max(0, Math.floor(currentY - searchRadius));
          const roiWidth = Math.min(img.width - roiX, Math.ceil(searchRadius * 2));
          const roiHeight = Math.min(img.height - roiY, Math.ceil(searchRadius * 2));

          // Load full image into OpenCV
          let src = cv.imread(canvas);
          let roi = src.roi(new cv.Rect(roiX, roiY, roiWidth, roiHeight));
          let gray = new cv.Mat();
          let detectedShots = [];

          // Convert to grayscale
          cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);

          // Strategy 1: Hough Circle Transform (best for clean circular holes)
          try {
            let circles = new cv.Mat();
            const minRadius = Math.max(2, Math.floor(target.pixelsPerInch * 0.05));
            const maxRadius = Math.max(minRadius + 1, Math.floor(target.pixelsPerInch * 0.5));

            cv.HoughCircles(
              gray,
              circles,
              cv.HOUGH_GRADIENT,
              1,
              minRadius * 2, // min distance between circles
              100, // Canny high threshold
              30,  // accumulator threshold (lower = more permissive)
              minRadius,
              maxRadius
            );

            for (let i = 0; i < circles.cols; i++) {
              const x = circles.data32F[i * 3];
              const y = circles.data32F[i * 3 + 1];
              const shotX = roiX + x;
              const shotY = roiY + y;

              const distFromCenter = Math.sqrt(
                Math.pow(shotX - currentX, 2) + Math.pow(shotY - currentY, 2)
              );

              // Accept shots within search radius (not just inside target circle)
              if (distFromCenter <= searchRadius) {
                detectedShots.push({ x: shotX, y: shotY });
              }
            }
            circles.delete();
          } catch (e) {
            console.warn('Hough circles failed:', e);
          }

          // Strategy 2: Contour-based detection (handles irregular holes)
          try {
            let blurred = new cv.Mat();
            let thresh = new cv.Mat();
            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();

            // Bilateral filter preserves edges while reducing noise
            cv.bilateralFilter(gray, blurred, 9, 75, 75);

            // Try adaptive thresholding
            cv.adaptiveThreshold(
              blurred,
              thresh,
              255,
              cv.ADAPTIVE_THRESH_GAUSSIAN_C,
              cv.THRESH_BINARY_INV,
              21,
              8
            );

            // Morphological operations
            let kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
            cv.morphologyEx(thresh, thresh, cv.MORPH_CLOSE, kernel);
            cv.morphologyEx(thresh, thresh, cv.MORPH_OPEN, kernel);

            // Find contours
            cv.findContours(
              thresh,
              contours,
              hierarchy,
              cv.RETR_EXTERNAL,
              cv.CHAIN_APPROX_SIMPLE
            );

            const minArea = Math.PI * Math.pow(target.pixelsPerInch * 0.04, 2);
            const maxArea = Math.PI * Math.pow(target.pixelsPerInch * 0.7, 2);

            for (let i = 0; i < contours.size(); i++) {
              const contour = contours.get(i);
              const area = cv.contourArea(contour);

              if (area >= minArea && area <= maxArea) {
                const perimeter = cv.arcLength(contour, true);
                const circularity = (4 * Math.PI * area) / (perimeter * perimeter);

                // Accept circular-ish shapes (0.3-1.0 for irregular/touching holes)
                if (circularity > 0.3) {
                  const moments = cv.moments(contour);
                  if (moments.m00 !== 0) {
                    const cx = moments.m10 / moments.m00;
                    const cy = moments.m01 / moments.m00;
                    const shotX = roiX + cx;
                    const shotY = roiY + cy;

                    const distFromCenter = Math.sqrt(
                      Math.pow(shotX - currentX, 2) + Math.pow(shotY - currentY, 2)
                    );

                    // Accept shots within search radius (not just inside target circle)
                    if (distFromCenter <= searchRadius) {
                      detectedShots.push({ x: shotX, y: shotY });
                    }
                  }
                }
              }
            }

            blurred.delete();
            thresh.delete();
            contours.delete();
            hierarchy.delete();
            kernel.delete();
          } catch (e) {
            console.warn('Contour detection failed:', e);
          }

          // Remove duplicates (shots detected by both strategies)
          const uniqueShots = [];
          const mergeDistance = target.pixelsPerInch * 0.1; // Merge within 0.1"

          detectedShots.forEach(shot => {
            const isDuplicate = uniqueShots.some(existing =>
              Math.sqrt(Math.pow(shot.x - existing.x, 2) + Math.pow(shot.y - existing.y, 2)) < mergeDistance
            );
            if (!isDuplicate) {
              uniqueShots.push({
                id: Date.now() + uniqueShots.length,
                x: shot.x,
                y: shot.y
              });
            }
          });

          // Clean up
          src.delete();
          roi.delete();
          gray.delete();

          resolve(uniqueShots);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  };

  // Save training image for OpenCV improvement (to Firebase for shared ML training)
  const saveTrainingImage = async (target, imageUrl) => {
    try {
      // Create canvas to extract target region
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      const canvas = document.createElement('canvas');
      const currentX = target.adjustedX ?? target.x;
      const currentY = target.adjustedY ?? target.y;
      const currentRadius = target.adjustedRadius || target.radius;

      // Crop to target with some padding
      const padding = currentRadius * 0.5;
      const size = (currentRadius + padding) * 2;
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        img,
        currentX - currentRadius - padding,
        currentY - currentRadius - padding,
        size,
        size,
        0,
        0,
        size,
        size
      );

      // Convert to blob and upload to Firebase
      canvas.toBlob(async (blob) => {
        try {
          const trainingId = await addTrainingImage(blob, {
            shots: target.shots.length,
            diameter: target.diameterInches,
            // Add target center coordinates for training target detection
            centerX: currentRadius + padding, // Center in cropped image
            centerY: currentRadius + padding,
            radius: currentRadius,
            // Original image dimensions for context
            imageWidth: img.naturalWidth,
            imageHeight: img.naturalHeight
          });
          if (trainingId) {
            console.log('Training image uploaded (target center + bullet holes):', trainingId);
          }
        } catch (error) {
          console.error('Error uploading training image:', error);
          // Silent fail - don't disrupt user flow
        }
      }, 'image/jpeg', 0.8);
    } catch (error) {
      console.error('Error saving training image:', error);
      // Silent fail - training data is optional
    }
  };

  // Handle target selection click - SIMPLIFIED: just place numbered markers
  const handleTargetClick = (e) => {
    if (!targetDiameter || parseFloat(targetDiameter) <= 0) {
      alert('Please enter the target diameter first');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const img = new Image();
    img.onload = () => {
      const clickX = (e.clientX - rect.left) * (img.width / rect.width);
      const clickY = (e.clientY - rect.top) * (img.height / rect.height);

      // Create target with estimated circle (user will drag/resize on next screen)
      const estimatedRadius = (img.width / 15); // Rough estimate, user adjusts visually
      const pixelsPerInch = (estimatedRadius * 2) / parseFloat(targetDiameter);

      const newTarget = {
        id: Date.now(),
        x: clickX,
        y: clickY,
        radius: estimatedRadius,
        diameterInches: parseFloat(targetDiameter),
        pixelsPerInch: pixelsPerInch,
        shots: [],
        imageWidth: img.width,
        imageHeight: img.height,
        adjustedX: null,
        adjustedY: null,
        adjustedRadius: null
      };

      setSelectedTargets(prev => [...prev, newTarget]);
    };

    img.src = uploadedImage;
  };

  // Calculate group statistics
  // Mean radius is calculated from the GROUP CENTER (centroid of shots), not the target center
  const calculateGroupStats = (shots, centerX, centerY, pixelsPerInch) => {
    if (shots.length === 0) return {
      size: 0,
      sizeInches: 0,
      meanRadius: 0,
      meanRadiusInches: 0,
      standardDev: 0,
      standardDevInches: 0,
      groupCenterX: centerX,
      groupCenterY: centerY,
      groupCenterXInches: 0,
      groupCenterYInches: 0,
      shotsRelativeToCenter: []
    };

    // First, calculate the group center (centroid of all shots)
    const groupCenterX = shots.reduce((sum, shot) => sum + shot.x, 0) / shots.length;
    const groupCenterY = shots.reduce((sum, shot) => sum + shot.y, 0) / shots.length;

    // Shots relative to TARGET center (for POI calculations)
    const shotsRelativeToCenter = shots.map(shot => ({
      x: shot.x - centerX,
      y: shot.y - centerY,
      xInches: (shot.x - centerX) / pixelsPerInch,
      yInches: (shot.y - centerY) / pixelsPerInch,
      radius: Math.sqrt(Math.pow(shot.x - centerX, 2) + Math.pow(shot.y - centerY, 2)),
      radiusInches: Math.sqrt(Math.pow(shot.x - centerX, 2) + Math.pow(shot.y - centerY, 2)) / pixelsPerInch
    }));

    // Calculate distances from GROUP CENTER (for mean radius - proper statistical measure)
    const distancesFromGroupCenter = shots.map(shot =>
      Math.sqrt(Math.pow(shot.x - groupCenterX, 2) + Math.pow(shot.y - groupCenterY, 2))
    );

    // Mean radius from group center (correct calculation)
    const meanRadius = distancesFromGroupCenter.reduce((sum, d) => sum + d, 0) / shots.length;
    const meanRadiusInches = meanRadius / pixelsPerInch;

    // Standard deviation of radii from mean radius (using sample variance n-1 for small samples)
    const n = shots.length;
    const variance = n > 1
      ? distancesFromGroupCenter.reduce((sum, d) => sum + Math.pow(d - meanRadius, 2), 0) / (n - 1)
      : 0;
    const standardDev = Math.sqrt(variance);
    const standardDevInches = standardDev / pixelsPerInch;

    // Group size (extreme spread - max distance between any two shots)
    let maxDistance = 0;
    for (let i = 0; i < shots.length; i++) {
      for (let j = i + 1; j < shots.length; j++) {
        const dx = shots[i].x - shots[j].x;
        const dy = shots[i].y - shots[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        maxDistance = Math.max(maxDistance, distance);
      }
    }

    return {
      size: maxDistance,
      sizeInches: maxDistance / pixelsPerInch,
      meanRadius: meanRadius,
      meanRadiusInches: meanRadiusInches,
      standardDev: standardDev,
      standardDevInches: standardDevInches,
      groupCenterX: groupCenterX,
      groupCenterY: groupCenterY,
      groupCenterXInches: (groupCenterX - centerX) / pixelsPerInch,
      groupCenterYInches: (groupCenterY - centerY) / pixelsPerInch,
      shotsRelativeToCenter: shotsRelativeToCenter
    };
  };

  // Save session
  const saveSession = async () => {
    if (!user) {
      alert('You must be logged in to save sessions');
      return;
    }

    try {
      const targetsWithStats = selectedTargets.map(target => {
        const finalX = target.adjustedX ?? target.x;
        const finalY = target.adjustedY ?? target.y;
        const finalRadius = target.adjustedRadius || target.radius;

        return {
          ...target,
          x: finalX,
          y: finalY,
          radius: finalRadius,
          stats: calculateGroupStats(target.shots, finalX, finalY, target.pixelsPerInch)
        };
      });

      // Save training images for OpenCV improvement
      for (const target of selectedTargets) {
        if (target.shots && target.shots.length > 0) {
          await saveTrainingImage(target, uploadedImage);
        }
      }

      // Generate session name if not provided: "{Date} {Rifle}"
      let sessionName = sessionData.name?.trim();
      if (!sessionName) {
        sessionName = `${sessionData.date} ${sessionData.rifle}`;
      }

      // Check for duplicate name and append number if needed
      const existingNames = sessions.map(s => s.name.toLowerCase());
      let finalName = sessionName;
      let counter = 2;
      while (existingNames.includes(finalName.toLowerCase())) {
        finalName = `${sessionName} (${counter})`;
        counter++;
      }

      const sessionToSave = {
        ...sessionData,
        name: finalName,
        targets: targetsWithStats
        // Note: Image not saved - only needed during capture, not for historical reference
      };

      // Save to Firestore (without image - keeps documents small and free)
      const sessionId = await addSession(user.uid, sessionToSave);

      // Update local state with new session
      const newSession = {
        id: sessionId,
        ...sessionToSave
      };
      setSessions(prev => [...prev, newSession]);

      // Reset capture state
      setCaptureStep('upload');
      setUploadedImage(null);
      setSelectedTargets([]);
      setTargetDiameter('');
      setSessionData({
        name: '',
        date: new Date().toISOString().split('T')[0],
        rifle: '',
        load: '',
        distance: 100,
        temperature: 70,
        humidity: 50,
        windSpeed: 0,
        windDirection: '12',
        pressure: 29.92,
        chronoData: null
      });

      setActiveTab('analytics');
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Failed to save session. Please try again.');
    }
  };

  // Generate analytics report
  const generateAnalyticsReport = () => {
    let filteredSessions = sessions;
    
    if (analyticsFilters.rifle !== 'all') {
      filteredSessions = filteredSessions.filter(s => s.rifle === analyticsFilters.rifle);
    }
    if (analyticsFilters.load !== 'all') {
      filteredSessions = filteredSessions.filter(s => s.load === analyticsFilters.load);
    }
    if (analyticsFilters.session !== 'all') {
      filteredSessions = filteredSessions.filter(s => s.id === analyticsFilters.session);
    }
    if (analyticsFilters.silencer !== 'all') {
      const wantsSilencer = analyticsFilters.silencer === 'true';
      filteredSessions = filteredSessions.filter(s => s.silencer === wantsSilencer);
    }
    // Distance filter
    filteredSessions = filteredSessions.filter(s => {
      const dist = s.distance || 0;
      return dist >= analyticsFilters.distance[0] && dist <= analyticsFilters.distance[1];
    });
    
    const allShots = [];
    const targetStats = [];
    
    filteredSessions.forEach(session => {
      session.targets.forEach((target, targetIndex) => {
        const stats = target.stats || calculateGroupStats(
          target.shots, 
          target.x, 
          target.y, 
          target.pixelsPerInch
        );
        
        // Calculate POI (Point of Impact) metrics
        // Positive Y = below center (in image coords), so we negate for "drop" semantics
        const poiVerticalInches = -stats.groupCenterYInches; // Negative = below center (drop)
        const poiHorizontalInches = stats.groupCenterXInches; // Positive = right of center
        const distance = session.distance || 100; // Default to 100 yards if not specified

        // Vertical POI in mils and MOA
        const poiVerticalMils = distance > 0 ? (poiVerticalInches * 27.78) / distance : 0;
        const poiVerticalMOA = distance > 0 ? (poiVerticalInches * 95.5) / distance : 0;

        // Horizontal POI in mils and MOA
        const poiHorizontalMils = distance > 0 ? (poiHorizontalInches * 27.78) / distance : 0;
        const poiHorizontalMOA = distance > 0 ? (poiHorizontalInches * 95.5) / distance : 0;

        targetStats.push({
          sessionId: session.id,
          sessionName: session.name,
          date: session.date,
          rifle: session.rifle,
          load: session.load,
          silencer: session.silencer,
          distance: distance,
          targetIndex: targetIndex + 1,
          shots: target.shots.length,
          groupSize: stats.sizeInches,
          meanRadius: stats.meanRadiusInches,
          standardDev: stats.standardDevInches,
          groupCenterX: stats.groupCenterXInches,
          groupCenterY: stats.groupCenterYInches,
          poiVerticalInches: poiVerticalInches,
          poiVerticalMils: poiVerticalMils,
          poiVerticalMOA: poiVerticalMOA,
          poiHorizontalInches: poiHorizontalInches,
          poiHorizontalMils: poiHorizontalMils,
          poiHorizontalMOA: poiHorizontalMOA,
          chronoAvg: session.chronoData?.average,
          chronoES: session.chronoData?.es,
          chronoSD: session.chronoData?.sd
        });
      });
    });
    
    const aggregateStats = {
      totalSessions: filteredSessions.length,
      totalTargets: targetStats.length,
      totalShots: targetStats.reduce((sum, t) => sum + t.shots, 0),
      avgGroupSize: targetStats.length > 0 
        ? targetStats.reduce((sum, t) => sum + t.groupSize, 0) / targetStats.length 
        : 0,
      bestGroup: targetStats.length > 0 
        ? Math.min(...targetStats.map(t => t.groupSize))
        : 0,
      worstGroup: targetStats.length > 0
        ? Math.max(...targetStats.map(t => t.groupSize))
        : 0
    };
    
    return {
      filters: analyticsFilters,
      aggregateStats,
      targetStats,
      filteredSessions
    };
  };

  // Navigation component
  const Navigation = () => (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors">
      <div className="max-w-7xl mx-auto px-4">
        <div className={`flex justify-between items-center ${isMobile ? 'h-14' : 'h-16'}`}>
          <div className="flex items-center space-x-2">
            <Target className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-purple-600 dark:text-purple-400`} />
            <h1 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900 dark:text-white`}>PRS Analytics</h1>
          </div>
          <div className="flex items-center space-x-2">
            {user && (
              <nav className={`flex ${isMobile ? 'space-x-2' : 'space-x-8'}`}>
                {[
                  { id: 'home', label: 'Home', icon: Home },
                  { id: 'capture', label: 'Capture', icon: Camera },
                  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                  { id: 'ballistics', label: 'Ballistics', icon: Crosshair },
                  { id: 'reloading', label: 'Reloading', icon: Wrench },
                  { id: 'equipment', label: 'Equipment', icon: Settings }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center ${isMobile ? 'space-x-1 px-2 py-1' : 'space-x-2 px-3 py-2'} rounded-md ${isMobile ? 'text-xs' : 'text-sm'} font-medium transition-colors ${
                      activeTab === id
                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
                    {!isMobile && <span>{label}</span>}
                  </button>
                ))}
              </nav>
            )}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {user && <Auth user={user} />}
          </div>
        </div>
      </div>
    </div>
  );

  // Ballistics Tab Component
  const BallisticsTab = ({ equipment, user, setEquipment }) => {
    const [selectedLoadId, setSelectedLoadId] = useState('');
    const [sightHeight, setSightHeight] = useState('1.5');
    const [zeroDistance, setZeroDistance] = useState('100');
    const [temperature, setTemperature] = useState('59');
    const [altitude, setAltitude] = useState('0');
    const [pressure, setPressure] = useState('29.92');
    const [humidity, setHumidity] = useState('50');
    const [windSpeed, setWindSpeed] = useState('10');
    const [windAngle, setWindAngle] = useState('90');
    const [maxRange, setMaxRange] = useState('1000');
    const [rangeIncrement, setRangeIncrement] = useState('100');
    const [truingData, setTruingData] = useState([]); // {distance, observedDrop, observedWindage}
    const [showTruingModal, setShowTruingModal] = useState(false);
    const [newTruing, setNewTruing] = useState({ distance: '', observedDrop: '', observedWindage: '' });
    const [calculatedTable, setCalculatedTable] = useState([]);
    const [truingFactor, setTruingFactor] = useState(1.0);
    const [turretDiameter, setTurretDiameter] = useState('1.5'); // inches - for sight tape
    const [clickValue, setClickValue] = useState('0.25'); // MOA per click
    const [turretRevolutions, setTurretRevolutions] = useState('10'); // MOA per revolution
    const chartRef = useRef(null);

    // Inline editing state for ballistics data
    const [editingBC, setEditingBC] = useState('');
    const [editingBCType, setEditingBCType] = useState('G1');
    const [editingMV, setEditingMV] = useState('');
    const [editingVelocitySD, setEditingVelocitySD] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const selectedLoad = equipment.loads.find(l => l.id === selectedLoadId);

    // Update editing state when load selection changes
    useEffect(() => {
      if (selectedLoad) {
        setEditingBC(selectedLoad.bc || '');
        setEditingBCType(selectedLoad.bcType || 'G1');
        setEditingMV(selectedLoad.muzzleVelocity || '');
        setEditingVelocitySD(selectedLoad.velocitySD || '');
      } else {
        setEditingBC('');
        setEditingBCType('G1');
        setEditingMV('');
        setEditingVelocitySD('');
      }
    }, [selectedLoadId, selectedLoad]);

    // Save ballistics data to load
    const saveBallisticsData = async () => {
      if (!selectedLoad || !user) return;

      setIsSaving(true);
      try {
        const updatedData = {
          ...selectedLoad,
          bc: editingBC,
          bcType: editingBCType,
          muzzleVelocity: editingMV,
          velocitySD: editingVelocitySD
        };

        await updateLoad(user.uid, selectedLoad.id, updatedData);

        // Update local state
        setEquipment(prev => ({
          ...prev,
          loads: prev.loads.map(l =>
            l.id === selectedLoad.id ? { ...l, ...updatedData } : l
          )
        }));
      } catch (error) {
        console.error('Error saving ballistics data:', error);
        alert('Failed to save ballistics data. Please try again.');
      }
      setIsSaving(false);
    };

    // Check if ballistics data has been modified
    const hasModifiedData = selectedLoad && (
      editingBC !== (selectedLoad.bc || '') ||
      editingBCType !== (selectedLoad.bcType || 'G1') ||
      editingMV !== (selectedLoad.muzzleVelocity || '') ||
      editingVelocitySD !== (selectedLoad.velocitySD || '')
    );

    // Check if we have complete ballistics data
    const hasCompleteData = editingBC && editingMV;

    // Standard atmosphere constants (ICAO standard atmosphere)
    const STANDARD_TEMP_F = 59; // 15°C
    const STANDARD_PRESSURE_INHG = 29.92; // sea level
    const STANDARD_AIR_DENSITY = 0.0764742; // lb/ft³ at sea level, 59°F

    // G1 Drag Coefficient Table (Cd vs Mach) - from JBM Ballistics / Ingalls tables
    const G1_DRAG_TABLE = [
      [0.00, 0.2629], [0.05, 0.2558], [0.10, 0.2487], [0.15, 0.2413], [0.20, 0.2344],
      [0.25, 0.2278], [0.30, 0.2214], [0.35, 0.2155], [0.40, 0.2104], [0.45, 0.2061],
      [0.50, 0.2032], [0.55, 0.2020], [0.60, 0.2034], [0.65, 0.2165], [0.70, 0.2230],
      [0.75, 0.2313], [0.80, 0.2417], [0.85, 0.2546], [0.90, 0.2706], [0.925, 0.2859],
      [0.95, 0.3052], [0.975, 0.3310], [1.00, 0.3613], [1.025, 0.3936], [1.05, 0.4241],
      [1.075, 0.4510], [1.10, 0.4740], [1.125, 0.4935], [1.15, 0.5100], [1.175, 0.5237],
      [1.20, 0.5351], [1.25, 0.5523], [1.30, 0.5637], [1.35, 0.5714], [1.40, 0.5762],
      [1.45, 0.5786], [1.50, 0.5793], [1.55, 0.5787], [1.60, 0.5770], [1.65, 0.5745],
      [1.70, 0.5713], [1.75, 0.5677], [1.80, 0.5636], [1.85, 0.5593], [1.90, 0.5548],
      [1.95, 0.5501], [2.00, 0.5454], [2.05, 0.5406], [2.10, 0.5358], [2.15, 0.5311],
      [2.20, 0.5264], [2.25, 0.5217], [2.30, 0.5171], [2.35, 0.5125], [2.40, 0.5080],
      [2.45, 0.5036], [2.50, 0.4993], [2.60, 0.4908], [2.70, 0.4826], [2.80, 0.4748],
      [2.90, 0.4673], [3.00, 0.4601], [3.10, 0.4532], [3.20, 0.4466], [3.30, 0.4403],
      [3.40, 0.4342], [3.50, 0.4284], [3.60, 0.4228], [3.70, 0.4175], [3.80, 0.4123],
      [3.90, 0.4073], [4.00, 0.4026], [4.20, 0.3934], [4.40, 0.3849], [4.60, 0.3770],
      [4.80, 0.3696], [5.00, 0.3627]
    ];

    // G7 Drag Coefficient Table (Cd vs Mach) - from JBM Ballistics / Applied Ballistics
    const G7_DRAG_TABLE = [
      [0.00, 0.1198], [0.05, 0.1197], [0.10, 0.1196], [0.15, 0.1194], [0.20, 0.1193],
      [0.25, 0.1194], [0.30, 0.1194], [0.35, 0.1194], [0.40, 0.1193], [0.45, 0.1193],
      [0.50, 0.1194], [0.55, 0.1193], [0.60, 0.1194], [0.65, 0.1197], [0.70, 0.1202],
      [0.725, 0.1207], [0.75, 0.1215], [0.775, 0.1226], [0.80, 0.1242], [0.825, 0.1266],
      [0.85, 0.1306], [0.875, 0.1368], [0.90, 0.1464], [0.925, 0.1660], [0.95, 0.2054],
      [0.975, 0.2993], [1.00, 0.3803], [1.025, 0.4015], [1.05, 0.4043], [1.075, 0.4034],
      [1.10, 0.4014], [1.125, 0.3987], [1.15, 0.3955], [1.175, 0.3921], [1.20, 0.3884],
      [1.25, 0.3807], [1.30, 0.3727], [1.35, 0.3647], [1.40, 0.3567], [1.45, 0.3488],
      [1.50, 0.3411], [1.55, 0.3337], [1.60, 0.3265], [1.65, 0.3196], [1.70, 0.3130],
      [1.75, 0.3067], [1.80, 0.3008], [1.85, 0.2952], [1.90, 0.2899], [1.95, 0.2849],
      [2.00, 0.2801], [2.05, 0.2756], [2.10, 0.2714], [2.15, 0.2674], [2.20, 0.2636],
      [2.25, 0.2600], [2.30, 0.2566], [2.35, 0.2534], [2.40, 0.2503], [2.45, 0.2474],
      [2.50, 0.2446], [2.55, 0.2419], [2.60, 0.2394], [2.65, 0.2370], [2.70, 0.2347],
      [2.75, 0.2325], [2.80, 0.2304], [2.85, 0.2283], [2.90, 0.2264], [2.95, 0.2245],
      [3.00, 0.2228], [3.10, 0.2194], [3.20, 0.2163], [3.30, 0.2133], [3.40, 0.2105],
      [3.50, 0.2079], [3.60, 0.2054], [3.70, 0.2030], [3.80, 0.2008], [3.90, 0.1987],
      [4.00, 0.1966], [4.20, 0.1928], [4.40, 0.1893], [4.60, 0.1861], [4.80, 0.1831],
      [5.00, 0.1803]
    ];

    // Interpolate drag coefficient from table
    const getDragCoefficient = (mach, bcType) => {
      const table = bcType === 'G7' ? G7_DRAG_TABLE : G1_DRAG_TABLE;

      // Find the two points to interpolate between
      let i = 0;
      while (i < table.length - 1 && table[i + 1][0] < mach) {
        i++;
      }

      if (i >= table.length - 1) {
        return table[table.length - 1][1];
      }

      const [m1, cd1] = table[i];
      const [m2, cd2] = table[i + 1];

      // Linear interpolation
      const t = (mach - m1) / (m2 - m1);
      return cd1 + t * (cd2 - cd1);
    };

    // Calculate air density ratio relative to standard
    const getAirDensityRatio = () => {
      const tempF = parseFloat(temperature);
      const pressInHg = parseFloat(pressure);
      const humidityPct = parseFloat(humidity);
      const altFt = parseFloat(altitude);

      // Temperature ratio (absolute temps in Rankine)
      const tempR = tempF + 459.67;
      const stdTempR = STANDARD_TEMP_F + 459.67;

      // Pressure adjustment for altitude if pressure is at sea level
      // Station pressure vs barometric pressure correction
      const pressureRatio = pressInHg / STANDARD_PRESSURE_INHG;

      // Humidity effect on air density (water vapor is less dense than dry air)
      // Saturation vapor pressure (simplified Magnus formula)
      const tempC = (tempF - 32) * 5 / 9;
      const satVaporPress = 6.1078 * Math.pow(10, (7.5 * tempC) / (tempC + 237.3)); // hPa
      const vaporPress = (humidityPct / 100) * satVaporPress;
      const dryAirPress = (pressInHg * 33.8639) - vaporPress; // Convert to hPa
      const humidityFactor = (dryAirPress + 0.622 * vaporPress) / (pressInHg * 33.8639);

      // Combined density ratio
      return pressureRatio * (stdTempR / tempR) * humidityFactor;
    };

    // Speed of sound based on temperature (fps)
    const getSpeedOfSound = () => {
      const tempF = parseFloat(temperature);
      const tempC = (tempF - 32) * 5 / 9;
      const tempK = tempC + 273.15;
      // Speed of sound = sqrt(gamma * R * T) where gamma=1.4 for air, R=287 J/(kg·K)
      // In fps: a = 49.0223 * sqrt(tempR) where tempR is Rankine
      return 49.0223 * Math.sqrt(tempF + 459.67);
    };

    // Calculate trajectory using point mass model
    const calculateTrajectory = () => {
      if (!selectedLoad || !editingBC || !editingMV) {
        return [];
      }

      const bc = parseFloat(editingBC);
      const mv = parseFloat(editingMV);
      const bcType = editingBCType || 'G1';
      const sh = parseFloat(sightHeight); // inches
      const zero = parseFloat(zeroDistance); // yards
      const max = parseInt(maxRange);
      const increment = parseInt(rangeIncrement);
      const wind = parseFloat(windSpeed); // mph
      const windAngleRad = (parseFloat(windAngle) * Math.PI) / 180;
      const crossWind = wind * Math.sin(windAngleRad); // mph crosswind component

      const densityRatio = getAirDensityRatio();
      const speedOfSound = getSpeedOfSound();

      // Adjust BC for non-standard atmosphere
      // Higher density = more drag = effectively lower BC
      const adjustedBC = bc / densityRatio;

      const results = [];
      const dt = 0.0005; // Time step in seconds (smaller = more accurate)
      const g = 32.174; // Gravity ft/s²

      // Convert crosswind to ft/s (mph * 1.46667)
      const crossWindFps = crossWind * 1.46667;

      // Step 1: Find the bore angle that zeros at the specified distance
      // The bullet starts at sight height below line of sight and must hit LOS at zero distance

      // Binary search for zero angle
      let lowAngle = 0;
      let highAngle = 0.1; // radians (~5.7 degrees, more than enough)
      let zeroAngle = 0;

      for (let iteration = 0; iteration < 50; iteration++) {
        zeroAngle = (lowAngle + highAngle) / 2;

        // Simulate to zero distance
        let x = 0; // downrange distance in feet
        let y = -sh / 12; // height relative to LOS (start below by sight height), in feet
        let vx = mv * Math.cos(zeroAngle);
        let vy = mv * Math.sin(zeroAngle);

        const zeroDistFt = zero * 3; // yards to feet

        while (x < zeroDistFt) {
          const v = Math.sqrt(vx * vx + vy * vy);
          const mach = v / speedOfSound;
          const cd = getDragCoefficient(mach, bcType);

          // Retardation = Cd / BC * v² / K
          // K ≈ 4880 for G1/G7 standard (derived from standard projectile and air density)
          // This gives retardation in ft/s²
          const retardation = (cd / adjustedBC) * (v * v) / 4880;

          const ax = -retardation * (vx / v);
          const ay = -g - retardation * (vy / v);

          vx += ax * dt;
          vy += ay * dt;
          x += vx * dt;
          y += vy * dt;
        }

        // Interpolate to exact zero distance
        const overshoot = (x - zeroDistFt) / vx;
        const yAtZero = y - vy * overshoot;

        if (Math.abs(yAtZero) < 0.0001) break; // Close enough

        if (yAtZero < 0) {
          lowAngle = zeroAngle; // Need more angle (shooting too low)
        } else {
          highAngle = zeroAngle; // Need less angle (shooting too high)
        }
      }

      // Step 2: Calculate trajectory at each distance
      // Line of sight is the straight line from scope at angle to hit zero point
      // LOS angle = atan(sight_height / zero_distance)
      const losAngle = Math.atan((sh / 12) / (zero * 3));

      for (let targetDist = 0; targetDist <= max; targetDist += increment) {
        if (targetDist === 0) {
          // At muzzle, bullet is sight height below LOS
          const bulletWeightGr = parseFloat(selectedLoad.bulletWeight?.replace(/[^\d.]/g, '') || 140);
          const energy = (bulletWeightGr / 7000) * mv * mv / (2 * g);

          results.push({
            distance: 0,
            drop: -sh, // inches below line of sight
            dropMOA: 0,
            dropMils: 0,
            windage: 0,
            windageMOA: 0,
            windageMils: 0,
            velocity: Math.round(mv),
            energy: Math.round(energy),
            tof: 0
          });
          continue;
        }

        // Simulate trajectory to target distance
        let x = 0, y = -sh / 12, z = 0; // feet
        let vx = mv * Math.cos(zeroAngle);
        let vy = mv * Math.sin(zeroAngle);
        let vz = 0;
        let tof = 0;

        const targetDistFt = targetDist * 3;

        while (x < targetDistFt) {
          const v = Math.sqrt(vx * vx + vy * vy + vz * vz);
          const mach = v / speedOfSound;
          const cd = getDragCoefficient(mach, bcType);

          // Retardation = Cd / BC * v² / K
          // K ≈ 4880 for G1/G7 standard (derived from standard projectile and air density)
          const retardation = (cd / adjustedBC) * (v * v) / 4880;

          // Wind drift: the bullet is "carried" by wind lag
          // Simplified: wind pushes bullet proportional to time of flight and drag
          const windAccel = crossWindFps * retardation / v;

          const ax = -retardation * (vx / v);
          const ay = -g - retardation * (vy / v);
          const az = windAccel;

          vx += ax * dt;
          vy += ay * dt;
          vz += az * dt;
          x += vx * dt;
          y += vy * dt;
          z += vz * dt;
          tof += dt;
        }

        // Interpolate to exact target distance
        const overshoot = (x - targetDistFt) / vx;
        const yAtTarget = y - vy * overshoot;
        const zAtTarget = z - vz * overshoot;
        const tofAtTarget = tof - overshoot;
        const vAtTarget = Math.sqrt(vx * vx + vy * vy);

        // Calculate where line of sight is at this distance
        // LOS height = (distance / zero_distance) * sight_height - sight_height
        // Simplified: LOS is a straight line from scope through zero point
        const losHeightFt = (targetDistFt / (zero * 3)) * (sh / 12) - (sh / 12);

        // Drop relative to line of sight (in inches)
        const dropRelativeToLOS = (yAtTarget - losHeightFt) * 12;

        // Windage in inches
        const windageInches = zAtTarget * 12;

        // Convert to MOA and Mils (correction values - how much to dial)
        // MOA = (drop_inches / distance_yards) * 95.5 (actually 100/1.047 ≈ 95.49)
        // Positive MOA = dial UP (bullet is low)
        const dropMOA = targetDist > 0 ? (-dropRelativeToLOS * 100) / (targetDist * 1.047) : 0;
        const dropMils = targetDist > 0 ? (-dropRelativeToLOS * 100) / (targetDist * 3.6) : 0;

        // Windage correction (positive = dial right if bullet went left)
        const windageMOA = targetDist > 0 ? (windageInches * 100) / (targetDist * 1.047) : 0;
        const windageMils = targetDist > 0 ? (windageInches * 100) / (targetDist * 3.6) : 0;

        // Energy calculation (ft-lbs)
        const bulletWeightGr = parseFloat(selectedLoad.bulletWeight?.replace(/[^\d.]/g, '') || 140);
        const bulletWeightLbs = bulletWeightGr / 7000;
        const energy = (bulletWeightLbs * vAtTarget * vAtTarget) / (2 * g);

        results.push({
          distance: targetDist,
          drop: dropRelativeToLOS, // inches relative to LOS (negative = below)
          dropMOA: dropMOA, // MOA correction to dial UP
          dropMils: dropMils,
          windage: windageInches, // inches (positive = right)
          windageMOA: windageMOA,
          windageMils: windageMils,
          velocity: Math.round(vAtTarget),
          energy: Math.round(energy),
          tof: tofAtTarget.toFixed(3)
        });
      }

      // Apply truing factor if set
      if (truingFactor !== 1.0) {
        return results.map(r => ({
          ...r,
          drop: r.drop * truingFactor,
          dropMOA: r.dropMOA * truingFactor,
          dropMils: r.dropMils * truingFactor
        }));
      }

      return results;
    };

    // Apply truing
    const applyTruing = () => {
      if (truingData.length === 0 || calculatedTable.length === 0) return;

      // Find the best truing factor based on observed data
      let sumRatios = 0;
      let count = 0;

      truingData.forEach(obs => {
        const predicted = calculatedTable.find(r => r.distance === parseInt(obs.distance));
        if (predicted && predicted.drop !== 0 && obs.observedDrop) {
          const ratio = parseFloat(obs.observedDrop) / predicted.drop;
          sumRatios += ratio;
          count++;
        }
      });

      if (count > 0) {
        setTruingFactor(sumRatios / count);
      }
    };

    useEffect(() => {
      if (selectedLoad && editingBC && editingMV) {
        const table = calculateTrajectory();
        setCalculatedTable(table);
      } else {
        setCalculatedTable([]);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLoadId, selectedLoad, editingBC, editingBCType, editingMV, sightHeight, zeroDistance, temperature, altitude, pressure, humidity, windSpeed, windAngle, maxRange, rangeIncrement, truingFactor]);

    // Generate drop chart image for phone screensaver
    const generateDropChart = () => {
      if (calculatedTable.length === 0 || !hasCompleteData) return;

      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, 400, 800);

      // Header
      ctx.fillStyle = '#9333ea';
      ctx.fillRect(0, 0, 400, 80);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(selectedLoad?.name || 'Drop Chart', 200, 35);
      ctx.font = '14px Arial';
      ctx.fillText(`MV: ${editingMV} fps | BC: ${editingBC} ${editingBCType}`, 200, 55);
      ctx.fillText(`Zero: ${zeroDistance}yds | Wind: ${windSpeed}mph @ ${windAngle}°`, 200, 72);

      // Table header
      ctx.fillStyle = '#4a4a6a';
      ctx.fillRect(0, 80, 400, 35);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('YDS', 15, 102);
      ctx.textAlign = 'center';
      ctx.fillText('DROP', 100, 102);
      ctx.fillText('MOA', 170, 102);
      ctx.fillText('MIL', 230, 102);
      ctx.fillText('WIND', 290, 102);
      ctx.fillText('VEL', 360, 102);

      // Table rows
      ctx.font = '12px Arial';
      let y = 130;
      calculatedTable.forEach((row, i) => {
        if (i % 2 === 0) {
          ctx.fillStyle = '#252540';
          ctx.fillRect(0, y - 15, 400, 25);
        }

        ctx.fillStyle = row.distance === parseInt(zeroDistance) ? '#9333ea' : '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(row.distance.toString(), 15, y);
        ctx.textAlign = 'center';
        ctx.fillText(row.drop.toFixed(1) + '"', 100, y);
        ctx.fillText(row.dropMOA.toFixed(1), 170, y);
        ctx.fillText(row.dropMils.toFixed(2), 230, y);
        ctx.fillStyle = row.windage >= 0 ? '#22c55e' : '#ef4444';
        ctx.fillText((row.windage >= 0 ? 'R ' : 'L ') + Math.abs(row.windage).toFixed(1) + '"', 290, y);
        ctx.fillStyle = row.distance === parseInt(zeroDistance) ? '#9333ea' : '#ffffff';
        ctx.fillText(row.velocity.toString(), 360, y);

        y += 25;
      });

      // Footer
      ctx.fillStyle = '#4a4a6a';
      ctx.fillRect(0, 750, 400, 50);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Generated: ${new Date().toLocaleDateString()} | Temp: ${temperature}°F | Alt: ${altitude}ft`, 200, 770);
      ctx.fillText('PRS Analytics', 200, 785);

      // Download
      const link = document.createElement('a');
      link.download = `drop-chart-${selectedLoad?.name?.replace(/\s+/g, '-') || 'ballistics'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <Crosshair className="mr-3 h-7 w-7 text-purple-600 dark:text-purple-400" />
          Ballistics Calculator
        </h2>

        {equipment.loads.length === 0 ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <div className="flex items-start">
              <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-800 dark:text-yellow-200">No Loads Available</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Add loads in the Equipment tab first, then return here to set up ballistics data.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Panel */}
            <div className="lg:col-span-1 space-y-6">
              {/* Load Selection & Ballistics Data */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Load Selection</h3>
                <select
                  value={selectedLoadId}
                  onChange={(e) => setSelectedLoadId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a load...</option>
                  {equipment.loads.map(load => (
                    <option key={load.id} value={load.id}>
                      {load.name} {load.bc && load.muzzleVelocity ? `(${load.bc} ${load.bcType || 'G1'}, ${load.muzzleVelocity} fps)` : '(needs ballistics data)'}
                    </option>
                  ))}
                </select>

                {selectedLoad && (
                  <div className="mt-4 space-y-4">
                    {/* Load Info */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-gray-500 dark:text-gray-400">Bullet:</span> <span className="text-gray-900 dark:text-white">{selectedLoad.bullet || 'N/A'}</span></div>
                        <div><span className="text-gray-500 dark:text-gray-400">Weight:</span> <span className="text-gray-900 dark:text-white">{selectedLoad.bulletWeight || 'N/A'}</span></div>
                        <div><span className="text-gray-500 dark:text-gray-400">Caliber:</span> <span className="text-gray-900 dark:text-white">{selectedLoad.caliber || 'N/A'}</span></div>
                      </div>
                    </div>

                    {/* Ballistics Data Input */}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                        Ballistics Data
                        {!hasCompleteData && (
                          <span className="ml-2 text-xs font-normal text-yellow-600 dark:text-yellow-400">(required for calculations)</span>
                        )}
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">BC *</label>
                          <input
                            type="text"
                            value={editingBC}
                            onChange={(e) => setEditingBC(e.target.value)}
                            placeholder="e.g., 0.585"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">BC Type</label>
                          <select
                            value={editingBCType}
                            onChange={(e) => setEditingBCType(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                          >
                            <option value="G1">G1</option>
                            <option value="G7">G7</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Muzzle Velocity (fps) *</label>
                          <input
                            type="text"
                            value={editingMV}
                            onChange={(e) => setEditingMV(e.target.value)}
                            placeholder="e.g., 2750"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Velocity SD (fps)</label>
                          <input
                            type="text"
                            value={editingVelocitySD}
                            onChange={(e) => setEditingVelocitySD(e.target.value)}
                            placeholder="e.g., 8"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      </div>
                      {hasModifiedData && (
                        <button
                          onClick={saveBallisticsData}
                          disabled={isSaving}
                          className="mt-3 w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-md text-sm font-medium flex items-center justify-center"
                        >
                          {isSaving ? 'Saving...' : <><Save className="h-4 w-4 mr-1" /> Save Ballistics Data</>}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!selectedLoad && (
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Select a load to view and enter ballistics data
                  </p>
                )}
              </div>

              {/* Rifle Settings */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rifle Settings</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Sight Height (inches)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={sightHeight}
                      onChange={(e) => setSightHeight(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Zero Distance (yards)</label>
                    <input
                      type="number"
                      value={zeroDistance}
                      onChange={(e) => setZeroDistance(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Turret Settings (for Sight Tape) */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Turret Settings</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Turret Diameter (in)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={turretDiameter}
                      onChange={(e) => setTurretDiameter(e.target.value)}
                      placeholder="e.g., 1.5"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Click Value (MOA)</label>
                    <select
                      value={clickValue}
                      onChange={(e) => setClickValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    >
                      <option value="0.125">1/8 MOA</option>
                      <option value="0.25">1/4 MOA</option>
                      <option value="0.5">1/2 MOA</option>
                      <option value="0.1">0.1 Mil</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Revolutions</label>
                    <select
                      value={turretRevolutions}
                      onChange={(e) => setTurretRevolutions(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    >
                      <option value="10">10 MOA/rev</option>
                      <option value="12">12 MOA/rev</option>
                      <option value="15">15 MOA/rev</option>
                      <option value="20">20 MOA/rev</option>
                      <option value="25">25 MOA/rev</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Measure turret cap diameter and check MOA per revolution for accurate sight tape
                </p>
              </div>

              {/* Atmospheric Conditions */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Atmosphere</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Temp (°F)</label>
                    <input
                      type="number"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Altitude (ft)</label>
                    <input
                      type="number"
                      value={altitude}
                      onChange={(e) => setAltitude(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Pressure (inHg)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={pressure}
                      onChange={(e) => setPressure(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Humidity (%)</label>
                    <input
                      type="number"
                      value={humidity}
                      onChange={(e) => setHumidity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Wind */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Wind</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Speed (mph)</label>
                    <input
                      type="number"
                      value={windSpeed}
                      onChange={(e) => setWindSpeed(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Angle (°)</label>
                    <input
                      type="number"
                      value={windAngle}
                      onChange={(e) => setWindAngle(e.target.value)}
                      placeholder="90 = full crosswind"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  0° = head wind, 90° = full crosswind, 180° = tail wind
                </p>
              </div>

              {/* Range Settings */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Range Settings</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Max Range (yds)</label>
                    <input
                      type="number"
                      value={maxRange}
                      onChange={(e) => setMaxRange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Increment (yds)</label>
                    <select
                      value={rangeIncrement}
                      onChange={(e) => setRangeIncrement(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    >
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Truing */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Truing Data</h3>
                  <button
                    onClick={() => setShowTruingModal(true)}
                    className="flex items-center text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </button>
                </div>

                {truingData.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Add real-world observations to true your ballistic solution.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {truingData.map((data, i) => (
                      <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded">
                        <span className="text-gray-900 dark:text-white">{data.distance} yds: {data.observedDrop}" drop</span>
                        <button
                          onClick={() => setTruingData(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={applyTruing}
                      className="w-full mt-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm"
                    >
                      Apply Truing (Factor: {truingFactor.toFixed(3)})
                    </button>
                    {truingFactor !== 1.0 && (
                      <button
                        onClick={() => setTruingFactor(1.0)}
                        className="w-full px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm"
                      >
                        Reset Truing
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Results Panel */}
            <div className={`lg:col-span-2 space-y-6 ${!hasCompleteData ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* Missing Data Notice */}
              {!hasCompleteData && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {!selectedLoad
                        ? 'Select a load to see trajectory calculations'
                        : 'Enter BC and Muzzle Velocity data to enable calculations'}
                    </p>
                  </div>
                </div>
              )}

              {/* Drop Table */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Drop Table</h3>
                  {calculatedTable.length > 0 && hasCompleteData && (
                    <button
                      onClick={generateDropChart}
                      className="flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm"
                    >
                      <Download className="h-4 w-4 mr-1" /> Phone Chart
                    </button>
                  )}
                </div>

                {!hasCompleteData ? (
                  /* Preview table with sample data when incomplete */
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-gray-200 dark:border-gray-600">
                          <th className="py-2 px-2 text-gray-400 dark:text-gray-500">Dist</th>
                          <th className="py-2 px-2 text-gray-400 dark:text-gray-500">Drop</th>
                          <th className="py-2 px-2 text-gray-400 dark:text-gray-500">MOA</th>
                          <th className="py-2 px-2 text-gray-400 dark:text-gray-500">Mils</th>
                          <th className="py-2 px-2 text-gray-400 dark:text-gray-500">Wind</th>
                          <th className="py-2 px-2 text-gray-400 dark:text-gray-500">W-MOA</th>
                          <th className="py-2 px-2 text-gray-400 dark:text-gray-500">Vel</th>
                          <th className="py-2 px-2 text-gray-400 dark:text-gray-500">Energy</th>
                          <th className="py-2 px-2 text-gray-400 dark:text-gray-500">TOF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((dist, i) => (
                          <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2 px-2 text-gray-400 dark:text-gray-500">{dist}</td>
                            <td className="py-2 px-2 text-gray-400 dark:text-gray-500">--</td>
                            <td className="py-2 px-2 text-gray-400 dark:text-gray-500">--</td>
                            <td className="py-2 px-2 text-gray-400 dark:text-gray-500">--</td>
                            <td className="py-2 px-2 text-gray-400 dark:text-gray-500">--</td>
                            <td className="py-2 px-2 text-gray-400 dark:text-gray-500">--</td>
                            <td className="py-2 px-2 text-gray-400 dark:text-gray-500">--</td>
                            <td className="py-2 px-2 text-gray-400 dark:text-gray-500">--</td>
                            <td className="py-2 px-2 text-gray-400 dark:text-gray-500">--</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : calculatedTable.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    Calculating...
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-gray-200 dark:border-gray-600">
                          <th className="py-2 px-2 text-gray-600 dark:text-gray-300">Dist</th>
                          <th className="py-2 px-2 text-gray-600 dark:text-gray-300">Drop</th>
                          <th className="py-2 px-2 text-gray-600 dark:text-gray-300">MOA</th>
                          <th className="py-2 px-2 text-gray-600 dark:text-gray-300">Mils</th>
                          <th className="py-2 px-2 text-gray-600 dark:text-gray-300">Wind</th>
                          <th className="py-2 px-2 text-gray-600 dark:text-gray-300">W-MOA</th>
                          <th className="py-2 px-2 text-gray-600 dark:text-gray-300">Vel</th>
                          <th className="py-2 px-2 text-gray-600 dark:text-gray-300">Energy</th>
                          <th className="py-2 px-2 text-gray-600 dark:text-gray-300">TOF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculatedTable.map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b border-gray-100 dark:border-gray-700 ${
                              row.distance === parseInt(zeroDistance) ? 'bg-purple-50 dark:bg-purple-900/30' : ''
                            }`}
                          >
                            <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{row.distance}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{row.drop.toFixed(1)}"</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{row.dropMOA.toFixed(1)}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{row.dropMils.toFixed(2)}</td>
                            <td className={`py-2 px-2 ${row.windage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {row.windage >= 0 ? 'R ' : 'L '}{Math.abs(row.windage).toFixed(1)}"
                            </td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{row.windageMOA.toFixed(1)}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{row.velocity}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{row.energy}</td>
                            <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{row.tof}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Sight Tape Visualization */}
              {calculatedTable.length > 0 && hasCompleteData && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sight Tape</h3>
                    <button
                      onClick={() => {
                        // Generate downloadable sight tape
                        const diameter = parseFloat(turretDiameter);
                        const circumference = Math.PI * diameter; // inches
                        const pixelsPerInch = 96; // standard screen DPI
                        const tapeWidth = Math.round(circumference * pixelsPerInch);
                        const tapeHeight = 60;

                        const canvas = document.createElement('canvas');
                        canvas.width = tapeWidth;
                        canvas.height = tapeHeight;
                        const ctx = canvas.getContext('2d');

                        // Background
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, tapeWidth, tapeHeight);

                        // Find max MOA for scaling
                        const maxMOA = Math.max(...calculatedTable.map(r => Math.abs(r.dropMOA)));
                        const moaPerRevolution = 360 * parseFloat(clickValue) / (parseFloat(clickValue) < 1 ? 80 : 20); // typical turrets

                        // Draw distance marks
                        ctx.fillStyle = '#1a1a2e';
                        ctx.font = 'bold 10px Arial';
                        ctx.textAlign = 'center';

                        calculatedTable.filter(r => r.distance > 0).forEach(row => {
                          // Position based on MOA from zero
                          const moaFromZero = Math.abs(row.dropMOA);
                          const xPos = (moaFromZero / maxMOA) * (tapeWidth - 40) + 20;

                          // Tick mark
                          ctx.strokeStyle = row.distance % 100 === 0 ? '#9333ea' : '#666666';
                          ctx.lineWidth = row.distance % 100 === 0 ? 2 : 1;
                          ctx.beginPath();
                          ctx.moveTo(xPos, 0);
                          ctx.lineTo(xPos, row.distance % 100 === 0 ? 25 : 15);
                          ctx.stroke();

                          // Label (only every 100 yards)
                          if (row.distance % 100 === 0) {
                            ctx.fillStyle = '#1a1a2e';
                            ctx.fillText(row.distance.toString(), xPos, 40);
                          }
                        });

                        // Zero mark
                        ctx.strokeStyle = '#22c55e';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(20, 0);
                        ctx.lineTo(20, 30);
                        ctx.stroke();
                        ctx.fillStyle = '#22c55e';
                        ctx.fillText('0', 20, 45);

                        // Info text
                        ctx.fillStyle = '#666666';
                        ctx.font = '8px Arial';
                        ctx.textAlign = 'left';
                        ctx.fillText(`Ø${diameter}" turret | ${clickValue} MOA/click | Zero: ${zeroDistance}yds`, 5, 55);

                        // Download
                        const link = document.createElement('a');
                        link.download = `sight-tape-${selectedLoad?.name?.replace(/\s+/g, '-') || 'ballistics'}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                      }}
                      className="flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm"
                    >
                      <Download className="h-4 w-4 mr-1" /> Download Tape
                    </button>
                  </div>

                  {/* Tape Preview */}
                  <div className="overflow-x-auto">
                    <div
                      className="relative bg-white border border-gray-300 rounded"
                      style={{
                        width: `${Math.PI * parseFloat(turretDiameter) * 96}px`,
                        height: '50px',
                        minWidth: '300px',
                        maxWidth: '100%'
                      }}
                    >
                      {/* Zero mark */}
                      <div className="absolute left-5 top-0 h-8 w-0.5 bg-green-500" />
                      <span className="absolute left-4 top-9 text-xs text-green-600 font-bold">0</span>

                      {/* Distance marks */}
                      {calculatedTable.filter(r => r.distance > 0).map((row, i) => {
                        const maxMOA = Math.max(...calculatedTable.map(r => Math.abs(r.dropMOA)));
                        const position = (Math.abs(row.dropMOA) / maxMOA) * 90 + 5; // percentage

                        return (
                          <div key={i} className="absolute" style={{ left: `${position}%` }}>
                            <div className={`w-0.5 ${row.distance % 100 === 0 ? 'h-6 bg-purple-600' : 'h-3 bg-gray-400'}`} />
                            {row.distance % 100 === 0 && (
                              <span className="absolute -left-2 top-7 text-xs text-gray-700 font-medium">
                                {row.distance}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <p>Turret circumference: {(Math.PI * parseFloat(turretDiameter)).toFixed(2)}" | Print at 100% scale, cut and wrap around turret</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Truing Modal */}
        {showTruingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add Truing Observation</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter the actual observed drop at a known distance to calibrate the ballistic solution.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Distance (yards)</label>
                  <input
                    type="number"
                    value={newTruing.distance}
                    onChange={(e) => setNewTruing({ ...newTruing, distance: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., 600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Observed Drop (inches)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newTruing.observedDrop}
                    onChange={(e) => setNewTruing({ ...newTruing, observedDrop: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., -85.5 (negative = below zero)"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setShowTruingModal(false);
                    setNewTruing({ distance: '', observedDrop: '', observedWindage: '' });
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (newTruing.distance && newTruing.observedDrop) {
                      setTruingData(prev => [...prev, newTruing]);
                      setNewTruing({ distance: '', observedDrop: '', observedWindage: '' });
                      setShowTruingModal(false);
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  Add Observation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Chrono Import Modal
  const ChronoImportModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Import Chronograph Data</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Paste velocity readings (fps)
            </label>
            <textarea
              value={chronoString}
              onChange={(e) => setChronoString(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md h-32 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              placeholder="Enter velocities separated by commas, spaces, or new lines&#10;Example:&#10;2850, 2847, 2852, 2849, 2851"
            />
          </div>

          <div className="text-center text-gray-500 dark:text-gray-400 text-sm">OR</div>

          <div>
            <input
              ref={chronoFileRef}
              type="file"
              accept=".txt,.csv"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    setChronoString(e.target.result);
                  };
                  reader.readAsText(file);
                }
              }}
              className="hidden"
            />
            <button
              onClick={() => chronoFileRef.current?.click()}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
            >
              <File className="inline h-4 w-4 mr-2" />
              Import from File
            </button>
          </div>

          {chronoString && (() => {
            const parsed = parseChronoData(chronoString);
            return parsed ? (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                <p className="font-medium mb-2 text-gray-900 dark:text-white">Preview:</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-900 dark:text-white">
                  <p>Shots: {parsed.count}</p>
                  <p>Average: {parsed.average.toFixed(0)} fps</p>
                  <p>ES: {parsed.es.toFixed(0)} fps</p>
                  <p>SD: {parsed.sd.toFixed(1)} fps</p>
                </div>
              </div>
            ) : null;
          })()}
        </div>

        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={() => {
              setShowChronoImport(false);
              setChronoString('');
            }}
            className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const parsed = parseChronoData(chronoString);
              if (parsed) {
                setSessionData(prev => ({ ...prev, chronoData: parsed }));
                setShowChronoImport(false);
                setChronoString('');
              } else {
                alert('Invalid chrono data format');
              }
            }}
            className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );

  // Note: Sample data removed - users now create their own equipment in Firestore

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors flex items-center justify-center">
        <div className="text-center">
          <Target className="h-16 w-16 text-purple-600 dark:text-purple-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  // Show loading state while fetching user data
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
        <Navigation />
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <div className="text-center">
            <Target className="h-16 w-16 text-purple-600 dark:text-purple-400 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600 dark:text-gray-300">Loading your data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show auth screen if not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
        <Navigation />
        <Auth user={user} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Navigation />

      <main className={`max-w-7xl mx-auto ${isMobile ? 'px-2 py-4' : 'px-4 py-8'}`}>
        {/* Home Tab */}
        {activeTab === 'home' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg p-8 text-white">
              <h2 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold mb-4`}>Precision Rifle Shooting Analytics</h2>
              <p className={`${isMobile ? 'text-lg' : 'text-xl'} mb-6 text-purple-100`}>
                Upload target photos and track your shooting performance with precise measurements.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setActiveTab('capture')}
                  className="bg-white text-purple-600 px-6 py-3 rounded-lg font-medium hover:bg-purple-50 transition-colors"
                >
                  Start New Session
                </button>
                <div className="flex items-center text-purple-100 text-sm">
                  <Smartphone className="h-4 w-4 mr-2" />
                  <span>iOS App Ready</span>
                </div>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${isMobile ? 'gap-4' : 'md:grid-cols-3 gap-6'}`}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors">
                <div className="flex items-center mb-4">
                  <Target className="h-8 w-8 text-purple-600 dark:text-purple-400 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Total Sessions</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{sessions.length}</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors">
                <div className="flex items-center mb-4">
                  <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Best Group</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {sessions.length > 0
                    ? Math.min(...sessions.flatMap(s => s.targets.map(t => t.stats?.sizeInches || Infinity))).toFixed(2) + '"'
                    : 'N/A'}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors">
                <div className="flex items-center mb-4">
                  <Award className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rifles Tracked</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{equipment.rifles.length}</p>
              </div>
            </div>

            {sessions.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recent Sessions</h3>
                <div className="space-y-3">
                  {sessions.slice(-3).reverse().map(session => (
                    <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{session.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{session.date} • {session.rifle}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-300">{session.targets.length} targets</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Best: {Math.min(...session.targets.map(t => t.stats?.sizeInches || Infinity)).toFixed(2)}"
                        </p>
                        {session.chronoData && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {session.chronoData.average.toFixed(0)} fps
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Capture Tab */}
        {activeTab === 'capture' && (
          <div className="space-y-6">
            {/* Progress indicator */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <div className={`flex items-center ${isMobile ? 'justify-center overflow-x-auto' : 'justify-between'}`}>
                {['upload', 'setup', 'select-targets', 'adjust-targets', 'mark-shots', 'review'].map((step, index) => (
                  <div key={step} className="flex items-center">
                    <div className={`flex items-center justify-center ${isMobile ? 'w-7 h-7' : 'w-8 h-8'} rounded-full ${
                      captureStep === step
                        ? 'bg-purple-600 text-white'
                        : index < ['upload', 'setup', 'select-targets', 'adjust-targets', 'mark-shots', 'review'].indexOf(captureStep)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}>
                      {index < ['upload', 'setup', 'select-targets', 'adjust-targets', 'mark-shots', 'review'].indexOf(captureStep)
                        ? <CheckCircle className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                        : index + 1
                      }
                    </div>
                    {index < 4 && (
                      <ChevronRight className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-gray-400 dark:text-gray-500 mx-2`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {captureStep === 'upload' && (
              <div className="max-w-2xl mx-auto">
                <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-white mb-6 text-center`}>Upload Target Photo</h2>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
                  <Upload className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-gray-600 dark:text-gray-300 mb-6">Upload a photo of your targets</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Choose Image
                  </button>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                    For best results, use a clear photo with orange target stickers visible
                  </p>
                </div>
              </div>
            )}

            {captureStep === 'setup' && uploadedImage && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Session Setup</h3>
                  <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-4`}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Session Name <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={sessionData.name}
                        onChange={(e) => setSessionData({...sessionData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="Auto: Date + Rifle if left blank"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Target Diameter (inches)*</label>
                      <input
                        type="number"
                        step="0.1"
                        value={targetDiameter}
                        onChange={(e) => setTargetDiameter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="e.g., 1.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Rifle*</label>
                      <select
                        value={sessionData.rifle}
                        onChange={(e) => setSessionData({...sessionData, rifle: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Select rifle</option>
                        {equipment.rifles.map(rifle => (
                          <option key={rifle.name} value={rifle.name}>{rifle.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Load*</label>
                      <select
                        value={sessionData.load}
                        onChange={(e) => setSessionData({...sessionData, load: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Select load</option>
                        {equipment.loads.map(load => (
                          <option key={load.name} value={load.name}>{load.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="silencer-toggle"
                        type="checkbox"
                        checked={sessionData.silencer}
                        onChange={(e) => setSessionData({...sessionData, silencer: e.target.checked})}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <label htmlFor="silencer-toggle" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Silencer/Suppressor Used
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Distance (yards)</label>
                      <input
                        type="number"
                        value={sessionData.distance}
                        onChange={(e) => setSessionData({...sessionData, distance: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Date</label>
                      <input
                        type="date"
                        value={sessionData.date}
                        onChange={(e) => setSessionData({...sessionData, date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900 rounded-lg border dark:border-purple-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-purple-900 dark:text-purple-200">Chronograph Data</h4>
                        {sessionData.chronoData ? (
                          <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                            {sessionData.chronoData.count} shots • Avg: {sessionData.chronoData.average.toFixed(0)} fps • ES: {sessionData.chronoData.es.toFixed(0)} fps
                          </p>
                        ) : (
                          <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">No chrono data imported</p>
                        )}
                      </div>
                      <button
                        onClick={() => setShowChronoImport(true)}
                        className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm font-medium flex items-center"
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        {sessionData.chronoData ? 'Update' : 'Import'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Environmental Conditions</h4>
                    <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4`}>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                          <Thermometer className="inline h-3 w-3 mr-1" />
                          Temperature (°F)
                        </label>
                        <input
                          type="number"
                          value={sessionData.temperature}
                          onChange={(e) => setSessionData({...sessionData, temperature: parseInt(e.target.value) || 0})}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                          <Droplets className="inline h-3 w-3 mr-1" />
                          Humidity (%)
                        </label>
                        <input
                          type="number"
                          value={sessionData.humidity}
                          onChange={(e) => setSessionData({...sessionData, humidity: parseInt(e.target.value) || 0})}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                          <Wind className="inline h-3 w-3 mr-1" />
                          Wind Speed (mph)
                        </label>
                        <input
                          type="number"
                          value={sessionData.windSpeed}
                          onChange={(e) => setSessionData({...sessionData, windSpeed: parseInt(e.target.value) || 0})}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Wind Direction</label>
                        <select
                          value={sessionData.windDirection}
                          onChange={(e) => setSessionData({...sessionData, windDirection: e.target.value})}
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                        >
                          <option value="12">12 o'clock</option>
                          <option value="1">1 o'clock</option>
                          <option value="2">2 o'clock</option>
                          <option value="3">3 o'clock</option>
                          <option value="4">4 o'clock</option>
                          <option value="5">5 o'clock</option>
                          <option value="6">6 o'clock</option>
                          <option value="7">7 o'clock</option>
                          <option value="8">8 o'clock</option>
                          <option value="9">9 o'clock</option>
                          <option value="10">10 o'clock</option>
                          <option value="11">11 o'clock</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end space-x-4">
                    <button
                      onClick={() => setCaptureStep('upload')}
                      className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        if (!targetDiameter || !sessionData.rifle || !sessionData.load) {
                          alert('Please fill in all required fields (Target Diameter, Rifle, and Load)');
                          return;
                        }
                        // Check for duplicate name if one was provided
                        if (sessionData.name && sessions.some(s => s.name.toLowerCase() === sessionData.name.toLowerCase())) {
                          alert(`A session named "${sessionData.name}" already exists. Please choose a different name or leave it blank for auto-naming.`);
                          return;
                        }
                        setCaptureStep('select-targets');
                      }}
                      className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Continue to Target Selection
                    </button>
                  </div>
                </div>
              </div>
            )}

            {captureStep === 'select-targets' && uploadedImage && (
              <div className="space-y-6">
                {/* Simple Instructions */}
                <div className="bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                  <h3 className="font-medium text-purple-900 dark:text-purple-200 mb-2">📍 Mark Target Locations</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-300">
                    Click on each target to mark its location. They'll be numbered 1, 2, 3, etc.
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                    💡 Don't worry about perfect sizing - you'll adjust that on the next screen with drag handles!
                  </p>
                </div>

                <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                  <img
                    src={uploadedImage}
                    alt="Targets"
                    className="w-full h-auto cursor-crosshair"
                    onClick={handleTargetClick}
                  />

                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {selectedTargets.map((target, index) => {
                      const scaleX = 100 / target.imageWidth;
                      const scaleY = 100 / target.imageHeight;

                      return (
                        <g key={target.id}>
                          {/* Simple numbered marker */}
                          <circle
                            cx={`${target.x * scaleX}%`}
                            cy={`${target.y * scaleY}%`}
                            r="2"
                            fill="#3b82f6"
                            opacity="0.7"
                          />
                          {/* Number label */}
                          <text
                            x={`${target.x * scaleX}%`}
                            y={`${(target.y - 30) * scaleY}%`}
                            fill="#3b82f6"
                            fontSize={isMobile ? "3" : "4"}
                            textAnchor="middle"
                            fontWeight="bold"
                            stroke="white"
                            strokeWidth="0.5"
                          >
                            {index + 1}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-sm text-green-900 dark:text-green-200">
                      ✅ {selectedTargets.length} target{selectedTargets.length !== 1 ? 's' : ''} marked
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Next step: Adjust size and position with visual drag handles
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {selectedTargets.length} target{selectedTargets.length !== 1 ? 's' : ''} selected
                  </div>
                  <div className={`${isMobile ? 'flex flex-col gap-2' : 'space-x-4'}`}>
                    <button
                      onClick={() => setCaptureStep('setup')}
                      className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        if (selectedTargets.length > 0) {
                          setSelectedTargets(prev => prev.slice(0, -1));
                        }
                      }}
                      disabled={selectedTargets.length === 0}
                      className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:dark:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Undo Last
                    </button>
                    <button
                      onClick={() => {
                        setCurrentEditingTarget(selectedTargets[0]);
                        setCaptureStep('adjust-targets');
                      }}
                      disabled={selectedTargets.length === 0}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:dark:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      Continue to Adjust Targets
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Adjust Targets Step - Click to center, slider to resize */}
            {captureStep === 'adjust-targets' && selectedTargets.length > 0 && (
              <div className="space-y-6">
                <div className="bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                  <h3 className="font-medium text-purple-900 dark:text-purple-200 mb-2">📐 Adjust Target Size & Position</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-300">
                    {isMobile
                      ? <><strong>Click:</strong> center target • <strong>Two-finger pinch:</strong> resize • <strong>Use slider:</strong> fine-tune size</>
                      : <><strong>Click:</strong> center target on click point • <strong>Use slider:</strong> adjust size</>
                    }
                  </p>
                </div>

                <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-2'} gap-6`}>
                  {selectedTargets.map((target, index) => {
                    const currentX = target.adjustedX ?? target.x;
                    const currentY = target.adjustedY ?? target.y;
                    const currentRadius = target.adjustedRadius || target.radius;

                    // Use fixed crop region based on initial radius (stable viewBox)
                    const initialRadius = target.radius;
                    const cropSize = initialRadius * 10; // Fixed size
                    const cropX = currentX - cropSize / 2; // Center on target
                    const cropY = currentY - cropSize / 2;

                    return (
                      <div key={target.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-medium text-lg text-gray-900 dark:text-white">Target {index + 1}</h4>
                          <div className="flex items-center space-x-2">
                            {(target.adjustedX !== null || target.adjustedY !== null || target.adjustedRadius !== null) && (
                              <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900 px-2 py-1 rounded">Adjusted</span>
                            )}
                            <button
                              onClick={() => {
                                setSelectedTargets(prev => prev.map(t =>
                                  t.id === target.id
                                    ? {
                                        ...t,
                                        adjustedX: null,
                                        adjustedY: null,
                                        adjustedRadius: null,
                                        pixelsPerInch: (target.radius * 2) / target.diameterInches
                                      }
                                    : t
                                ));
                              }}
                              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors text-gray-900 dark:text-white"
                            >
                              Reset
                            </button>
                          </div>
                        </div>

                        <div
                          className="relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden mb-4 cursor-crosshair"
                          style={{ paddingBottom: '100%', touchAction: 'none' }}
                          onClick={(e) => {
                            // Click to center target on click point
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const clickY = e.clientY - rect.top;
                            const relativeX = clickX / rect.width;
                            const relativeY = clickY / rect.height;
                            const imageX = cropX + (relativeX * cropSize);
                            const imageY = cropY + (relativeY * cropSize);

                            setSelectedTargets(prev => prev.map(t =>
                              t.id === target.id
                                ? { ...t, adjustedX: imageX, adjustedY: imageY }
                                : t
                            ));
                          }}
                          onTouchStart={(e) => {
                            if (e.touches.length === 2) {
                              e.preventDefault();
                              const touch1 = e.touches[0];
                              const touch2 = e.touches[1];
                              const distance = Math.sqrt(
                                Math.pow(touch2.clientX - touch1.clientX, 2) +
                                Math.pow(touch2.clientY - touch1.clientY, 2)
                              );
                              setIsPinching(true);
                              setDragTargetId(target.id);
                              setInitialPinchDistance(distance);
                              setInitialPinchRadius(currentRadius);
                            }
                          }}
                          onTouchMove={(e) => {
                            if (isPinching && e.touches.length === 2 && dragTargetId === target.id) {
                              e.preventDefault();
                              const touch1 = e.touches[0];
                              const touch2 = e.touches[1];
                              const distance = Math.sqrt(
                                Math.pow(touch2.clientX - touch1.clientX, 2) +
                                Math.pow(touch2.clientY - touch1.clientY, 2)
                              );
                              const scale = distance / initialPinchDistance;
                              const newRadius = Math.max(10, initialPinchRadius * scale);
                              const newPixelsPerInch = (newRadius * 2) / target.diameterInches;

                              setSelectedTargets(prev => prev.map(t =>
                                t.id === target.id
                                  ? { ...t, adjustedRadius: newRadius, pixelsPerInch: newPixelsPerInch }
                                  : t
                              ));
                            }
                          }}
                          onTouchEnd={() => {
                            setIsPinching(false);
                            setDragTargetId(null);
                          }}
                        >
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox={`0 0 ${cropSize} ${cropSize}`}
                            preserveAspectRatio="xMidYMid meet"
                          >
                            <image
                              href={uploadedImage}
                              x={-cropX}
                              y={-cropY}
                              width={target.imageWidth}
                              height={target.imageHeight}
                              preserveAspectRatio="none"
                            />

                            {/* Target circle */}
                            <circle
                              cx={currentX - cropX}
                              cy={currentY - cropY}
                              r={currentRadius}
                              fill="none"
                              stroke="lime"
                              strokeWidth="3"
                              opacity="0.8"
                            />

                            {/* Center crosshair */}
                            <line
                              x1={currentX - cropX - 15}
                              y1={currentY - cropY}
                              x2={currentX - cropX + 15}
                              y2={currentY - cropY}
                              stroke="lime"
                              strokeWidth="2"
                            />
                            <line
                              x1={currentX - cropX}
                              y1={currentY - cropY - 15}
                              x2={currentX - cropX}
                              y2={currentY - cropY + 15}
                              stroke="lime"
                              strokeWidth="2"
                            />
                          </svg>

                          {/* Vertical size slider - overlay on left side of image */}
                          <div
                            className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-auto"
                            style={{ zIndex: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <div className="bg-gray-100/90 dark:bg-gray-700/90 rounded-lg px-2 py-1 text-xs font-medium text-gray-900 dark:text-white shadow-lg">
                              {target.diameterInches}"
                            </div>
                            <input
                              type="range"
                              orient="vertical"
                              min={Math.max(10, target.radius * 0.3)}
                              max={target.radius * 5}
                              value={currentRadius}
                              onChange={(e) => {
                                const newRadius = parseFloat(e.target.value);
                                const newPixelsPerInch = (newRadius * 2) / target.diameterInches;
                                setSelectedTargets(prev => prev.map(t =>
                                  t.id === target.id
                                    ? { ...t, adjustedRadius: newRadius, pixelsPerInch: newPixelsPerInch }
                                    : t
                                ));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="h-48 appearance-none bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer accent-lime-500"
                              style={{
                                writingMode: 'bt-lr',
                                WebkitAppearance: 'slider-vertical',
                                width: '8px'
                              }}
                            />
                            <div className="bg-gray-100/90 dark:bg-gray-700/90 rounded-lg px-2 py-1 text-xs font-medium text-gray-900 dark:text-white shadow-lg">
                              {((currentRadius * 2) / target.diameterInches).toFixed(1)} px/in
                            </div>
                          </div>
                        </div>

                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <div>Position: ({currentX.toFixed(0)}, {currentY.toFixed(0)})</div>
                          <div>Radius: {currentRadius.toFixed(1)}px</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setCaptureStep('select-targets')}
                    className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      setCurrentEditingTarget(selectedTargets[0]);
                      setCaptureStep('mark-shots');
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    Continue to Mark Shots
                  </button>
                </div>
              </div>
            )}

            {/* Mark Shots Step - Simplified to only mark bullet holes */}
            {captureStep === 'mark-shots' && selectedTargets.length > 0 && (
              <div className="space-y-6">
                <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-900 dark:text-yellow-200 mb-2">🎯 Mark Shot Holes</h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>Click on each bullet hole</strong> to mark it • <strong>Drag markers</strong> to adjust position • <strong>Use Auto-Detect</strong> for automatic detection
                  </p>
                </div>

                <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-2'} gap-6`}>
                  {selectedTargets.map((target, index) => {
                    const currentX = target.adjustedX ?? target.x;
                    const currentY = target.adjustedY ?? target.y;
                    const currentRadius = target.adjustedRadius || target.radius;
                    const cropSize = currentRadius * 10; // Changed from 6x to 10x
                    const cropX = currentX - currentRadius * 5; // Changed from 3x to 5x for centering
                    const cropY = currentY - currentRadius * 5;

                    return (
                      <div key={target.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-medium text-lg text-gray-900 dark:text-white">Target {index + 1}</h4>
                          <div className="flex items-center space-x-2">
                            {(target.adjustedX !== null || target.adjustedY !== null || target.adjustedRadius !== null) && (
                              <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900 px-2 py-1 rounded">Adjusted</span>
                            )}
            <button
                              onClick={async () => {
                                if (!window.cv) {
                                  alert('OpenCV is still loading. Please wait a moment and try again.');
                                  return;
                                }
                                try {
                                  const detectedShots = await detectBulletHoles(target, uploadedImage);
                                  if (detectedShots.length === 0) {
                                    alert('No bullet holes detected. Try adjusting the target circle or mark shots manually.');
                                  } else {
                                    setSelectedTargets(prev => prev.map(t =>
                                      t.id === target.id
                                        ? { ...t, shots: [...t.shots, ...detectedShots] }
                                        : t
                                    ));
                                    alert(`Detected ${detectedShots.length} bullet hole(s)!`);
                                  }
                                } catch (error) {
                                  console.error('Detection error:', error);
                                  alert(`Error detecting bullet holes: ${error.message}`);
                                }
                              }}
                              className="px-3 py-1 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
                              title="Automatically detect bullet holes using computer vision"
                            >
                              Auto-Detect
                            </button>
                            {target.shots && target.shots.length > 0 && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Clear all ${target.shots.length} shot(s) from this target?`)) {
                                    setSelectedTargets(prev => prev.map(t =>
                                      t.id === target.id
                                        ? { ...t, shots: [] }
                                        : t
                                    ));
                                  }
                                }}
                                className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                                title="Clear all shots from this target"
                              >
                                Clear Shots
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedTargets(prev => prev.map(t =>
                                  t.id === target.id
                                    ? {
                                        ...t,
                                        adjustedX: null,
                                        adjustedY: null,
                                        adjustedRadius: null,
                                        pixelsPerInch: (target.radius * 2) / target.diameterInches
                                      }
                                    : t
                                ));
                              }}
                              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors text-gray-900 dark:text-white"
                            >
                              Reset
                            </button>
                          </div>
                        </div>

                        <div
                          className="relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden mb-4"
                          style={{ paddingBottom: '100%', touchAction: 'none' }}
                          onMouseDown={(e) => {
                            setJustFinishedDragging(false);

                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const clickY = e.clientY - rect.top;
                            const relativeX = clickX / rect.width;
                            const relativeY = clickY / rect.height;
                            const imageX = cropX + (relativeX * cropSize);
                            const imageY = cropY + (relativeY * cropSize);

                            // Check if clicking on existing shot marker to drag it
                            const clickedShot = target.shots?.find(shot => {
                              const distFromShot = Math.sqrt(
                                Math.pow(imageX - shot.x, 2) + Math.pow(imageY - shot.y, 2)
                              );
                              return distFromShot <= 15; // 15px hit area for shot markers
                            });

                            if (clickedShot) {
                              setDraggingShotId(clickedShot.id);
                              e.preventDefault();
                              e.stopPropagation();
                              return;
                            }

                            // Otherwise, clicking marks a new shot (handled by onClick)
                          }}
                          onMouseMove={(e) => {
                            if (!draggingShotId) return;

                            // Check if mouse is over trash bin
                            const trashEl = document.getElementById(`trash-${target.id}`);
                            if (trashEl) {
                              const trashRect = trashEl.getBoundingClientRect();
                              const mouseX = e.clientX;
                              const mouseY = e.clientY;
                              const overTrash = mouseX >= trashRect.left && mouseX <= trashRect.right &&
                                               mouseY >= trashRect.top && mouseY <= trashRect.bottom;
                              setIsOverTrash(overTrash);
                              setDragTargetId(target.id);
                            }

                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const clickY = e.clientY - rect.top;
                            const relativeX = clickX / rect.width;
                            const relativeY = clickY / rect.height;
                            const imageX = cropX + (relativeX * cropSize);
                            const imageY = cropY + (relativeY * cropSize);

                            if (dragUpdateRef.current) {
                              cancelAnimationFrame(dragUpdateRef.current);
                            }

                            dragUpdateRef.current = requestAnimationFrame(() => {
                              setSelectedTargets(prev => prev.map(t =>
                                t.id === target.id
                                  ? {
                                      ...t,
                                      shots: t.shots.map(s =>
                                        s.id === draggingShotId
                                          ? { ...s, x: imageX, y: imageY }
                                          : s
                                      )
                                    }
                                  : t
                              ));
                            });
                          }}
                          onMouseUp={() => {
                            if (dragUpdateRef.current) {
                              cancelAnimationFrame(dragUpdateRef.current);
                              dragUpdateRef.current = null;
                            }

                            if (draggingShotId) {
                              // Check if dropped on trash - delete and renumber
                              if (isOverTrash) {
                                setSelectedTargets(prev => prev.map(t =>
                                  t.id === target.id
                                    ? { ...t, shots: t.shots.filter(s => s.id !== draggingShotId) }
                                    : t
                                ));
                              } else {
                                setJustFinishedDragging(true);
                              }
                              setIsOverTrash(false);
                            }
                            setDraggingShotId(null);
                            setDragTargetId(null);
                          }}
                          onMouseLeave={() => {
                            if (dragUpdateRef.current) {
                              cancelAnimationFrame(dragUpdateRef.current);
                              dragUpdateRef.current = null;
                            }
                            setDraggingShotId(null);
                            setIsOverTrash(false);
                            setDragTargetId(null);
                          }}
                          onClick={(e) => {
                            // Prevent shot marking if we just finished dragging a shot
                            if (justFinishedDragging) {
                              setJustFinishedDragging(false);
                              return;
                            }

                            const rect = e.currentTarget.getBoundingClientRect();
                            const relativeX = (e.clientX - rect.left) / rect.width;
                            const relativeY = (e.clientY - rect.top) / rect.height;

                            const shotX = cropX + (relativeX * cropSize);
                            const shotY = cropY + (relativeY * cropSize);

                            const newShot = {
                              id: Date.now(),
                              x: shotX,
                              y: shotY
                            };

                            setSelectedTargets(prev => prev.map(t =>
                              t.id === target.id
                                ? { ...t, shots: [...t.shots, newShot] }
                                : t
                            ));
                          }}
                          onTouchStart={(e) => {
                            e.preventDefault(); // Prevent scrolling
                            setJustFinishedDragging(false);

                            // Two-finger pinch to zoom
                            if (e.touches.length === 2) {
                              const touch1 = e.touches[0];
                              const touch2 = e.touches[1];
                              const distance = Math.sqrt(
                                Math.pow(touch2.clientX - touch1.clientX, 2) +
                                Math.pow(touch2.clientY - touch1.clientY, 2)
                              );

                              setIsPinching(true);
                              setInitialPinchDistance(distance);
                              setInitialPinchRadius(currentRadius);
                              setDragTargetId(target.id);
                              return;
                            }

                            // Single-finger touch (same as mouse)
                            const touch = e.touches[0];
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = touch.clientX - rect.left;
                            const clickY = touch.clientY - rect.top;
                            const relativeX = clickX / rect.width;
                            const relativeY = clickY / rect.height;

                            const imageX = cropX + (relativeX * cropSize);
                            const imageY = cropY + (relativeY * cropSize);

                            // Check resize handles first (larger for mobile)
                            const handleHitSize = 40;
                            const handles = [
                              { name: 'nw', x: currentX - currentRadius, y: currentY - currentRadius },
                              { name: 'ne', x: currentX + currentRadius, y: currentY - currentRadius },
                              { name: 'se', x: currentX + currentRadius, y: currentY + currentRadius },
                              { name: 'sw', x: currentX - currentRadius, y: currentY + currentRadius }
                            ];

                            for (let handle of handles) {
                              const distFromHandle = Math.sqrt(
                                Math.pow(imageX - handle.x, 2) + Math.pow(imageY - handle.y, 2)
                              );
                              if (distFromHandle <= handleHitSize) {
                                setIsResizing(true);
                                setDragTargetId(target.id);
                                setResizeHandle(handle.name);
                                setDragStart({
                                  x: imageX,
                                  y: imageY,
                                  startRadius: currentRadius,
                                  startX: currentX,
                                  startY: currentY
                                });
                                return;
                              }
                            }

                            // Check perimeter drag (wider threshold for mobile - 40px)
                            const distFromCenter = Math.sqrt(
                              Math.pow(imageX - currentX, 2) + Math.pow(imageY - currentY, 2)
                            );
                            const distFromPerimeter = Math.abs(distFromCenter - currentRadius);
                            const dragThreshold = 40;

                            if (distFromPerimeter <= dragThreshold) {
                              setIsDragging(true);
                              setDragTargetId(target.id);
                              setDragStart({ x: imageX - currentX, y: imageY - currentY });
                            }
                          }}
                          onTouchMove={(e) => {
                            e.preventDefault(); // Prevent scrolling

                            // Two-finger pinch-to-zoom
                            if (isPinching && e.touches.length === 2) {
                              if (dragTargetId !== target.id) return;

                              const touch1 = e.touches[0];
                              const touch2 = e.touches[1];
                              const currentDistance = Math.sqrt(
                                Math.pow(touch2.clientX - touch1.clientX, 2) +
                                Math.pow(touch2.clientY - touch1.clientY, 2)
                              );

                              // Calculate scale factor based on pinch distance change
                              const scaleFactor = currentDistance / initialPinchDistance;
                              const newRadius = Math.max(10, initialPinchRadius * scaleFactor);
                              const newPixelsPerInch = (newRadius * 2) / target.diameterInches;

                              setSelectedTargets(prev => prev.map(t =>
                                t.id === target.id
                                  ? {
                                      ...t,
                                      adjustedRadius: newRadius,
                                      pixelsPerInch: newPixelsPerInch
                                    }
                                  : t
                              ));
                              return;
                            }

                            // Single-finger drag/resize (same as mouse)
                            if (!isDragging && !isResizing && !draggingShotId) return;
                            if (dragTargetId !== target.id && !draggingShotId) return;

                            const touch = e.touches[0];
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = touch.clientX - rect.left;
                            const clickY = touch.clientY - rect.top;
                            const relativeX = clickX / rect.width;
                            const relativeY = clickY / rect.height;

                            const imageX = cropX + (relativeX * cropSize);
                            const imageY = cropY + (relativeY * cropSize);

                            if (dragUpdateRef.current) {
                              cancelAnimationFrame(dragUpdateRef.current);
                            }

                            dragUpdateRef.current = requestAnimationFrame(() => {
                              if (draggingShotId) {
                                // Update shot position
                                setSelectedTargets(prev => prev.map(t =>
                                  t.id === target.id
                                    ? {
                                        ...t,
                                        shots: t.shots.map(s =>
                                          s.id === draggingShotId
                                            ? { ...s, x: imageX, y: imageY }
                                            : s
                                        )
                                      }
                                    : t
                                ));
                              } else if (isDragging) {
                                const newX = imageX - dragStart.x;
                                const newY = imageY - dragStart.y;
                                setSelectedTargets(prev => prev.map(t =>
                                  t.id === target.id
                                    ? { ...t, adjustedX: newX, adjustedY: newY }
                                    : t
                                ));
                              } else if (isResizing) {
                                const deltaX = imageX - dragStart.x;
                                const deltaY = imageY - dragStart.y;
                                const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                                const scalingFactor = 0.3;

                                let radiusChange = dragDistance * scalingFactor;
                                if (resizeHandle === 'nw' || resizeHandle === 'sw') {
                                  radiusChange = deltaX < 0 ? dragDistance * scalingFactor : -dragDistance * scalingFactor;
                                } else {
                                  radiusChange = deltaX > 0 ? dragDistance * scalingFactor : -dragDistance * scalingFactor;
                                }

                                const newRadius = Math.max(10, dragStart.startRadius + radiusChange);
                                const newPixelsPerInch = (newRadius * 2) / target.diameterInches;

                                setSelectedTargets(prev => prev.map(t =>
                                  t.id === target.id
                                    ? {
                                        ...t,
                                        adjustedRadius: newRadius,
                                        pixelsPerInch: newPixelsPerInch
                                      }
                                    : t
                                ));
                              }
                            });
                          }}
                          onTouchEnd={(e) => {
                            e.preventDefault();

                            if (dragUpdateRef.current) {
                              cancelAnimationFrame(dragUpdateRef.current);
                              dragUpdateRef.current = null;
                            }

                            if (isDragging || isResizing || isPinching || draggingShotId) {
                              setJustFinishedDragging(true);
                            }

                            setIsDragging(false);
                            setIsResizing(false);
                            setIsPinching(false);
                            setDragTargetId(null);
                            setResizeHandle(null);
                            setDraggingShotId(null);

                            // Handle tap for shot marking (only if single touch and not dragging)
                            if (e.touches.length === 0 && e.changedTouches.length === 1 && !justFinishedDragging) {
                              const touch = e.changedTouches[0];
                              const rect = e.currentTarget.getBoundingClientRect();
                              const relativeX = (touch.clientX - rect.left) / rect.width;
                              const relativeY = (touch.clientY - rect.top) / rect.height;

                              const shotX = cropX + (relativeX * cropSize);
                              const shotY = cropY + (relativeY * cropSize);

                              const newShot = {
                                id: Date.now(),
                                x: shotX,
                                y: shotY
                              };

                              setSelectedTargets(prev => prev.map(t =>
                                t.id === target.id
                                  ? { ...t, shots: [...t.shots, newShot] }
                                  : t
                              ));
                            }
                          }}
                        >
                          <div className="absolute inset-0">
                            <img
                              src={uploadedImage}
                              alt={`Target ${index + 1}`}
                              className="absolute"
                              style={{
                                width: `${(target.imageWidth / cropSize) * 100}%`,
                                height: `${(target.imageHeight / cropSize) * 100}%`,
                                left: `${(-cropX / cropSize) * 100}%`,
                                top: `${(-cropY / cropSize) * 100}%`,
                                maxWidth: 'none',
                                pointerEvents: 'none'
                              }}
                            />

                            <svg
                              className="absolute inset-0 w-full h-full"
                              viewBox={`0 0 ${cropSize} ${cropSize}`}
                              style={{ pointerEvents: 'none' }}
                            >
                              {/* Target circle - static reference only, not adjustable */}
                              <circle
                                cx={currentRadius * 5}
                                cy={currentRadius * 5}
                                r={currentRadius}
                                fill="none"
                                stroke="#22c55e"
                                strokeWidth="4"
                                style={{ pointerEvents: 'none' }}
                              />

                              {/* Crosshair lines */}
                              <line
                                x1={currentRadius * 5}
                                y1={0}
                                x2={currentRadius * 5}
                                y2={cropSize}
                                stroke="#22c55e"
                                strokeWidth="0.5"
                                strokeDasharray="2,2"
                                opacity="0.3"
                              />
                              <line
                                x1={0}
                                y1={currentRadius * 5}
                                x2={cropSize}
                                y2={currentRadius * 5}
                                stroke="#22c55e"
                                strokeWidth="0.5"
                                strokeDasharray="2,2"
                                opacity="0.3"
                              />

                              {/* Shot markers */}
                              {target.shots.map((shot, shotIndex) => {
                                const shotDisplayX = shot.x - cropX;
                                const shotDisplayY = shot.y - cropY;

                                // Calculate shot marker size based on caliber (half bullet diameter, then halved again for display)
                                const rifle = equipment.rifles.find(r => r.name === sessionData.rifle);
                                let bulletDiameterInches = 0.308; // Default .308
                                if (rifle?.caliber) {
                                  // Parse caliber (e.g., "6.5 Creedmoor" -> 0.264", ".308 Win" -> 0.308")
                                  const calMatch = rifle.caliber.match(/(\d+\.?\d*)/);
                                  if (calMatch) {
                                    const calValue = parseFloat(calMatch[1]);
                                    if (calValue < 1) {
                                      bulletDiameterInches = calValue; // Already in inches (e.g., .308)
                                    } else if (calValue < 20) {
                                      // Metric mm (e.g., 6.5) - convert to inches
                                      bulletDiameterInches = calValue / 25.4;
                                    }
                                  }
                                }
                                // Reduced to half diameter (quarter of original full bullet diameter)
                                const markerRadius = Math.max(2, (bulletDiameterInches / 4) * target.pixelsPerInch);

                                if (shotDisplayX >= 0 && shotDisplayX <= cropSize &&
                                    shotDisplayY >= 0 && shotDisplayY <= cropSize) {
                                  return (
                                    <g
                                      key={shot.id}
                                      style={{ cursor: draggingShotId === shot.id ? 'grabbing' : 'grab' }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setDraggingShotId(shot.id);
                                        setShotDragOffset({ x: 0, y: 0 });
                                      }}
                                      onTouchStart={(e) => {
                                        e.stopPropagation();
                                        setDraggingShotId(shot.id);
                                        setShotDragOffset({ x: 0, y: 0 });
                                      }}
                                    >
                                      <circle
                                        cx={shotDisplayX}
                                        cy={shotDisplayY}
                                        r={markerRadius}
                                        fill={draggingShotId === shot.id ? "#dc2626" : "#ef4444"}
                                        stroke="#dc2626"
                                        strokeWidth="1"
                                        style={{ pointerEvents: 'all' }}
                                      />
                                      <text
                                        x={shotDisplayX}
                                        y={shotDisplayY + markerRadius * 0.25}
                                        fill="white"
                                        fontSize={Math.min(12, markerRadius * 1.2)}
                                        textAnchor="middle"
                                        fontWeight="bold"
                                        style={{ pointerEvents: 'none' }}
                                      >
                                        {shotIndex + 1}
                                      </text>
                                    </g>
                                  );
                                }
                                return null;
                              })}
                            </svg>

                            {/* Drag-and-drop trash bin - overlay on image */}
                            {target.shots.length > 0 && (
                              <div
                                id={`trash-${target.id}`}
                                className={`absolute bottom-2 right-2 flex items-center justify-center p-3 rounded-lg border-2 border-dashed transition-all pointer-events-auto ${
                                  draggingShotId && dragTargetId === target.id && isOverTrash
                                    ? 'bg-red-100 dark:bg-red-900/90 border-red-500 scale-125'
                                    : 'bg-gray-100/90 dark:bg-gray-700/90 border-gray-300 dark:border-gray-600'
                                }`}
                                title="Drag shots here to delete"
                                style={{ zIndex: 10 }}
                              >
                                <Trash2 className={`h-5 w-5 ${
                                  draggingShotId && dragTargetId === target.id && isOverTrash
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`} />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-sm space-y-1 text-gray-900 dark:text-white">
                          <p>Shots marked: {target.shots.length}</p>
                          {target.shots.length >= 2 && (() => {
                            const stats = calculateGroupStats(target.shots, currentX, currentY, target.pixelsPerInch);
                            return (
                              <>
                                <p>Group size: {stats.sizeInches.toFixed(3)}"</p>
                                <p>Mean radius: {stats.meanRadiusInches.toFixed(3)}"</p>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setCaptureStep('select-targets')}
                    className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setCaptureStep('review')}
                    className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    Review Session
                  </button>
                </div>
              </div>
            )}

            {captureStep === 'review' && (
              <div className="space-y-6">
                <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-white`}>Session Review</h2>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Session Details</h3>
                  <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4 text-sm`}>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">Session Name</p>
                      <p className="font-medium text-gray-900 dark:text-white">{sessionData.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">Date</p>
                      <p className="font-medium text-gray-900 dark:text-white">{sessionData.date}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">Rifle</p>
                      <p className="font-medium text-gray-900 dark:text-white">{sessionData.rifle}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">Load</p>
                      <p className="font-medium text-gray-900 dark:text-white">{sessionData.load}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">Distance</p>
                      <p className="font-medium text-gray-900 dark:text-white">{sessionData.distance} yards</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">Temperature</p>
                      <p className="font-medium text-gray-900 dark:text-white">{sessionData.temperature}°F</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">Wind</p>
                      <p className="font-medium text-gray-900 dark:text-white">{sessionData.windSpeed} mph @ {sessionData.windDirection} o'clock</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">Humidity</p>
                      <p className="font-medium text-gray-900 dark:text-white">{sessionData.humidity}%</p>
                    </div>
                  </div>

                  {sessionData.chronoData && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Chronograph Data</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 dark:text-gray-300">Shots</p>
                          <p className="font-medium text-gray-900 dark:text-white">{sessionData.chronoData.count}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-300">Average</p>
                          <p className="font-medium text-gray-900 dark:text-white">{sessionData.chronoData.average.toFixed(0)} fps</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-300">ES</p>
                          <p className="font-medium text-gray-900 dark:text-white">{sessionData.chronoData.es.toFixed(0)} fps</p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-300">SD</p>
                          <p className="font-medium text-gray-900 dark:text-white">{sessionData.chronoData.sd.toFixed(1)} fps</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Target Summary</h3>
                  <div className="space-y-4">
                    {selectedTargets.map((target, index) => {
                      const finalX = target.adjustedX ?? target.x;
                      const finalY = target.adjustedY ?? target.y;
                      const stats = calculateGroupStats(target.shots, finalX, finalY, target.pixelsPerInch);

                      return (
                        <div key={target.id} className="border-l-4 border-purple-500 dark:border-purple-400 pl-4">
                          <h4 className="font-medium text-gray-900 dark:text-white">Target {index + 1}</h4>
                          <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4 mt-2 text-sm`}>
                            <div>
                              <p className="text-gray-600 dark:text-gray-300">Shots</p>
                              <p className="font-medium text-gray-900 dark:text-white">{target.shots.length}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 dark:text-gray-300">Group Size</p>
                              <p className="font-medium text-gray-900 dark:text-white">{stats.sizeInches.toFixed(3)}"</p>
                            </div>
                            <div>
                              <p className="text-gray-600 dark:text-gray-300">Mean Radius</p>
                              <p className="font-medium text-gray-900 dark:text-white">{stats.meanRadiusInches.toFixed(3)}"</p>
                            </div>
                            <div>
                              <p className="text-gray-600 dark:text-gray-300">Std Dev</p>
                              <p className="font-medium text-gray-900 dark:text-white">{stats.standardDevInches.toFixed(3)}"</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setCaptureStep('mark-shots')}
                    className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      console.log('Save button clicked');
                      await saveSession();
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center"
                  >
                    <Save className="h-5 w-5 mr-2" />
                    Save Session
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-white`}>Performance Analytics</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const report = generateAnalyticsReport();
                    exportFilteredSessionsToExcel(report.filteredSessions);
                  }}
                  className={`bg-purple-600 hover:bg-purple-700 text-white ${isMobile ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'} rounded-lg font-medium transition-colors flex items-center`}
                  disabled={sessions.length === 0}
                  title="Export filtered sessions to Excel"
                >
                  <Download className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} mr-2`} />
                  {isMobile ? 'Excel' : 'Export Excel'}
                </button>
                <button
                  onClick={exportToCSV}
                  className={`bg-green-600 hover:bg-green-700 text-white ${isMobile ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'} rounded-lg font-medium transition-colors flex items-center`}
                  disabled={sessions.length === 0}
                  title="Export all sessions to CSV"
                >
                  <Download className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} mr-2`} />
                  {isMobile ? 'CSV' : 'Export CSV'}
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Filters</h3>
              <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-3 lg:grid-cols-5'} gap-4`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Rifle</label>
                  <select
                    value={analyticsFilters.rifle}
                    onChange={(e) => setAnalyticsFilters({...analyticsFilters, rifle: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    <option value="all">All Rifles</option>
                    {equipment.rifles.map(rifle => (
                      <option key={rifle.name} value={rifle.name}>{rifle.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Load</label>
                  <select
                    value={analyticsFilters.load}
                    onChange={(e) => setAnalyticsFilters({...analyticsFilters, load: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    <option value="all">All Loads</option>
                    {equipment.loads.map(load => (
                      <option key={load.name} value={load.name}>{load.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Session</label>
                  <select
                    value={analyticsFilters.session}
                    onChange={(e) => setAnalyticsFilters({...analyticsFilters, session: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    <option value="all">All Sessions</option>
                    {sessions.map(session => (
                      <option key={session.id} value={session.id}>{session.name} - {session.date}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Silencer</label>
                  <select
                    value={analyticsFilters.silencer}
                    onChange={(e) => setAnalyticsFilters({...analyticsFilters, silencer: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="true">With Silencer</option>
                    <option value="false">Without Silencer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Distance (yds): {analyticsFilters.distance[0]}-{analyticsFilters.distance[1]}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={analyticsFilters.distance[0]}
                      onChange={(e) => setAnalyticsFilters({
                        ...analyticsFilters,
                        distance: [parseInt(e.target.value) || 0, analyticsFilters.distance[1]]
                      })}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      placeholder="Min"
                    />
                    <span className="text-gray-500 dark:text-gray-400">-</span>
                    <input
                      type="number"
                      value={analyticsFilters.distance[1]}
                      onChange={(e) => setAnalyticsFilters({
                        ...analyticsFilters,
                        distance: [analyticsFilters.distance[0], parseInt(e.target.value) || 1000]
                      })}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      placeholder="Max"
                    />
                  </div>
                </div>
              </div>
            </div>

            {sessions.length > 0 ? (
              <>
                {(() => {
                  const report = generateAnalyticsReport();
                  const comparisonData = getComparisonData();
                  
                  return (
                    <>
                      <div className={`grid grid-cols-1 ${isMobile ? 'grid-cols-2 gap-4' : 'md:grid-cols-4 gap-6'}`}>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                          <div className="flex items-center mb-2">
                            <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                            <p className="text-sm text-gray-600 dark:text-gray-300">Sessions</p>
                          </div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.aggregateStats.totalSessions}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                          <div className="flex items-center mb-2">
                            <Target className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                            <p className="text-sm text-gray-600 dark:text-gray-300">Total Shots</p>
                          </div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.aggregateStats.totalShots}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                          <div className="flex items-center mb-2">
                            <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                            <p className="text-sm text-gray-600 dark:text-gray-300">Avg Group</p>
                          </div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.aggregateStats.avgGroupSize.toFixed(3)}"</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                          <div className="flex items-center mb-2">
                            <Award className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                            <p className="text-sm text-gray-600 dark:text-gray-300">Best Group</p>
                          </div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.aggregateStats.bestGroup.toFixed(3)}"</p>
                        </div>
                      </div>

                      {/* Charts Section */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart 1: Group Size Over Time */}
                        {!chartCollapsed.groupSize ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Group Size Over Time</h3>
                            <button
                              onClick={() => setChartCollapsed({...chartCollapsed, groupSize: !chartCollapsed.groupSize})}
                              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                              title="Minimize chart"
                            >
                              ▲
                            </button>
                          </div>
                          {(() => {
                            const sessionsWithData = report.filteredSessions
                              .map(s => ({
                                date: new Date(s.date),
                                dateStr: s.date,
                                avgGroup: s.targets
                                  .filter(t => t.shots?.length >= 2 && t.stats)
                                  .reduce((sum, t, _, arr) => sum + (t.stats.sizeInches / arr.length), 0)
                              }))
                              .filter(s => s.avgGroup > 0)
                              .sort((a, b) => a.date - b.date);

                            if (sessionsWithData.length === 0) {
                              return <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>;
                            }

                            const width = 500;
                            const height = 300;
                            const padding = { top: 20, right: 20, bottom: 40, left: 50 };
                            const chartWidth = width - padding.left - padding.right;
                            const chartHeight = height - padding.top - padding.bottom;

                            const maxGroup = Math.max(...sessionsWithData.map(d => d.avgGroup));
                            const minGroup = Math.min(...sessionsWithData.map(d => d.avgGroup));
                            const yScale = (value) => chartHeight - ((value - minGroup) / (maxGroup - minGroup || 1)) * chartHeight;

                            const points = sessionsWithData.map((d, i) => {
                              const x = padding.left + (i / (sessionsWithData.length - 1 || 1)) * chartWidth;
                              const y = padding.top + yScale(d.avgGroup);
                              return `${x},${y}`;
                            }).join(' ');

                            return (
                              <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
                                {/* Grid lines */}
                                {[0, 0.25, 0.5, 0.75, 1].map(fraction => {
                                  const y = padding.top + chartHeight * (1 - fraction);
                                  const value = minGroup + (maxGroup - minGroup) * fraction;
                                  return (
                                    <g key={fraction}>
                                      <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                                        stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="1" />
                                      <text x={padding.left - 10} y={y + 4} textAnchor="end"
                                        className="text-xs fill-gray-600 dark:fill-gray-400">
                                        {value.toFixed(2)}"
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Line */}
                                <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" />

                                {/* Points */}
                                {sessionsWithData.map((d, i) => {
                                  const x = padding.left + (i / (sessionsWithData.length - 1 || 1)) * chartWidth;
                                  const y = padding.top + yScale(d.avgGroup);
                                  return (
                                    <circle key={i} cx={x} cy={y} r="4" fill="#3b82f6" />
                                  );
                                })}

                                {/* X-axis labels */}
                                {sessionsWithData.map((d, i) => {
                                  if (sessionsWithData.length > 10 && i % Math.ceil(sessionsWithData.length / 5) !== 0) return null;
                                  const x = padding.left + (i / (sessionsWithData.length - 1 || 1)) * chartWidth;
                                  return (
                                    <text key={i} x={x} y={height - 10} textAnchor="middle"
                                      className="text-xs fill-gray-600 dark:fill-gray-400">
                                      {d.dateStr.slice(5)}
                                    </text>
                                  );
                                })}

                                {/* Axis labels */}
                                <text x={padding.left / 2} y={height / 2} textAnchor="middle"
                                  transform={`rotate(-90 ${padding.left / 2} ${height / 2})`}
                                  className="text-sm fill-gray-700 dark:fill-gray-300 font-medium">
                                  Group Size (inches)
                                </text>
                              </svg>
                            );
                          })()}
                        </div>
                        ) : (
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                            <div className="flex justify-between items-center">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Group Size Over Time</h3>
                              <button
                                onClick={() => setChartCollapsed({...chartCollapsed, groupSize: !chartCollapsed.groupSize})}
                                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                title="Expand chart"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Chart 2: Shot Distribution Plot */}
                        {!chartCollapsed.shotDistribution ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Shot Distribution</h3>
                            <button
                              onClick={() => setChartCollapsed({...chartCollapsed, shotDistribution: !chartCollapsed.shotDistribution})}
                              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                              title="Minimize chart"
                            >
                              ▲
                            </button>
                          </div>
                          {(() => {
                            const allShots = [];
                            report.filteredSessions.forEach(session => {
                              session.targets.forEach(target => {
                                if (target.stats && target.shots?.length >= 2) {
                                  target.shots.forEach(shot => {
                                    const xOffset = (shot.x - target.x) / target.pixelsPerInch;
                                    const yOffset = -(shot.y - target.y) / target.pixelsPerInch; // Negative for proper orientation
                                    allShots.push({ x: xOffset, y: yOffset });
                                  });
                                }
                              });
                            });

                            if (allShots.length === 0) {
                              return <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>;
                            }

                            const width = 500;
                            const height = 300;
                            const padding = 40;
                            const chartSize = Math.min(width, height) - 2 * padding;

                            const maxOffset = Math.max(...allShots.map(s => Math.max(Math.abs(s.x), Math.abs(s.y))));
                            const scale = chartSize / (2 * (maxOffset || 1));

                            return (
                              <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
                                {/* Center crosshairs */}
                                <line x1={width / 2 - 20} y1={height / 2} x2={width / 2 + 20} y2={height / 2}
                                  stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth="1" />
                                <line x1={width / 2} y1={height / 2 - 20} x2={width / 2} y2={height / 2 + 20}
                                  stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth="1" />

                                {/* Circle guides */}
                                {[0.5, 1, 1.5].map(radius => (
                                  <circle key={radius}
                                    cx={width / 2} cy={height / 2}
                                    r={radius * scale}
                                    fill="none" stroke="currentColor"
                                    className="text-gray-200 dark:text-gray-700"
                                    strokeWidth="1" strokeDasharray="4,4" />
                                ))}

                                {/* Shot points */}
                                {allShots.map((shot, i) => (
                                  <circle key={i}
                                    cx={width / 2 + shot.x * scale}
                                    cy={height / 2 + shot.y * scale}
                                    r="3"
                                    fill="#ef4444"
                                    opacity="0.6" />
                                ))}

                                {/* Scale reference */}
                                <text x={width / 2} y={height - 5} textAnchor="middle"
                                  className="text-xs fill-gray-600 dark:fill-gray-400">
                                  All shots relative to target center
                                </text>
                              </svg>
                            );
                          })()}
                        </div>
                        ) : (
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                            <div className="flex justify-between items-center">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Shot Distribution</h3>
                              <button
                                onClick={() => setChartCollapsed({...chartCollapsed, shotDistribution: !chartCollapsed.shotDistribution})}
                                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                title="Expand chart"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Chart 3: Performance by Configuration */}
                        {!chartCollapsed.performance ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 lg:col-span-2">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance by Configuration</h3>
                            <div className="flex items-center gap-2">
                              <select
                                value={performanceMetric}
                                onChange={(e) => setPerformanceMetric(e.target.value)}
                                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                              >
                                <option value="velocity">Avg Velocity (fps)</option>
                                <option value="groupSize">Avg Group Size (in)</option>
                                <option value="totalRounds">Total Rounds Fired</option>
                                <option value="avgPOI">Avg POI Vertical (MOA)</option>
                              </select>
                              <button
                                onClick={() => setChartCollapsed({...chartCollapsed, performance: !chartCollapsed.performance})}
                                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                title="Minimize chart"
                              >
                                ▲
                              </button>
                            </div>
                          </div>
                          {(() => {
                            const configStats = {};
                            report.filteredSessions.forEach(session => {
                              const configKey = `${session.rifle} + ${session.load}${session.silencer ? ' (Silencer)' : ''}`;
                              if (!configStats[configKey]) {
                                configStats[configKey] = {
                                  groupSizes: [],
                                  velocities: [],
                                  totalRounds: 0,
                                  pois: []
                                };
                              }
                              session.targets.forEach(target => {
                                if (target.stats && target.shots?.length >= 2) {
                                  configStats[configKey].groupSizes.push(target.stats.sizeInches);
                                  configStats[configKey].totalRounds += target.shots.length;
                                  const poiVerticalInches = -target.stats.groupCenterYInches;
                                  const distance = session.distance || 100;
                                  const poiMOA = distance > 0 ? (poiVerticalInches * 95.5) / distance : 0;
                                  configStats[configKey].pois.push(poiMOA);
                                }
                              });
                              if (session.chronoData) {
                                configStats[configKey].velocities.push(session.chronoData.average);
                              }
                            });

                            const configs = Object.entries(configStats)
                              .map(([name, data]) => {
                                let value = 0, label = '';
                                if (performanceMetric === 'velocity') {
                                  value = data.velocities.length > 0
                                    ? data.velocities.reduce((a, b) => a + b, 0) / data.velocities.length
                                    : 0;
                                  label = 'fps';
                                } else if (performanceMetric === 'groupSize') {
                                  value = data.groupSizes.length > 0
                                    ? data.groupSizes.reduce((a, b) => a + b, 0) / data.groupSizes.length
                                    : 0;
                                  label = 'in';
                                } else if (performanceMetric === 'totalRounds') {
                                  value = data.totalRounds;
                                  label = 'rounds';
                                } else if (performanceMetric === 'avgPOI') {
                                  value = data.pois.length > 0
                                    ? data.pois.reduce((a, b) => a + b, 0) / data.pois.length
                                    : 0;
                                  label = 'MOA';
                                }
                                return {
                                  name,
                                  value,
                                  label,
                                  count: data.groupSizes.length
                                };
                              })
                              .filter(c => c.value > 0)
                              .sort((a, b) => {
                                if (performanceMetric === 'groupSize' || performanceMetric === 'avgPOI') {
                                  return a.value - b.value; // Smaller is better
                                }
                                return b.value - a.value; // Larger is better
                              })
                              .slice(0, 10); // Top 10

                            if (configs.length === 0) {
                              return <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>;
                            }

                            const width = 1000;
                            const height = 400;
                            const padding = { top: 20, right: 20, bottom: 120, left: 60 };
                            const chartWidth = width - padding.left - padding.right;
                            const chartHeight = height - padding.top - padding.bottom;

                            const maxValue = Math.max(...configs.map(c => c.value));
                            const barWidth = chartWidth / configs.length * 0.8;
                            const barSpacing = chartWidth / configs.length;

                            return (
                              <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
                                {/* Y-axis grid */}
                                {[0, 0.25, 0.5, 0.75, 1].map(fraction => {
                                  const y = padding.top + chartHeight * (1 - fraction);
                                  const gridValue = maxValue * fraction;
                                  return (
                                    <g key={fraction}>
                                      <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
                                        stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="1" />
                                      <text x={padding.left - 10} y={y + 4} textAnchor="end"
                                        className="text-xs fill-gray-600 dark:fill-gray-400">
                                        {performanceMetric === 'totalRounds' ? gridValue.toFixed(0) : gridValue.toFixed(1)}
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Bars */}
                                {configs.map((config, i) => {
                                  const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
                                  const barHeight = (config.value / maxValue) * chartHeight;
                                  const y = padding.top + chartHeight - barHeight;

                                  return (
                                    <g key={i}>
                                      <rect x={x} y={y} width={barWidth} height={barHeight}
                                        fill="#10b981" opacity="0.8" />
                                      <text x={x + barWidth / 2} y={y - 5} textAnchor="middle"
                                        className="text-xs fill-gray-900 dark:fill-white font-medium">
                                        {performanceMetric === 'totalRounds' ? config.value.toFixed(0) : config.value.toFixed(1)} {config.label}
                                      </text>
                                      <text x={x + barWidth / 2} y={height - padding.bottom + 15}
                                        textAnchor="end" transform={`rotate(-45 ${x + barWidth / 2} ${height - padding.bottom + 15})`}
                                        className="text-xs fill-gray-600 dark:fill-gray-400">
                                        {config.name}
                                      </text>
                                      <text x={x + barWidth / 2} y={height - padding.bottom + 30}
                                        textAnchor="end" transform={`rotate(-45 ${x + barWidth / 2} ${height - padding.bottom + 30})`}
                                        className="text-xs fill-gray-500 dark:fill-gray-500">
                                        ({config.count} groups)
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Axis labels */}
                                <text x={padding.left / 2} y={height / 2} textAnchor="middle"
                                  transform={`rotate(-90 ${padding.left / 2} ${height / 2})`}
                                  className="text-sm fill-gray-700 dark:fill-gray-300 font-medium">
                                  Average Group Size (inches)
                                </text>
                              </svg>
                            );
                          })()}
                        </div>
                        ) : (
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 lg:col-span-2">
                            <div className="flex justify-between items-center">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance by Configuration</h3>
                              <button
                                onClick={() => setChartCollapsed({...chartCollapsed, performance: !chartCollapsed.performance})}
                                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                title="Expand chart"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Group Details Toggle */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Group Details</h3>
                          <button
                            onClick={() => setShowGroupDetails(!showGroupDetails)}
                            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm font-medium"
                          >
                            {showGroupDetails ? 'Hide Details' : 'Show Details'}
                          </button>
                        </div>

                        {showGroupDetails && (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                              <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Session</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Rifle</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Load</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Target</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Shots</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Group Size</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Mean Radius</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Velocity</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {report.targetStats.map((stat, index) => (
                                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{stat.sessionName}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{stat.date}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{stat.rifle}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{stat.load}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{stat.targetIndex}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{stat.shots}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{stat.groupSize.toFixed(3)}"</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{stat.meanRadius.toFixed(3)}"</td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                      {stat.chronoAvg ? `${stat.chronoAvg.toFixed(0)} fps` : 'N/A'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Statistical Comparison */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Statistical Comparison</h3>

                        <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-3'} gap-4 mb-4`}>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Compare By</label>
                            <select
                              value={comparisonType}
                              onChange={(e) => {
                                setComparisonType(e.target.value);
                                setComparisonA('');
                                setComparisonB('');
                              }}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                            >
                              <option value="loads">Loads</option>
                              <option value="rifles">Rifles</option>
                              <option value="sessions">Sessions</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Group A</label>
                            <select
                              value={comparisonA}
                              onChange={(e) => setComparisonA(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                            >
                              <option value="">Select {comparisonType.slice(0, -1)}</option>
                              {comparisonType === 'loads' && Object.keys(comparisonData.groupsByLoad).map(load => (
                                <option key={load} value={load}>{load} ({comparisonData.groupsByLoad[load].length} groups)</option>
                              ))}
                              {comparisonType === 'rifles' && Object.keys(comparisonData.groupsByRifle).map(rifle => (
                                <option key={rifle} value={rifle}>{rifle} ({comparisonData.groupsByRifle[rifle].length} groups)</option>
                              ))}
                              {comparisonType === 'sessions' && Object.keys(comparisonData.groupsBySession).map(sessionId => (
                                <option key={sessionId} value={sessionId}>
                                  {comparisonData.groupsBySession[sessionId].name} ({comparisonData.groupsBySession[sessionId].groups.length} groups)
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Group B</label>
                            <select
                              value={comparisonB}
                              onChange={(e) => setComparisonB(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                            >
                              <option value="">Select {comparisonType.slice(0, -1)}</option>
                              {comparisonType === 'loads' && Object.keys(comparisonData.groupsByLoad).map(load => (
                                <option key={load} value={load} disabled={load === comparisonA}>
                                  {load} ({comparisonData.groupsByLoad[load].length} groups)
                                </option>
                              ))}
                              {comparisonType === 'rifles' && Object.keys(comparisonData.groupsByRifle).map(rifle => (
                                <option key={rifle} value={rifle} disabled={rifle === comparisonA}>
                                  {rifle} ({comparisonData.groupsByRifle[rifle].length} groups)
                                </option>
                              ))}
                              {comparisonType === 'sessions' && Object.keys(comparisonData.groupsBySession).map(sessionId => (
                                <option key={sessionId} value={sessionId} disabled={sessionId === comparisonA}>
                                  {comparisonData.groupsBySession[sessionId].name} ({comparisonData.groupsBySession[sessionId].groups.length} groups)
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setShowStatistics(true)}
                          disabled={!comparisonA || !comparisonB}
                          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:dark:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          Run Comparison
                        </button>

                        {showStatistics && comparisonA && comparisonB && (() => {
                          let groupA, groupB;

                          if (comparisonType === 'loads') {
                            groupA = comparisonData.groupsByLoad[comparisonA]?.shots || [];
                            groupB = comparisonData.groupsByLoad[comparisonB]?.shots || [];
                          } else if (comparisonType === 'rifles') {
                            groupA = comparisonData.groupsByRifle[comparisonA]?.shots || [];
                            groupB = comparisonData.groupsByRifle[comparisonB]?.shots || [];
                          } else {
                            groupA = comparisonData.groupsBySession[comparisonA]?.shots || [];
                            groupB = comparisonData.groupsBySession[comparisonB]?.shots || [];
                          }

                          const result = performTTest(groupA, groupB);

                          // Display error message if T-test failed
                          if (result.error) {
                            return (
                              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                                <div className="flex items-start">
                                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="font-medium text-red-800 dark:text-red-200">T-Test Error</p>
                                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{result.error}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">T-Test Results (Independent Samples)</h4>

                              {/* Warning for small sample sizes */}
                              {result.warning && (
                                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                                  <div className="flex items-start">
                                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">{result.warning}</p>
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">Group A Mean</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{result.mean1}" (n={result.n1})</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">Group B Mean</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{result.mean2}" (n={result.n2})</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">T-Statistic</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{result.tStat}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">Degrees of Freedom</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{result.df}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-sm text-gray-600 dark:text-gray-300">Statistical Significance (α = 0.05)</p>
                                  <p className={`font-medium ${result.significant ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {result.significant
                                      ? 'Statistically significant difference (p < 0.05)'
                                      : 'No statistically significant difference (p > 0.05)'}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-sm text-gray-600 dark:text-gray-300">Interpretation</p>
                                  <p className="text-sm text-gray-900 dark:text-white">
                                    {result.significant
                                      ? `The groups show a statistically significant difference. Group A averages ${Math.abs(parseFloat(result.mean1) - parseFloat(result.mean2)).toFixed(3)}" ${parseFloat(result.mean1) < parseFloat(result.mean2) ? 'smaller' : 'larger'} groups than Group B.`
                                      : 'The groups do not show a statistically significant difference at the 95% confidence level.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Session Summary</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Session</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Distance</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Shots</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Best Group</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                  <div className="flex items-center gap-2">
                                    POI V/H
                                    <select
                                      value={poiUnit}
                                      onChange={(e) => setPoiUnit(e.target.value)}
                                      className="text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
                                    >
                                      <option value="inches">IN</option>
                                      <option value="moa">MOA</option>
                                      <option value="mils">MILS</option>
                                    </select>
                                  </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Velocity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {report.filteredSessions.map(session => {
                                const sessionGroups = session.targets
                                  .filter(t => t.shots.length >= 2)
                                  .map(t => t.stats?.sizeInches || 0);
                                const totalShots = session.targets.reduce((sum, t) => sum + t.shots.length, 0);

                                // Calculate average POI across all targets in session
                                const targetPOIs = session.targets
                                  .filter(t => t.shots.length >= 2 && t.stats)
                                  .map(t => {
                                    const poiVertical = -t.stats.groupCenterYInches;
                                    const poiHorizontal = t.stats.groupCenterXInches;
                                    const distance = session.distance || 100;
                                    return {
                                      verticalInches: poiVertical,
                                      horizontalInches: poiHorizontal,
                                      verticalMOA: (poiVertical * 95.5) / distance,
                                      horizontalMOA: (poiHorizontal * 95.5) / distance,
                                      verticalMils: (poiVertical * 27.78) / distance,
                                      horizontalMils: (poiHorizontal * 27.78) / distance
                                    };
                                  });
                                const avgPOI = targetPOIs.length > 0
                                  ? {
                                      verticalInches: targetPOIs.reduce((sum, p) => sum + p.verticalInches, 0) / targetPOIs.length,
                                      horizontalInches: targetPOIs.reduce((sum, p) => sum + p.horizontalInches, 0) / targetPOIs.length,
                                      verticalMOA: targetPOIs.reduce((sum, p) => sum + p.verticalMOA, 0) / targetPOIs.length,
                                      horizontalMOA: targetPOIs.reduce((sum, p) => sum + p.horizontalMOA, 0) / targetPOIs.length,
                                      verticalMils: targetPOIs.reduce((sum, p) => sum + p.verticalMils, 0) / targetPOIs.length,
                                      horizontalMils: targetPOIs.reduce((sum, p) => sum + p.horizontalMils, 0) / targetPOIs.length
                                    }
                                  : null;

                                return (
                                  <tr
                                    key={session.id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                    onDoubleClick={() => setViewingSession(session)}
                                    title="Double-click to view details"
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{session.name}{session.silencer ? ' 🔇' : ''}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{session.date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{session.distance || 100} yds</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{totalShots}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                                      {Math.min(...session.targets.map(t => t.stats?.sizeInches || Infinity)).toFixed(3)}"
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                      {avgPOI ? (() => {
                                        let vVal, hVal, precision, unit;
                                        if (poiUnit === 'inches') {
                                          vVal = avgPOI.verticalInches;
                                          hVal = avgPOI.horizontalInches;
                                          precision = 3;
                                          unit = '"';
                                        } else if (poiUnit === 'moa') {
                                          vVal = avgPOI.verticalMOA;
                                          hVal = avgPOI.horizontalMOA;
                                          precision = 2;
                                          unit = '';
                                        } else {
                                          vVal = avgPOI.verticalMils;
                                          hVal = avgPOI.horizontalMils;
                                          precision = 2;
                                          unit = '';
                                        }
                                        return `↕${vVal >= 0 ? '+' : ''}${vVal.toFixed(precision)}${unit} / ↔${hVal >= 0 ? '+' : ''}${hVal.toFixed(precision)}${unit}`;
                                      })() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                      {session.chronoData ? `${session.chronoData.average.toFixed(0)} fps` : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                      <div className="flex items-center space-x-1">
                                        <button
                                          onClick={() => setViewingSession(session)}
                                          className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 p-1"
                                          title="View session details"
                                        >
                                          <FileText className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={async () => {
                                            if (window.confirm(`Delete session "${session.name}"? This cannot be undone.`)) {
                                              try {
                                                await deleteSession(user.uid, session.id);
                                                const updatedSessions = await getSessions(user.uid);
                                                setSessions(updatedSessions);
                                              } catch (error) {
                                                console.error('Error deleting session:', error);
                                                alert('Failed to delete session');
                                              }
                                            }
                                          }}
                                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                                          title="Delete session"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
                <BarChart3 className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-gray-600 dark:text-gray-300 mb-4">No sessions recorded yet</p>
                <button
                  onClick={() => setActiveTab('capture')}
                  className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Start First Session
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reloading Tab */}
        {activeTab === 'reloading' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <Wrench className="mr-3 h-7 w-7 text-purple-600 dark:text-purple-400" />
              Reloading Workbench
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Load Development & Brass Management */}
              <div className="lg:col-span-2 space-y-6">

                {/* Interactive Cartridge Diagram */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Ruler className="h-5 w-5 mr-2 text-purple-600" />
                    Cartridge Measurements Reference
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    {/* Light/Dark mode diagram images */}
                    <img
                      src={darkMode ? "/images/cartridge-diagram-dark.png" : "/images/cartridge-diagram-light.png"}
                      alt="Cartridge dimension reference diagram"
                      className="w-full h-auto"
                    />
                  </div>

                  {/* Measurement Legend - matching diagram labels */}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center"><span className="font-bold text-gray-700 dark:text-gray-300 mr-1">A</span> Overall Length</div>
                      <div className="flex items-center"><span className="font-bold text-gray-700 dark:text-gray-300 mr-1">B</span> Case Length</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center"><span className="font-bold text-gray-700 dark:text-gray-300 mr-1">C</span> Length to Neck</div>
                      <div className="flex items-center"><span className="font-bold text-gray-700 dark:text-gray-300 mr-1">D</span> Length to Shoulder</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center"><span className="font-bold text-gray-700 dark:text-gray-300 mr-1">E</span> Rim Diameter</div>
                      <div className="flex items-center"><span className="font-bold text-gray-700 dark:text-gray-300 mr-1">F</span> Rim Thickness</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center"><span className="font-bold text-gray-700 dark:text-gray-300 mr-1">G</span> Head Diameter</div>
                      <div className="flex items-center"><span className="font-bold text-gray-700 dark:text-gray-300 mr-1">H</span> Shoulder Diameter</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center"><span className="font-bold text-gray-700 dark:text-gray-300 mr-1">I</span> Neck Diameter</div>
                      <div className="flex items-center"><span className="font-bold text-gray-700 dark:text-gray-300 mr-1">J</span> Shoulder Angle</div>
                    </div>
                  </div>
                </div>

                {/* Load Development */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <FlaskConical className="h-5 w-5 mr-2 text-purple-600" />
                    Load Development
                  </h3>

                  {equipment.loads.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No loads created yet.</p>
                      <p className="text-sm">Add loads in the Equipment tab to start load development.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {equipment.loads.map((load, idx) => (
                        <div key={idx} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">{load.name}</h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {load.bullet} {load.bulletWeight} • {load.powder} {load.charge}
                              </p>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              load.bc && load.muzzleVelocity
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}>
                              {load.bc && load.muzzleVelocity ? 'Complete' : 'Needs Data'}
                            </span>
                          </div>

                          {/* Load specs grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                              <span className="text-gray-500 dark:text-gray-400 text-xs">OAL</span>
                              <p className="font-medium text-gray-900 dark:text-white">{load.oal || '—'}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                              <span className="text-gray-500 dark:text-gray-400 text-xs">CBTO</span>
                              <p className="font-medium text-gray-900 dark:text-white">{load.cbto || '—'}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                              <span className="text-gray-500 dark:text-gray-400 text-xs">Velocity</span>
                              <p className="font-medium text-gray-900 dark:text-white">{load.muzzleVelocity ? `${load.muzzleVelocity} fps` : '—'}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                              <span className="text-gray-500 dark:text-gray-400 text-xs">SD</span>
                              <p className="font-medium text-gray-900 dark:text-white">{load.velocitySD ? `${load.velocitySD} fps` : '—'}</p>
                            </div>
                          </div>

                          {/* Reloading measurements if available */}
                          {(load.caseLength || load.headspace || load.bulletJump) && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Reloading Specs</p>
                              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                                {load.caseLength && <div><span className="text-gray-400">Case:</span> {load.caseLength}</div>}
                                {load.headspace && <div><span className="text-gray-400">HS:</span> {load.headspace}</div>}
                                {load.shoulderBump && <div><span className="text-gray-400">Bump:</span> {load.shoulderBump}</div>}
                                {load.bulletJump && <div><span className="text-gray-400">Jump:</span> {load.bulletJump}</div>}
                                {load.neckTension && <div><span className="text-gray-400">Tension:</span> {load.neckTension}</div>}
                                {load.annealed && <div className="text-green-600">✓ Annealed</div>}
                              </div>
                            </div>
                          )}

                          {/* Missing data suggestions */}
                          {(!load.bc || !load.muzzleVelocity || !load.caseLength) && (
                            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-300">
                              <strong>Missing:</strong>{' '}
                              {!load.bc && 'BC, '}
                              {!load.muzzleVelocity && 'Muzzle Velocity, '}
                              {!load.caseLength && 'Case Length, '}
                              {!load.cbto && 'CBTO'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Brass Management */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <RotateCcw className="h-5 w-5 mr-2 text-purple-600" />
                    Brass Management
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Track your brass lots, firing counts, and annealing cycles.
                  </p>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                        <p className="text-3xl font-bold text-purple-600">{equipment.loads.filter(l => l.brass).length}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Brass Types</p>
                      </div>
                      <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                        <p className="text-3xl font-bold text-green-600">{equipment.loads.filter(l => l.annealed).length}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Annealed Loads</p>
                      </div>
                      <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                        <p className="text-3xl font-bold text-blue-600">{equipment.loads.filter(l => l.caseLength).length}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">With Case Data</p>
                      </div>
                    </div>
                  </div>

                  {/* Brass types used */}
                  {equipment.loads.filter(l => l.brass).length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Brass in Use:</p>
                      <div className="flex flex-wrap gap-2">
                        {[...new Set(equipment.loads.map(l => l.brass).filter(Boolean))].map((brass, i) => (
                          <span key={i} className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full text-sm">
                            {brass}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Product Recommendations */}
              <div className="space-y-6">
                {/* Recommended Equipment */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2 text-purple-600" />
                    Recommended Gear
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Based on your reloading setup
                  </p>

                  <div className="space-y-3">
                    {/* Dynamic recommendations based on missing data */}
                    {equipment.loads.some(l => !l.cbto) && (
                      <ProductCard
                        category="Measuring"
                        name="Bullet Comparator Set"
                        description="Measure CBTO accurately for consistent seating depth"
                        reason="You have loads without CBTO data"
                      />
                    )}

                    {equipment.loads.some(l => !l.muzzleVelocity) && (
                      <ProductCard
                        category="Chronograph"
                        name="LabRadar or MagnetoSpeed"
                        description="Measure muzzle velocity and SD for ballistic calculations"
                        reason="Velocity data needed for ballistics"
                      />
                    )}

                    {equipment.loads.some(l => !l.headspace) && (
                      <ProductCard
                        category="Measuring"
                        name="Headspace Gauge Set"
                        description="Measure shoulder bump and case headspace"
                        reason="Track headspace for brass life"
                      />
                    )}

                    {equipment.loads.some(l => !l.annealed) && (
                      <ProductCard
                        category="Brass Prep"
                        name="Annealing Machine"
                        description="Consistent neck tension and extended brass life"
                        reason="None of your loads use annealed brass"
                      />
                    )}

                    {/* General recommendations */}
                    <ProductCard
                      category="Dies"
                      name="Premium Bushing Dies"
                      description="Precise neck tension control for accuracy"
                      reason="Essential for precision reloading"
                    />

                    <ProductCard
                      category="Components"
                      name="Match Grade Primers"
                      description="Consistent ignition for low SD"
                      reason="Recommended for precision loads"
                    />
                  </div>
                </div>

                {/* Component Finder */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Package className="h-5 w-5 mr-2 text-purple-600" />
                    Components in Your Loads
                  </h3>

                  {equipment.loads.length > 0 ? (
                    <div className="space-y-3">
                      {/* Powders */}
                      {[...new Set(equipment.loads.map(l => l.powder).filter(Boolean))].length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Powders</p>
                          <div className="space-y-1">
                            {[...new Set(equipment.loads.map(l => l.powder).filter(Boolean))].map((powder, i) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                <span className="text-sm text-gray-900 dark:text-white">{powder}</span>
                                <button className="text-xs text-purple-600 hover:text-purple-700 flex items-center">
                                  Find in stock <ExternalLink className="h-3 w-3 ml-1" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Primers */}
                      {[...new Set(equipment.loads.map(l => l.primer).filter(Boolean))].length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Primers</p>
                          <div className="space-y-1">
                            {[...new Set(equipment.loads.map(l => l.primer).filter(Boolean))].map((primer, i) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                <span className="text-sm text-gray-900 dark:text-white">{primer}</span>
                                <button className="text-xs text-purple-600 hover:text-purple-700 flex items-center">
                                  Find in stock <ExternalLink className="h-3 w-3 ml-1" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bullets */}
                      {[...new Set(equipment.loads.map(l => l.bullet ? `${l.bulletWeight} ${l.bullet}` : null).filter(Boolean))].length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bullets</p>
                          <div className="space-y-1">
                            {[...new Set(equipment.loads.map(l => l.bullet ? `${l.bulletWeight} ${l.bullet}` : null).filter(Boolean))].map((bullet, i) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                <span className="text-sm text-gray-900 dark:text-white">{bullet}</span>
                                <button className="text-xs text-purple-600 hover:text-purple-700 flex items-center">
                                  Find in stock <ExternalLink className="h-3 w-3 ml-1" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Add loads to see your components here
                    </p>
                  )}
                </div>

                {/* Retailer Links */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Shop Partners</h3>
                  <div className="space-y-2">
                    {[
                      { name: 'MidwayUSA', url: '#' },
                      { name: 'Brownells', url: '#' },
                      { name: 'Primary Arms', url: '#' },
                      { name: 'Grafs', url: '#' },
                    ].map((retailer, i) => (
                      <a
                        key={i}
                        href={retailer.url}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{retailer.name}</span>
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    * Affiliate links help support PRS Analytics
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Equipment Tab */}
        {activeTab === 'equipment' && (
          <div className="space-y-6">
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-white`}>Equipment Management</h2>

            <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-6`}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rifles</h3>
                  <button
                    onClick={() => setShowAddRifle(true)}
                    className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Add Rifle
                  </button>
                </div>

                {equipment.rifles.length > 0 ? (
                  <div className="space-y-3">
                    {equipment.rifles.map((rifle, index) => (
                      <div key={index} className="border-l-4 border-purple-500 dark:border-purple-400 pl-4 py-2 flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{rifle.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{rifle.caliber} • {rifle.barrel} • {rifle.twist}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{rifle.scope}</p>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => {
                              setEditingRifle(rifle);
                              setNewRifle({
                                name: rifle.name || '',
                                caliber: rifle.caliber || '',
                                barrel: rifle.barrel || '',
                                twist: rifle.twist || '',
                                scope: rifle.scope || ''
                              });
                              setShowAddRifle(true);
                            }}
                            className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 p-1"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Delete rifle "${rifle.name}"? This cannot be undone.`)) {
                                try {
                                  await deleteRifle(user.uid, rifle.id);
                                  const updatedRifles = await getRifles(user.uid);
                                  setEquipment(prev => ({ ...prev, rifles: updatedRifles }));
                                } catch (error) {
                                  console.error('Error deleting rifle:', error);
                                  alert('Failed to delete rifle');
                                }
                              }
                            }}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No rifles added yet</p>
                )}
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Loads</h3>
                  <button
                    onClick={() => setShowAddLoad(true)}
                    className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Add Load
                  </button>
                </div>

                {equipment.loads.length > 0 ? (
                  <div className="space-y-3">
                    {equipment.loads.map((load, index) => (
                      <div key={index} className="border-l-4 border-green-500 dark:border-green-400 pl-4 py-2 flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{load.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{load.caliber} • {load.bulletWeight} {load.bullet}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{load.charge} {load.powder} • OAL: {load.oal}{load.cbto && ` • CBTO: ${load.cbto}`}</p>
                          {(load.bc || load.muzzleVelocity) && (
                            <p className="text-sm text-purple-600 dark:text-purple-400">
                              {load.bc && `BC: ${load.bc} ${load.bcType || 'G1'}`}
                              {load.bc && load.muzzleVelocity && ' • '}
                              {load.muzzleVelocity && `MV: ${load.muzzleVelocity} fps`}
                              {load.velocitySD && ` (SD: ${load.velocitySD})`}
                            </p>
                          )}
                          {(load.caseLength || load.headspace || load.bulletJump) && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {load.caseLength && `Case: ${load.caseLength}`}
                              {load.headspace && ` • HS: ${load.headspace}`}
                              {load.bulletJump && ` • Jump: ${load.bulletJump}`}
                              {load.annealed && ' • Annealed'}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => {
                              setEditingLoad(load);
                              setNewLoad({
                                name: load.name || '',
                                caliber: load.caliber || '',
                                bullet: load.bullet || '',
                                bulletWeight: load.bulletWeight || '',
                                powder: load.powder || '',
                                charge: load.charge || '',
                                primer: load.primer || '',
                                brass: load.brass || '',
                                oal: load.oal || '',
                                cbto: load.cbto || '',
                                bc: load.bc || '',
                                bcType: load.bcType || 'G1',
                                muzzleVelocity: load.muzzleVelocity || '',
                                velocitySD: load.velocitySD || '',
                                // Reloading measurements
                                caseLength: load.caseLength || '',
                                trimLength: load.trimLength || '',
                                headspace: load.headspace || '',
                                shoulderBump: load.shoulderBump || '',
                                neckDiameter: load.neckDiameter || '',
                                neckTension: load.neckTension || '',
                                bulletJump: load.bulletJump || '',
                                chamberOAL: load.chamberOAL || '',
                                baseDiameter: load.baseDiameter || '',
                                shoulderDiameter: load.shoulderDiameter || '',
                                primerDepth: load.primerDepth || '',
                                annealed: load.annealed || false
                              });
                              setShowAddLoad(true);
                            }}
                            className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 p-1"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Delete load "${load.name}"? This cannot be undone.`)) {
                                try {
                                  await deleteLoad(user.uid, load.id);
                                  const updatedLoads = await getLoads(user.uid);
                                  setEquipment(prev => ({ ...prev, loads: updatedLoads }));
                                } catch (error) {
                                  console.error('Error deleting load:', error);
                                  alert('Failed to delete load');
                                }
                              }
                            }}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No loads added yet</p>
                )}
              </div>
            </div>

            {/* iOS App Integration Info */}
            <div className="bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded-lg p-6">
              <div className="flex items-start">
                <Smartphone className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-3 mt-1" />
                <div>
                  <h3 className="font-medium text-purple-900 dark:text-purple-200 mb-2">iOS App Integration</h3>
                  <p className="text-sm text-purple-800 dark:text-purple-300 mb-3">
                    This app is ready for iOS integration with the following API endpoints:
                  </p>
                  <div className="bg-white dark:bg-gray-800 bg-opacity-50 rounded p-3 font-mono text-xs">
                    <p className="text-purple-700 dark:text-purple-400">POST /api/sessions - Save session data</p>
                    <p className="text-purple-700 dark:text-purple-400">GET /api/sessions - Load all sessions</p>
                    <p className="text-purple-700 dark:text-purple-400">POST /api/equipment - Save equipment</p>
                    <p className="text-purple-700 dark:text-purple-400">GET /api/equipment - Load equipment</p>
                    <p className="text-purple-700 dark:text-purple-400">GET /api/export?format=csv - Export data</p>
                  </div>
                  <p className="text-sm text-purple-800 dark:text-purple-300 mt-3">
                    All data is currently stored in-memory. Connect to a backend service for persistence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ballistics Tab */}
        {activeTab === 'ballistics' && (
          <BallisticsTab equipment={equipment} user={user} setEquipment={setEquipment} />
        )}

        {/* Add/Edit Rifle Modal */}
        {showAddRifle && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                {editingRifle ? 'Edit Rifle' : 'Add New Rifle'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Rifle Name*</label>
                  <input
                    type="text"
                    value={newRifle.name}
                    onChange={(e) => setNewRifle({...newRifle, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., Custom 6.5 Creedmoor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Caliber*</label>
                  <input
                    type="text"
                    value={newRifle.caliber}
                    onChange={(e) => setNewRifle({...newRifle, caliber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., 6.5 Creedmoor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Barrel Length</label>
                  <input
                    type="text"
                    value={newRifle.barrel}
                    onChange={(e) => setNewRifle({...newRifle, barrel: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., 26&quot;"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Twist Rate</label>
                  <input
                    type="text"
                    value={newRifle.twist}
                    onChange={(e) => setNewRifle({...newRifle, twist: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., 1:8"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Scope</label>
                  <input
                    type="text"
                    value={newRifle.scope}
                    onChange={(e) => setNewRifle({...newRifle, scope: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., Nightforce ATACR 5-25x56"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setShowAddRifle(false);
                    setEditingRifle(null);
                    setNewRifle({ name: '', caliber: '', barrel: '', twist: '', scope: '' });
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newRifle.name || !newRifle.caliber) {
                      alert('Please fill in required fields');
                      return;
                    }
                    try {
                      if (editingRifle) {
                        // Update existing rifle in Firestore
                        await updateRifle(user.uid, editingRifle.id, newRifle);

                        // Update local state
                        setEquipment(prev => ({
                          ...prev,
                          rifles: prev.rifles.map(r =>
                            r.id === editingRifle.id ? { ...r, ...newRifle } : r
                          )
                        }));
                      } else {
                        // Add new rifle to Firestore
                        const rifleId = await addRifle(user.uid, newRifle);

                        // Update local state
                        const rifleWithId = { id: rifleId, ...newRifle };
                        setEquipment(prev => ({
                          ...prev,
                          rifles: [...prev.rifles, rifleWithId]
                        }));
                      }

                      setShowAddRifle(false);
                      setEditingRifle(null);
                      setNewRifle({ name: '', caliber: '', barrel: '', twist: '', scope: '' });
                    } catch (error) {
                      console.error('Error saving rifle:', error);
                      alert('Failed to save rifle. Please try again.');
                    }
                  }}
                  className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                >
                  {editingRifle ? 'Save Changes' : 'Add Rifle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Load Modal */}
        {showAddLoad && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                {editingLoad ? 'Edit Load' : 'Add New Load'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Load Name*</label>
                  <input
                    type="text"
                    value={newLoad.name}
                    onChange={(e) => setNewLoad({...newLoad, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., 6.5CM - 140gr ELD-M"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Caliber*</label>
                  <input
                    type="text"
                    value={newLoad.caliber}
                    onChange={(e) => setNewLoad({...newLoad, caliber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., 6.5 Creedmoor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Bullet</label>
                  <input
                    type="text"
                    value={newLoad.bullet}
                    onChange={(e) => setNewLoad({...newLoad, bullet: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., Hornady ELD-M"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Bullet Weight</label>
                  <input
                    type="text"
                    value={newLoad.bulletWeight}
                    onChange={(e) => setNewLoad({...newLoad, bulletWeight: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., 140gr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Powder</label>
                  <input
                    type="text"
                    value={newLoad.powder}
                    onChange={(e) => setNewLoad({...newLoad, powder: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., H4350"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Charge Weight</label>
                  <input
                    type="text"
                    value={newLoad.charge}
                    onChange={(e) => setNewLoad({...newLoad, charge: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., 41.5gr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Primer</label>
                  <input
                    type="text"
                    value={newLoad.primer}
                    onChange={(e) => setNewLoad({...newLoad, primer: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., CCI BR-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Brass</label>
                  <input
                    type="text"
                    value={newLoad.brass}
                    onChange={(e) => setNewLoad({...newLoad, brass: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., Lapua"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">OAL</label>
                  <input
                    type="text"
                    value={newLoad.oal}
                    onChange={(e) => setNewLoad({...newLoad, oal: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., 2.800&quot;"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">CBTO</label>
                  <input
                    type="text"
                    value={newLoad.cbto}
                    onChange={(e) => setNewLoad({...newLoad, cbto: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder="e.g., 2.230&quot;"
                  />
                </div>

                {/* Ballistics Section */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Ballistics Data</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">BC</label>
                      <input
                        type="text"
                        value={newLoad.bc}
                        onChange={(e) => setNewLoad({...newLoad, bc: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="e.g., 0.585"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">BC Type</label>
                      <select
                        value={newLoad.bcType}
                        onChange={(e) => setNewLoad({...newLoad, bcType: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      >
                        <option value="G1">G1</option>
                        <option value="G7">G7</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Muzzle Velocity (fps)</label>
                      <input
                        type="text"
                        value={newLoad.muzzleVelocity}
                        onChange={(e) => setNewLoad({...newLoad, muzzleVelocity: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="e.g., 2750"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Velocity SD (fps)</label>
                      <input
                        type="text"
                        value={newLoad.velocitySD}
                        onChange={(e) => setNewLoad({...newLoad, velocitySD: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="e.g., 8"
                      />
                    </div>
                  </div>
                </div>

                {/* Reloading Data Section */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Reloading Measurements</h4>

                  {/* Cartridge Diagram */}
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <svg viewBox="0 0 400 120" className="w-full h-auto">
                      {/* Cartridge case outline */}
                      <defs>
                        <linearGradient id="brassGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#d4a84b" />
                          <stop offset="50%" stopColor="#c9a227" />
                          <stop offset="100%" stopColor="#b8941f" />
                        </linearGradient>
                        <linearGradient id="bulletGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#b87333" />
                          <stop offset="50%" stopColor="#a0522d" />
                          <stop offset="100%" stopColor="#8b4513" />
                        </linearGradient>
                      </defs>

                      {/* Case body */}
                      <path d="M 50 40 L 50 80 L 180 80 L 200 70 L 200 50 L 180 40 Z" fill="url(#brassGradient)" stroke="#8b7355" strokeWidth="1" />

                      {/* Case neck */}
                      <rect x="200" y="50" width="40" height="20" fill="url(#brassGradient)" stroke="#8b7355" strokeWidth="1" />

                      {/* Bullet */}
                      <path d="M 240 50 L 240 70 L 280 70 Q 320 60 320 60 Q 280 50 280 50 Z" fill="url(#bulletGradient)" stroke="#6b4423" strokeWidth="1" />

                      {/* Primer */}
                      <circle cx="50" cy="60" r="8" fill="#c0c0c0" stroke="#808080" strokeWidth="1" />

                      {/* Dimension lines and labels */}
                      {/* Case Length */}
                      <line x1="50" y1="95" x2="240" y2="95" stroke="#9333ea" strokeWidth="1" markerEnd="url(#arrowhead)" markerStart="url(#arrowhead)" />
                      <text x="145" y="108" textAnchor="middle" className="text-xs fill-purple-600 dark:fill-purple-400" fontSize="8">Case Length</text>

                      {/* OAL */}
                      <line x1="50" y1="25" x2="320" y2="25" stroke="#22c55e" strokeWidth="1" />
                      <text x="185" y="18" textAnchor="middle" className="text-xs fill-green-600 dark:fill-green-400" fontSize="8">OAL (Overall Length)</text>

                      {/* CBTO */}
                      <line x1="50" y1="35" x2="280" y2="35" stroke="#3b82f6" strokeWidth="1" />
                      <text x="165" y="32" textAnchor="middle" className="text-xs fill-blue-600 dark:fill-blue-400" fontSize="8">CBTO (Base to Ogive)</text>

                      {/* Headspace datum */}
                      <line x1="180" y1="40" x2="180" y2="80" stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" />
                      <text x="175" y="88" textAnchor="middle" className="text-xs fill-red-500" fontSize="6">Datum</text>

                      {/* Labels on diagram */}
                      <text x="115" y="63" textAnchor="middle" className="text-xs fill-gray-700 dark:fill-gray-300" fontSize="7">Body</text>
                      <text x="220" y="63" textAnchor="middle" className="text-xs fill-gray-700 dark:fill-gray-300" fontSize="7">Neck</text>
                      <text x="290" y="63" textAnchor="middle" className="text-xs fill-gray-700 dark:fill-gray-300" fontSize="7">Bullet</text>
                      <text x="50" y="63" textAnchor="middle" className="text-xs fill-gray-500" fontSize="6">Primer</text>
                      <text x="190" y="48" textAnchor="middle" className="text-xs fill-gray-500" fontSize="6">Shoulder</text>
                    </svg>
                  </div>

                  {/* Case Measurements */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Case Length</label>
                      <input
                        type="text"
                        value={newLoad.caseLength}
                        onChange={(e) => setNewLoad({...newLoad, caseLength: e.target.value})}
                        placeholder="e.g., 1.920&quot;"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Trim Length</label>
                      <input
                        type="text"
                        value={newLoad.trimLength}
                        onChange={(e) => setNewLoad({...newLoad, trimLength: e.target.value})}
                        placeholder="e.g., 1.910&quot;"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Headspace</label>
                      <input
                        type="text"
                        value={newLoad.headspace}
                        onChange={(e) => setNewLoad({...newLoad, headspace: e.target.value})}
                        placeholder="e.g., 1.542&quot;"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Shoulder Bump</label>
                      <input
                        type="text"
                        value={newLoad.shoulderBump}
                        onChange={(e) => setNewLoad({...newLoad, shoulderBump: e.target.value})}
                        placeholder="e.g., 0.002&quot;"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Neck Diameter</label>
                      <input
                        type="text"
                        value={newLoad.neckDiameter}
                        onChange={(e) => setNewLoad({...newLoad, neckDiameter: e.target.value})}
                        placeholder="e.g., 0.290&quot;"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Neck Tension</label>
                      <input
                        type="text"
                        value={newLoad.neckTension}
                        onChange={(e) => setNewLoad({...newLoad, neckTension: e.target.value})}
                        placeholder="e.g., 0.002&quot;"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Bullet Jump</label>
                      <input
                        type="text"
                        value={newLoad.bulletJump}
                        onChange={(e) => setNewLoad({...newLoad, bulletJump: e.target.value})}
                        placeholder="e.g., 0.020&quot;"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Chamber OAL</label>
                      <input
                        type="text"
                        value={newLoad.chamberOAL}
                        onChange={(e) => setNewLoad({...newLoad, chamberOAL: e.target.value})}
                        placeholder="Max OAL to lands"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Primer Depth</label>
                      <input
                        type="text"
                        value={newLoad.primerDepth}
                        onChange={(e) => setNewLoad({...newLoad, primerDepth: e.target.value})}
                        placeholder="e.g., 0.004&quot;"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Base Diameter</label>
                      <input
                        type="text"
                        value={newLoad.baseDiameter}
                        onChange={(e) => setNewLoad({...newLoad, baseDiameter: e.target.value})}
                        placeholder="e.g., 0.470&quot;"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Shoulder Dia.</label>
                      <input
                        type="text"
                        value={newLoad.shoulderDiameter}
                        onChange={(e) => setNewLoad({...newLoad, shoulderDiameter: e.target.value})}
                        placeholder="e.g., 0.454&quot;"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={newLoad.annealed}
                          onChange={(e) => setNewLoad({...newLoad, annealed: e.target.checked})}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span>Brass Annealed</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setShowAddLoad(false);
                    setEditingLoad(null);
                    setNewLoad({
                      name: '', caliber: '', bullet: '', bulletWeight: '',
                      powder: '', charge: '', primer: '', brass: '', oal: '', cbto: '',
                      bc: '', bcType: 'G1', muzzleVelocity: '', velocitySD: '',
                      caseLength: '', trimLength: '', headspace: '', shoulderBump: '',
                      neckDiameter: '', neckTension: '', bulletJump: '', chamberOAL: '',
                      baseDiameter: '', shoulderDiameter: '', primerDepth: '', annealed: false
                    });
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newLoad.name || !newLoad.caliber) {
                      alert('Please fill in required fields');
                      return;
                    }
                    try {
                      if (editingLoad) {
                        // Update existing load in Firestore
                        await updateLoad(user.uid, editingLoad.id, newLoad);

                        // Update local state
                        setEquipment(prev => ({
                          ...prev,
                          loads: prev.loads.map(l =>
                            l.id === editingLoad.id ? { ...l, ...newLoad } : l
                          )
                        }));
                      } else {
                        // Add new load to Firestore
                        const loadId = await addLoad(user.uid, newLoad);

                        // Update local state
                        const loadWithId = { id: loadId, ...newLoad };
                        setEquipment(prev => ({
                          ...prev,
                          loads: [...prev.loads, loadWithId]
                        }));
                      }

                      setShowAddLoad(false);
                      setEditingLoad(null);
                      setNewLoad({
                        name: '', caliber: '', bullet: '', bulletWeight: '',
                        powder: '', charge: '', primer: '', brass: '', oal: '', cbto: '',
                        bc: '', bcType: 'G1', muzzleVelocity: '', velocitySD: '',
                        caseLength: '', trimLength: '', headspace: '', shoulderBump: '',
                        neckDiameter: '', neckTension: '', bulletJump: '', chamberOAL: '',
                        baseDiameter: '', shoulderDiameter: '', primerDepth: '', annealed: false
                      });
                    } catch (error) {
                      console.error('Error saving load:', error);
                      alert('Failed to save load. Please try again.');
                    }
                  }}
                  className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                >
                  {editingLoad ? 'Save Changes' : 'Add Load'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Session Detail Modal */}
        {viewingSession && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{viewingSession.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {viewingSession.date} • {viewingSession.rifle} • {viewingSession.load}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {viewingSession.distance || 100} yds{viewingSession.silencer ? ' • Suppressed' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setViewingSession(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Environmental Conditions */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Conditions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Temp:</span>
                    <span className="ml-1 text-gray-900 dark:text-white">{viewingSession.temperature || 'N/A'}°F</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Humidity:</span>
                    <span className="ml-1 text-gray-900 dark:text-white">{viewingSession.humidity || 'N/A'}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Wind:</span>
                    <span className="ml-1 text-gray-900 dark:text-white">{viewingSession.windSpeed || 0} mph @ {viewingSession.windDirection || '12'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Pressure:</span>
                    <span className="ml-1 text-gray-900 dark:text-white">{viewingSession.pressure || 'N/A'} inHg</span>
                  </div>
                </div>
                {viewingSession.chronoData && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Chronograph Data</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Avg:</span>
                        <span className="ml-1 text-gray-900 dark:text-white">{viewingSession.chronoData.average?.toFixed(0)} fps</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">ES:</span>
                        <span className="ml-1 text-gray-900 dark:text-white">{viewingSession.chronoData.es?.toFixed(0)} fps</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">SD:</span>
                        <span className="ml-1 text-gray-900 dark:text-white">{viewingSession.chronoData.sd?.toFixed(1)} fps</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Shots:</span>
                        <span className="ml-1 text-gray-900 dark:text-white">{viewingSession.chronoData.shots?.length || 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Target Statistics */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Target Statistics</h4>
                <div className="space-y-4">
                  {viewingSession.targets.map((target, index) => {
                    const stats = target.stats || {};
                    const distance = viewingSession.distance || 100;

                    // Convert to MOA
                    const groupSizeMOA = stats.sizeInches ? (stats.sizeInches * 95.5) / distance : 0;
                    const meanRadiusMOA = stats.meanRadiusInches ? (stats.meanRadiusInches * 95.5) / distance : 0;
                    const stdDevMOA = stats.standardDevInches ? (stats.standardDevInches * 95.5) / distance : 0;

                    const isPlotExpanded = expandedTargetPlots[`${viewingSession.id}-${index}`] !== false; // Default to expanded
                    const plotKey = `${viewingSession.id}-${index}`;

                    return (
                      <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h5 className="font-medium text-gray-900 dark:text-white">Target {index + 1}</h5>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">{target.shots?.length || 0} shots</span>
                            {target.shots?.length >= 2 && (
                              <button
                                onClick={() => setExpandedTargetPlots(prev => ({
                                  ...prev,
                                  [plotKey]: !isPlotExpanded
                                }))}
                                className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm font-medium"
                              >
                                {isPlotExpanded ? '▼ Hide Plot' : '▶ Show Plot'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expandable Shot Plot */}
                        {isPlotExpanded && target.shots?.length >= 2 && (
                          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex justify-center">
                              <svg width="200" height="200" className="bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                                {/* Grid lines */}
                                <line x1="100" y1="0" x2="100" y2="200" stroke="#e5e7eb" strokeWidth="1" className="dark:stroke-gray-600" />
                                <line x1="0" y1="100" x2="200" y2="100" stroke="#e5e7eb" strokeWidth="1" className="dark:stroke-gray-600" />
                                <circle cx="100" cy="100" r="30" fill="none" stroke="#e5e7eb" strokeWidth="1" className="dark:stroke-gray-600" />
                                <circle cx="100" cy="100" r="60" fill="none" stroke="#e5e7eb" strokeWidth="1" className="dark:stroke-gray-600" />
                                <circle cx="100" cy="100" r="90" fill="none" stroke="#e5e7eb" strokeWidth="1" className="dark:stroke-gray-600" />

                                {/* Target center crosshair */}
                                <line x1="95" y1="100" x2="105" y2="100" stroke="#9ca3af" strokeWidth="2" />
                                <line x1="100" y1="95" x2="100" y2="105" stroke="#9ca3af" strokeWidth="2" />

                                {/* Shot markers - scale to fit in 180px with max at edges */}
                                {(() => {
                                  const shots = target.shots || [];
                                  if (shots.length === 0) return null;

                                  // Calculate shot positions relative to target center
                                  const centerX = target.adjustedX ?? target.x;
                                  const centerY = target.adjustedY ?? target.y;
                                  const ppi = target.pixelsPerInch || 1;

                                  const shotPositions = shots.map(shot => ({
                                    xInches: (shot.x - centerX) / ppi,
                                    yInches: (shot.y - centerY) / ppi
                                  }));

                                  // Find max extent for scaling
                                  const maxExtent = Math.max(
                                    ...shotPositions.map(s => Math.abs(s.xInches)),
                                    ...shotPositions.map(s => Math.abs(s.yInches)),
                                    0.5 // Minimum scale
                                  );

                                  const scale = 80 / maxExtent; // 80px from center to edge

                                  // Group center
                                  const gcX = stats.groupCenterXInches || 0;
                                  const gcY = stats.groupCenterYInches || 0;

                                  return (
                                    <>
                                      {/* Group center marker */}
                                      <circle
                                        cx={100 + gcX * scale}
                                        cy={100 + gcY * scale}
                                        r="4"
                                        fill="none"
                                        stroke="#9333ea"
                                        strokeWidth="2"
                                      />

                                      {/* Mean radius circle */}
                                      {stats.meanRadiusInches && (
                                        <circle
                                          cx={100 + gcX * scale}
                                          cy={100 + gcY * scale}
                                          r={stats.meanRadiusInches * scale}
                                          fill="none"
                                          stroke="#9333ea"
                                          strokeWidth="1"
                                          strokeDasharray="4,4"
                                          opacity="0.5"
                                        />
                                      )}

                                      {/* Shot markers */}
                                      {shotPositions.map((shot, i) => (
                                        <circle
                                          key={i}
                                          cx={100 + shot.xInches * scale}
                                          cy={100 + shot.yInches * scale}
                                          r="4"
                                          fill="#ef4444"
                                          stroke="#b91c1c"
                                          strokeWidth="1"
                                        />
                                      ))}
                                    </>
                                  );
                                })()}
                              </svg>
                            </div>
                            <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                              Red dots = shots • Purple circle = group center • Dashed = mean radius
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">Group Size</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.sizeInches?.toFixed(3) || 'N/A'}"</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{groupSizeMOA.toFixed(2)} MOA</p>
                          </div>
                          <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded">
                            <p className="text-purple-600 dark:text-purple-400 text-xs uppercase">Mean Radius</p>
                            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{stats.meanRadiusInches?.toFixed(3) || 'N/A'}"</p>
                            <p className="text-xs text-purple-500 dark:text-purple-400">{meanRadiusMOA.toFixed(2)} MOA</p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">Std Dev</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.standardDevInches?.toFixed(3) || 'N/A'}"</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{stdDevMOA.toFixed(2)} MOA</p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">POI Offset</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              ↕{stats.groupCenterYInches ? (stats.groupCenterYInches >= 0 ? '+' : '') + (-stats.groupCenterYInches).toFixed(3) : 'N/A'}"
                            </p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              ↔{stats.groupCenterXInches ? (stats.groupCenterXInches >= 0 ? '+' : '') + stats.groupCenterXInches.toFixed(3) : 'N/A'}"
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Session Summary */}
                {viewingSession.targets.length > 1 && (
                  <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-3">Session Summary</h4>
                    {(() => {
                      const validTargets = viewingSession.targets.filter(t => t.stats && t.shots?.length >= 2);
                      if (validTargets.length === 0) return <p className="text-sm text-gray-500">No valid targets</p>;

                      const avgGroupSize = validTargets.reduce((sum, t) => sum + (t.stats.sizeInches || 0), 0) / validTargets.length;
                      const avgMeanRadius = validTargets.reduce((sum, t) => sum + (t.stats.meanRadiusInches || 0), 0) / validTargets.length;
                      const avgStdDev = validTargets.reduce((sum, t) => sum + (t.stats.standardDevInches || 0), 0) / validTargets.length;
                      const bestGroup = Math.min(...validTargets.map(t => t.stats.sizeInches || Infinity));
                      const distance = viewingSession.distance || 100;

                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-purple-600 dark:text-purple-400 text-xs uppercase">Avg Group</p>
                            <p className="font-bold text-purple-900 dark:text-purple-100">{avgGroupSize.toFixed(3)}"</p>
                            <p className="text-xs text-purple-500">{((avgGroupSize * 95.5) / distance).toFixed(2)} MOA</p>
                          </div>
                          <div>
                            <p className="text-purple-600 dark:text-purple-400 text-xs uppercase">Avg Mean Radius</p>
                            <p className="font-bold text-purple-900 dark:text-purple-100">{avgMeanRadius.toFixed(3)}"</p>
                            <p className="text-xs text-purple-500">{((avgMeanRadius * 95.5) / distance).toFixed(2)} MOA</p>
                          </div>
                          <div>
                            <p className="text-purple-600 dark:text-purple-400 text-xs uppercase">Avg Std Dev</p>
                            <p className="font-bold text-purple-900 dark:text-purple-100">{avgStdDev.toFixed(3)}"</p>
                            <p className="text-xs text-purple-500">{((avgStdDev * 95.5) / distance).toFixed(2)} MOA</p>
                          </div>
                          <div>
                            <p className="text-purple-600 dark:text-purple-400 text-xs uppercase">Best Group</p>
                            <p className="font-bold text-purple-900 dark:text-purple-100">{bestGroup.toFixed(3)}"</p>
                            <p className="text-xs text-purple-500">{((bestGroup * 95.5) / distance).toFixed(2)} MOA</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => exportSessionToExcel(viewingSession)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export to Excel
                </button>
                <button
                  onClick={() => setViewingSession(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chrono Import Modal */}
        {showChronoImport && <ChronoImportModal />}
      </main>
    </div>
  );
};

export default CompletePRSApp;