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
  Clock, File, Smartphone
} from 'lucide-react';

const CompletePRSApp = () => {
  // State management - using in-memory storage with persistence structure
  const [activeTab, setActiveTab] = useState('home');
  const [sessions, setSessions] = useState([]);
  const [equipment, setEquipment] = useState({ rifles: [], loads: [] });
  
  // Capture state
  const [captureStep, setCaptureStep] = useState('upload');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [targetDiameter, setTargetDiameter] = useState('');
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [currentEditingTarget, setCurrentEditingTarget] = useState(null);

  // Manual selection mode state
  const [selectionMode, setSelectionMode] = useState('auto'); // 'auto' or 'manual'
  const [manualSelectionStep, setManualSelectionStep] = useState(0); // 0: waiting, 1: center clicked, 2: edge clicked
  const [manualCenter, setManualCenter] = useState(null);
  const [manualEdge, setManualEdge] = useState(null);
  const [sessionData, setSessionData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    rifle: '',
    load: '',
    distance: 100,
    temperature: 70,
    humidity: 50,
    windSpeed: 5,
    windDirection: '12',
    pressure: 29.92,
    chronoData: null
  });
  
  // Analytics filters
  const [analyticsFilters, setAnalyticsFilters] = useState({
    rifle: 'all',
    load: 'all',
    session: 'all'
  });
  
  // Equipment form state
  const [showAddRifle, setShowAddRifle] = useState(false);
  const [showAddLoad, setShowAddLoad] = useState(false);
  const [newRifle, setNewRifle] = useState({ name: '', caliber: '', barrel: '', twist: '', scope: '' });
  const [newLoad, setNewLoad] = useState({
    name: '', caliber: '', bullet: '', bulletWeight: '',
    powder: '', charge: '', primer: '', brass: '', oal: '', cbto: ''
  });
  
  // Statistical comparison state
  const [comparisonType, setComparisonType] = useState('loads');
  const [comparisonA, setComparisonA] = useState('');
  const [comparisonB, setComparisonB] = useState('');
  const [showStatistics, setShowStatistics] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  
  // Chrono data state
  const [showChronoImport, setShowChronoImport] = useState(false);
  const [chronoString, setChronoString] = useState('');
  
  // Mobile optimization state
  const [isMobile, setIsMobile] = useState(false);
  
  const fileInputRef = useRef(null);
  const chronoFileRef = useRef(null);

  // Check for mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Data persistence endpoints (placeholder for iOS app integration)
  const dataEndpoints = {
    saveSession: async (session) => {
      // POST /api/sessions
      console.log('Saving session:', session);
      return { success: true, id: session.id };
    },
    loadSessions: async () => {
      // GET /api/sessions
      console.log('Loading sessions');
      return { sessions: [] };
    },
    saveEquipment: async (equipment) => {
      // POST /api/equipment
      console.log('Saving equipment:', equipment);
      return { success: true };
    },
    loadEquipment: async () => {
      // GET /api/equipment
      console.log('Loading equipment');
      return { rifles: [], loads: [] };
    },
    exportData: async (format) => {
      // GET /api/export?format=csv
      console.log('Exporting data:', format);
      return { url: '' };
    }
  };

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

  // Statistical t-test function
  const performTTest = (group1, group2, paired = false) => {
    if (group1.length === 0 || group2.length === 0) {
      return null;
    }
    
    const mean1 = group1.reduce((sum, x) => sum + x, 0) / group1.length;
    const mean2 = group2.reduce((sum, x) => sum + x, 0) / group2.length;
    
    if (paired && group1.length !== group2.length) {
      return null;
    }
    
    let tStat, df, pValue;
    
    if (paired) {
      const differences = group1.map((x, i) => x - group2[i]);
      const meanDiff = differences.reduce((sum, d) => sum + d, 0) / differences.length;
      const variance = differences.reduce((sum, d) => sum + Math.pow(d - meanDiff, 2), 0) / (differences.length - 1);
      const stdError = Math.sqrt(variance / differences.length);
      tStat = meanDiff / stdError;
      df = differences.length - 1;
    } else {
      const var1 = group1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (group1.length - 1);
      const var2 = group2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (group2.length - 1);
      const pooledSE = Math.sqrt(var1 / group1.length + var2 / group2.length);
      tStat = (mean1 - mean2) / pooledSE;
      df = group1.length + group2.length - 2;
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
      n2: group2.length
    };
  };

  // Get comparison data
  const getComparisonData = () => {
    const groupsByLoad = {};
    const groupsByRifle = {};
    const groupsBySession = {};
    
    sessions.forEach(session => {
      session.targets.forEach(target => {
        if (target.shots.length >= 2) {
          const stats = target.stats || calculateGroupStats(target.shots, target.x, target.y, target.pixelsPerInch);
          
          if (!groupsByLoad[session.load]) groupsByLoad[session.load] = [];
          groupsByLoad[session.load].push(stats.sizeInches);
          
          if (!groupsByRifle[session.rifle]) groupsByRifle[session.rifle] = [];
          groupsByRifle[session.rifle].push(stats.sizeInches);
          
          if (!groupsBySession[session.id]) groupsBySession[session.id] = { name: session.name, groups: [] };
          groupsBySession[session.id].groups.push(stats.sizeInches);
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

  // Handle target selection click (auto and manual modes)
  const handleTargetClick = (e) => {
    if (!targetDiameter || parseFloat(targetDiameter) <= 0) {
      alert('Please enter the target diameter first');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = rect.naturalWidth ? rect.naturalWidth / rect.width : 1;
    const scaleY = rect.naturalHeight ? rect.naturalHeight / rect.height : 1;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // MANUAL MODE: Two-click selection
    if (selectionMode === 'manual') {
      const img = new Image();
      img.onload = () => {
        const adjustedClickX = (e.clientX - rect.left) * (img.width / rect.width);
        const adjustedClickY = (e.clientY - rect.top) * (img.height / rect.height);

        if (manualSelectionStep === 0) {
          // First click: Set center
          setManualCenter({ x: adjustedClickX, y: adjustedClickY });
          setManualSelectionStep(1);
        } else if (manualSelectionStep === 1) {
          // Second click: Set radius and create target
          const radius = Math.sqrt(
            Math.pow(adjustedClickX - manualCenter.x, 2) +
            Math.pow(adjustedClickY - manualCenter.y, 2)
          );

          const pixelsPerInch = (radius * 2) / parseFloat(targetDiameter);

          const newTarget = {
            id: Date.now(),
            x: manualCenter.x,
            y: manualCenter.y,
            radius: radius,
            diameterInches: parseFloat(targetDiameter),
            pixelsPerInch: pixelsPerInch,
            shots: [],
            imageWidth: img.width,
            imageHeight: img.height,
            adjustedX: null,
            adjustedY: null,
            adjustedRadius: null,
            confidence: 1.0, // Manual selection = perfect confidence
            detectionStdDev: 0,
            sampleCount: 2,
            manualSelection: true
          };

          setSelectedTargets(prev => [...prev, newTarget]);

          // Reset manual selection
          setManualSelectionStep(0);
          setManualCenter(null);
          setManualEdge(null);
        }
      };
      img.src = uploadedImage;
      return;
    }

    // AUTO MODE: AI detection
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const adjustedClickX = (e.clientX - rect.left) * (img.width / rect.width);
      const adjustedClickY = (e.clientY - rect.top) * (img.height / rect.height);

      // Try orange first, then fallback to other colors
      let detectionResult = findOrangeCircle(adjustedClickX, adjustedClickY, imageData, img.width, img.height, 'orange');

      if (!detectionResult) {
        detectionResult = findOrangeCircle(adjustedClickX, adjustedClickY, imageData, img.width, img.height, 'red');
      }

      if (!detectionResult) {
        detectionResult = findOrangeCircle(adjustedClickX, adjustedClickY, imageData, img.width, img.height, 'black');
      }

      if (!detectionResult) {
        const tryManual = window.confirm(
          'No target detected at this location.\n\n' +
          'Would you like to switch to Manual Mode?\n\n' +
          'In Manual Mode:\n' +
          '• Click 1: Center of target\n' +
          '• Click 2: Edge of target\n\n' +
          'This gives you perfect control!'
        );
        if (tryManual) {
          setSelectionMode('manual');
        }
        return;
      }

      // Show confidence warning for low-quality detections
      if (detectionResult.confidence < 0.5) {
        const proceed = window.confirm(
          `Target detected with LOW confidence (${(detectionResult.confidence * 100).toFixed(0)}%).\n\n` +
          `This may indicate:\n` +
          `• Poor lighting or shadows\n` +
          `• Target is damaged or faded\n` +
          `• Non-circular target shape\n\n` +
          `Options:\n` +
          `• OK = Use this detection (you can adjust later)\n` +
          `• Cancel = Switch to Manual Mode for perfect selection`
        );
        if (!proceed) {
          setSelectionMode('manual');
          return;
        }
      }

      const detectedRadius = detectionResult.radius;
      const pixelsPerInch = (detectedRadius * 2) / parseFloat(targetDiameter);

      const newTarget = {
        id: Date.now(),
        x: adjustedClickX,
        y: adjustedClickY,
        radius: detectedRadius,
        diameterInches: parseFloat(targetDiameter),
        pixelsPerInch: pixelsPerInch,
        shots: [],
        imageWidth: img.width,
        imageHeight: img.height,
        adjustedX: null,
        adjustedY: null,
        adjustedRadius: null,
        confidence: detectionResult.confidence,
        detectionStdDev: detectionResult.stdDev,
        sampleCount: detectionResult.sampleCount,
        manualSelection: false
      };

      setSelectedTargets(prev => [...prev, newTarget]);

      if (detectionResult.confidence >= 0.8) {
        console.log(`Target detected with high confidence: ${(detectionResult.confidence * 100).toFixed(0)}%`);
      }
    };

    img.src = uploadedImage;
  };

  // Calculate group statistics
  const calculateGroupStats = (shots, centerX, centerY, pixelsPerInch) => {
    if (shots.length === 0) return {
      size: 0,
      sizeInches: 0,
      meanRadius: 0,
      meanRadiusInches: 0,
      standardDev: 0,
      standardDevInches: 0,
      shotsRelativeToCenter: []
    };
    
    const shotsRelativeToCenter = shots.map(shot => ({
      x: shot.x - centerX,
      y: shot.y - centerY,
      xInches: (shot.x - centerX) / pixelsPerInch,
      yInches: (shot.y - centerY) / pixelsPerInch,
      radius: Math.sqrt(Math.pow(shot.x - centerX, 2) + Math.pow(shot.y - centerY, 2)),
      radiusInches: Math.sqrt(Math.pow(shot.x - centerX, 2) + Math.pow(shot.y - centerY, 2)) / pixelsPerInch
    }));
    
    const meanRadius = shotsRelativeToCenter.reduce((sum, shot) => sum + shot.radius, 0) / shots.length;
    const meanRadiusInches = meanRadius / pixelsPerInch;
    
    const variance = shotsRelativeToCenter.reduce((sum, shot) => 
      sum + Math.pow(shot.radius - meanRadius, 2), 0) / shots.length;
    const standardDev = Math.sqrt(variance);
    const standardDevInches = standardDev / pixelsPerInch;
    
    let maxDistance = 0;
    for (let i = 0; i < shots.length; i++) {
      for (let j = i + 1; j < shots.length; j++) {
        const dx = shots[i].x - shots[j].x;
        const dy = shots[i].y - shots[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        maxDistance = Math.max(maxDistance, distance);
      }
    }
    
    const groupCenterX = shots.reduce((sum, shot) => sum + shot.x, 0) / shots.length;
    const groupCenterY = shots.reduce((sum, shot) => sum + shot.y, 0) / shots.length;
    
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
    
    const newSession = {
      id: Date.now(),
      ...sessionData,
      targets: targetsWithStats,
      image: uploadedImage
    };
    
    setSessions(prev => [...prev, newSession]);
    
    // Call save endpoint
    await dataEndpoints.saveSession(newSession);
    
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
      windSpeed: 5,
      windDirection: '12',
      pressure: 29.92,
      chronoData: null
    });
    
    setActiveTab('analytics');
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
      filteredSessions = filteredSessions.filter(s => s.id === parseInt(analyticsFilters.session));
    }
    
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
        
        targetStats.push({
          sessionId: session.id,
          sessionName: session.name,
          date: session.date,
          rifle: session.rifle,
          load: session.load,
          targetIndex: targetIndex + 1,
          shots: target.shots.length,
          groupSize: stats.sizeInches,
          meanRadius: stats.meanRadiusInches,
          standardDev: stats.standardDevInches,
          groupCenterX: stats.groupCenterXInches,
          groupCenterY: stats.groupCenterYInches,
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
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className={`flex justify-between items-center ${isMobile ? 'h-14' : 'h-16'}`}>
          <div className="flex items-center space-x-2">
            <Target className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-blue-600`} />
            <h1 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900`}>PRS Precision</h1>
          </div>
          <nav className={`flex ${isMobile ? 'space-x-2' : 'space-x-8'}`}>
            {[
              { id: 'home', label: 'Home', icon: Home },
              { id: 'capture', label: 'Capture', icon: Camera },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'equipment', label: 'Equipment', icon: Settings }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center ${isMobile ? 'space-x-1 px-2 py-1' : 'space-x-2 px-3 py-2'} rounded-md ${isMobile ? 'text-xs' : 'text-sm'} font-medium transition-colors ${
                  activeTab === id 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
                {!isMobile && <span>{label}</span>}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );

  // Chrono Import Modal
  const ChronoImportModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Import Chronograph Data</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste velocity readings (fps)
            </label>
            <textarea
              value={chronoString}
              onChange={(e) => setChronoString(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md h-32"
              placeholder="Enter velocities separated by commas, spaces, or new lines&#10;Example:&#10;2850, 2847, 2852, 2849, 2851"
            />
          </div>
          
          <div className="text-center text-gray-500 text-sm">OR</div>
          
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <File className="inline h-4 w-4 mr-2" />
              Import from File
            </button>
          </div>
          
          {chronoString && (() => {
            const parsed = parseChronoData(chronoString);
            return parsed ? (
              <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                <p className="font-medium mb-2">Preview:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
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
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );

  // Initialize some sample data
  useEffect(() => {
    if (equipment.rifles.length === 0) {
      setEquipment({
        rifles: [
          { name: 'Custom 6.5 Creedmoor', caliber: '6.5 Creedmoor', barrel: '26"', twist: '1:8', scope: 'Nightforce ATACR 5-25x56' },
          { name: 'Remington 700 .308', caliber: '.308 Winchester', barrel: '24"', twist: '1:10', scope: 'Vortex Razor HD 4.5-27x56' }
        ],
        loads: [
          { name: '6.5CM - 140gr ELD-M', caliber: '6.5 Creedmoor', bullet: 'Hornady ELD-M', bulletWeight: '140gr', powder: 'H4350', charge: '41.5gr', primer: 'CCI BR-2', brass: 'Lapua', oal: '2.800"', cbto: '2.230"' },
          { name: '.308 - 175gr SMK', caliber: '.308 Winchester', bullet: 'Sierra MatchKing', bulletWeight: '175gr', powder: 'Varget', charge: '44.0gr', primer: 'Federal 210M', brass: 'Lapua', oal: '2.810"', cbto: '2.240"' }
        ]
      });
    }
  }, [equipment.rifles.length]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className={`max-w-7xl mx-auto ${isMobile ? 'px-2 py-4' : 'px-4 py-8'}`}>
        {/* Home Tab */}
        {activeTab === 'home' && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-8 text-white">
              <h2 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold mb-4`}>Precision Rifle Shooting Analytics</h2>
              <p className={`${isMobile ? 'text-lg' : 'text-xl'} mb-6 text-blue-100`}>
                Upload target photos and track your shooting performance with precise measurements.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setActiveTab('capture')}
                  className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                >
                  Start New Session
                </button>
                <div className="flex items-center text-blue-100 text-sm">
                  <Smartphone className="h-4 w-4 mr-2" />
                  <span>iOS App Ready</span>
                </div>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${isMobile ? 'gap-4' : 'md:grid-cols-3 gap-6'}`}>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-4">
                  <Target className="h-8 w-8 text-blue-600 mr-3" />
                  <h3 className="text-lg font-semibold">Total Sessions</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{sessions.length}</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-4">
                  <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
                  <h3 className="text-lg font-semibold">Best Group</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {sessions.length > 0 
                    ? Math.min(...sessions.flatMap(s => s.targets.map(t => t.stats?.sizeInches || Infinity))).toFixed(2) + '"'
                    : 'N/A'}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-4">
                  <Award className="h-8 w-8 text-yellow-600 mr-3" />
                  <h3 className="text-lg font-semibold">Rifles Tracked</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{equipment.rifles.length}</p>
              </div>
            </div>

            {sessions.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Sessions</h3>
                <div className="space-y-3">
                  {sessions.slice(-3).reverse().map(session => (
                    <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{session.name}</p>
                        <p className="text-sm text-gray-600">{session.date} • {session.rifle}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">{session.targets.length} targets</p>
                        <p className="text-sm font-medium">
                          Best: {Math.min(...session.targets.map(t => t.stats?.sizeInches || Infinity)).toFixed(2)}"
                        </p>
                        {session.chronoData && (
                          <p className="text-xs text-gray-500">
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
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className={`flex items-center ${isMobile ? 'justify-center overflow-x-auto' : 'justify-between'}`}>
                {['upload', 'setup', 'select-targets', 'mark-shots', 'review'].map((step, index) => (
                  <div key={step} className="flex items-center">
                    <div className={`flex items-center justify-center ${isMobile ? 'w-7 h-7' : 'w-8 h-8'} rounded-full ${
                      captureStep === step 
                        ? 'bg-blue-600 text-white' 
                        : index < ['upload', 'setup', 'select-targets', 'mark-shots', 'review'].indexOf(captureStep)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                    }`}>
                      {index < ['upload', 'setup', 'select-targets', 'mark-shots', 'review'].indexOf(captureStep) 
                        ? <CheckCircle className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                        : index + 1
                      }
                    </div>
                    {index < 4 && (
                      <ChevronRight className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-gray-400 mx-2`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {captureStep === 'upload' && (
              <div className="max-w-2xl mx-auto">
                <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 mb-6 text-center`}>Upload Target Photo</h2>
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                  <Upload className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-6">Upload a photo of your targets</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Choose Image
                  </button>
                  <p className="text-sm text-gray-500 mt-4">
                    For best results, use a clear photo with orange target stickers visible
                  </p>
                </div>
              </div>
            )}

            {captureStep === 'setup' && uploadedImage && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Session Setup</h3>
                  <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-4`}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Session Name*</label>
                      <input
                        type="text"
                        value={sessionData.name}
                        onChange={(e) => setSessionData({...sessionData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Range Day - Load Testing"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Diameter (inches)*</label>
                      <input
                        type="number"
                        step="0.1"
                        value={targetDiameter}
                        onChange={(e) => setTargetDiameter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 1.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rifle*</label>
                      <select
                        value={sessionData.rifle}
                        onChange={(e) => setSessionData({...sessionData, rifle: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select rifle</option>
                        {equipment.rifles.map(rifle => (
                          <option key={rifle.name} value={rifle.name}>{rifle.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Load*</label>
                      <select
                        value={sessionData.load}
                        onChange={(e) => setSessionData({...sessionData, load: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select load</option>
                        {equipment.loads.map(load => (
                          <option key={load.name} value={load.name}>{load.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Distance (yards)</label>
                      <input
                        type="number"
                        value={sessionData.distance}
                        onChange={(e) => setSessionData({...sessionData, distance: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={sessionData.date}
                        onChange={(e) => setSessionData({...sessionData, date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">Chronograph Data</h4>
                        {sessionData.chronoData ? (
                          <p className="text-sm text-blue-700 mt-1">
                            {sessionData.chronoData.count} shots • Avg: {sessionData.chronoData.average.toFixed(0)} fps • ES: {sessionData.chronoData.es.toFixed(0)} fps
                          </p>
                        ) : (
                          <p className="text-sm text-blue-700 mt-1">No chrono data imported</p>
                        )}
                      </div>
                      <button
                        onClick={() => setShowChronoImport(true)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        {sessionData.chronoData ? 'Update' : 'Import'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Environmental Conditions</h4>
                    <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4`}>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          <Thermometer className="inline h-3 w-3 mr-1" />
                          Temperature (°F)
                        </label>
                        <input
                          type="number"
                          value={sessionData.temperature}
                          onChange={(e) => setSessionData({...sessionData, temperature: parseInt(e.target.value) || 0})}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          <Droplets className="inline h-3 w-3 mr-1" />
                          Humidity (%)
                        </label>
                        <input
                          type="number"
                          value={sessionData.humidity}
                          onChange={(e) => setSessionData({...sessionData, humidity: parseInt(e.target.value) || 0})}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          <Wind className="inline h-3 w-3 mr-1" />
                          Wind Speed (mph)
                        </label>
                        <input
                          type="number"
                          value={sessionData.windSpeed}
                          onChange={(e) => setSessionData({...sessionData, windSpeed: parseInt(e.target.value) || 0})}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Wind Direction</label>
                        <select
                          value={sessionData.windDirection}
                          onChange={(e) => setSessionData({...sessionData, windDirection: e.target.value})}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
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
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        if (!sessionData.name || !targetDiameter || !sessionData.rifle || !sessionData.load) {
                          alert('Please fill in all required fields');
                          return;
                        }
                        setCaptureStep('select-targets');
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Continue to Target Selection
                    </button>
                  </div>
                </div>
              </div>
            )}

            {captureStep === 'select-targets' && uploadedImage && (
              <div className="space-y-6">
                {/* Mode Selection and Instructions */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-blue-900 mb-1">
                        {selectionMode === 'auto' ? '🤖 Auto Detection Mode' : '✋ Manual Selection Mode'}
                      </h3>
                      {selectionMode === 'auto' ? (
                        <p className="text-sm text-blue-800">
                          Click on the center of each target. AI will detect the boundary automatically.
                        </p>
                      ) : (
                        <div className="text-sm text-purple-800 space-y-1">
                          <p className="font-medium">
                            {manualSelectionStep === 0 && '📍 Step 1: Click the CENTER of the target'}
                            {manualSelectionStep === 1 && '⭕ Step 2: Click the EDGE of the target'}
                          </p>
                          <p className="text-xs">Perfect for damaged, faded, or non-standard targets</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectionMode(selectionMode === 'auto' ? 'manual' : 'auto');
                        setManualSelectionStep(0);
                        setManualCenter(null);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        selectionMode === 'manual'
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {selectionMode === 'auto' ? 'Switch to Manual' : 'Switch to Auto'}
                    </button>
                  </div>

                  {selectionMode === 'manual' && manualSelectionStep === 1 && (
                    <div className="mt-2 p-2 bg-purple-100 rounded text-xs text-purple-900">
                      ✓ Center set! Now click anywhere on the target edge to set the radius.
                    </div>
                  )}
                </div>

                <div className="relative bg-white rounded-lg shadow-sm overflow-hidden">
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
                    {/* Show manual selection center point */}
                    {selectionMode === 'manual' && manualCenter && uploadedImage && (() => {
                      const img = new Image();
                      img.src = uploadedImage;
                      const scaleX = 100 / img.width;
                      const scaleY = 100 / img.height;
                      return (
                        <g>
                          {/* Center crosshair */}
                          <circle
                            cx={`${manualCenter.x * scaleX}%`}
                            cy={`${manualCenter.y * scaleY}%`}
                            r="1"
                            fill="#8b5cf6"
                            opacity="0.8"
                          />
                          <line
                            x1={`${(manualCenter.x - 20) * scaleX}%`}
                            y1={`${manualCenter.y * scaleY}%`}
                            x2={`${(manualCenter.x + 20) * scaleX}%`}
                            y2={`${manualCenter.y * scaleY}%`}
                            stroke="#8b5cf6"
                            strokeWidth="0.3"
                          />
                          <line
                            x1={`${manualCenter.x * scaleX}%`}
                            y1={`${(manualCenter.y - 20) * scaleY}%`}
                            x2={`${manualCenter.x * scaleX}%`}
                            y2={`${(manualCenter.y + 20) * scaleY}%`}
                            stroke="#8b5cf6"
                            strokeWidth="0.3"
                          />
                        </g>
                      );
                    })()}

                    {selectedTargets.map((target, index) => {
                      const scaleX = 100 / target.imageWidth;
                      const scaleY = 100 / target.imageHeight;

                      // Manual selections = purple, Auto = confidence-based colors
                      const isManual = target.manualSelection;
                      const confidence = target.confidence || 1.0;
                      let confidenceColor = isManual ? "#8b5cf6" : "#22c55e"; // Purple for manual, green for auto
                      if (!isManual) {
                        if (confidence < 0.7) confidenceColor = "#eab308"; // Yellow (medium)
                        if (confidence < 0.5) confidenceColor = "#ef4444"; // Red (low)
                      }

                      return (
                        <g key={target.id}>
                          {/* Target boundary with confidence/manual color */}
                          <circle
                            cx={`${(target.adjustedX ?? target.x) * scaleX}%`}
                            cy={`${(target.adjustedY ?? target.y) * scaleY}%`}
                            r={`${(target.adjustedRadius || target.radius) * scaleX}%`}
                            fill="none"
                            stroke={confidenceColor}
                            strokeWidth={isManual ? "0.5" : "0.4"}
                            strokeDasharray={isManual ? "2,1" : "none"}
                          />
                          {/* Search area indicator */}
                          {!isManual && (
                            <circle
                              cx={`${(target.adjustedX ?? target.x) * scaleX}%`}
                              cy={`${(target.adjustedY ?? target.y) * scaleY}%`}
                              r={`${(target.adjustedRadius || target.radius) * 3 * scaleX}%`}
                              fill="none"
                              stroke="#94a3b8"
                              strokeWidth="0.15"
                              strokeDasharray="1,1"
                              opacity="0.5"
                            />
                          )}
                          {/* Target label */}
                          <text
                            x={`${(target.adjustedX ?? target.x) * scaleX}%`}
                            y={`${((target.adjustedY ?? target.y) - (target.adjustedRadius || target.radius) * 3 - 10) * scaleY}%`}
                            fill={confidenceColor}
                            fontSize={isMobile ? "1.5" : "2"}
                            textAnchor="middle"
                            fontWeight="bold"
                          >
                            Target {index + 1}
                          </text>
                          {/* Manual/Confidence indicator badge */}
                          {(isManual || confidence < 0.8) && (
                            <g>
                              <rect
                                x={`${((target.adjustedX ?? target.x) + (target.adjustedRadius || target.radius) * 1.2) * scaleX}%`}
                                y={`${((target.adjustedY ?? target.y) - (target.adjustedRadius || target.radius) * 0.5) * scaleY}%`}
                                width={isMobile ? "3" : "4"}
                                height={isMobile ? "1.8" : "2.2"}
                                fill={confidenceColor}
                                opacity="0.9"
                                rx="0.3"
                              />
                              <text
                                x={`${((target.adjustedX ?? target.x) + (target.adjustedRadius || target.radius) * 1.2 + 15) * scaleX}%`}
                                y={`${((target.adjustedY ?? target.y) - (target.adjustedRadius || target.radius) * 0.5 + 15) * scaleY}%`}
                                fill="white"
                                fontSize={isMobile ? "1.0" : "1.3"}
                                textAnchor="middle"
                                fontWeight="bold"
                              >
                                {isManual ? 'MANUAL' : `${(confidence * 100).toFixed(0)}%`}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Detection Quality Legend */}
                {selectedTargets.length > 0 && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs font-medium text-blue-900 mb-2">Target Indicators:</p>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-purple-600 mr-1.5"></div>
                        <span className="text-gray-700 font-medium">Manual (Perfect)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-1.5"></div>
                        <span className="text-gray-700">Auto High (80%+)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 mr-1.5"></div>
                        <span className="text-gray-700">Auto Med (50-80%)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-1.5"></div>
                        <span className="text-gray-700">Auto Low (&lt;50%)</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      💡 Tip: Use Manual Mode for faded, damaged, or difficult targets. You can also adjust any target in the next step.
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {selectedTargets.length} target{selectedTargets.length !== 1 ? 's' : ''} selected
                  </div>
                  <div className={`${isMobile ? 'flex flex-col gap-2' : 'space-x-4'}`}>
                    <button
                      onClick={() => setCaptureStep('setup')}
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
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
                      className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Undo Last
                    </button>
                    <button
                      onClick={() => {
                        setCurrentEditingTarget(selectedTargets[0]);
                        setCaptureStep('mark-shots');
                      }}
                      disabled={selectedTargets.length === 0}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      Continue to Shot Marking
                    </button>
                  </div>
                </div>
              </div>
            )}

            {captureStep === 'mark-shots' && selectedTargets.length > 0 && (
              <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-900 mb-2">Mark Shot Holes</h3>
                  <p className="text-sm text-yellow-800">
                    Click on each shot hole. The system will automatically calculate group size and statistics.
                  </p>
                </div>

                <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-2'} gap-6`}>
                  {selectedTargets.map((target, index) => {
                    const currentX = target.adjustedX ?? target.x;
                    const currentY = target.adjustedY ?? target.y;
                    const currentRadius = target.adjustedRadius || target.radius;
                    const cropSize = currentRadius * 6;
                    const cropX = currentX - currentRadius * 3;
                    const cropY = currentY - currentRadius * 3;
                    
                    return (
                      <div key={target.id} className="bg-white rounded-lg shadow-sm p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">Target {index + 1}</h4>
                            {/* Confidence badge */}
                            {target.confidence !== undefined && (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  target.confidence >= 0.8
                                    ? 'bg-green-100 text-green-800'
                                    : target.confidence >= 0.5
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                                title="Detection confidence - how accurately the target boundary was detected"
                              >
                                {(target.confidence * 100).toFixed(0)}% confidence
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {(target.adjustedX !== null || target.adjustedY !== null || target.adjustedRadius !== null) && (
                              <span className="text-xs text-orange-600">Adjusted</span>
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
                              className="text-gray-600 hover:text-gray-700 text-xs"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                        
                        <div className="mb-3 space-y-2">
                          {/* Position adjustment controls */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Position Adjustment</span>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => {
                                  setSelectedTargets(prev => prev.map(t => 
                                    t.id === target.id 
                                      ? { ...t, adjustedY: currentY - 5 }
                                      : t
                                  ));
                                }}
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center"
                                title="Move up"
                              >
                                ↑
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => {
                                  setSelectedTargets(prev => prev.map(t => 
                                    t.id === target.id 
                                      ? { ...t, adjustedX: currentX - 5 }
                                      : t
                                  ));
                                }}
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center"
                                title="Move left"
                              >
                                ←
                              </button>
                              <div className="w-16 text-center">
                                <span className="text-xs text-gray-500">
                                  {currentX.toFixed(0)}, {currentY.toFixed(0)}
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedTargets(prev => prev.map(t => 
                                    t.id === target.id 
                                      ? { ...t, adjustedX: currentX + 5 }
                                      : t
                                  ));
                                }}
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center"
                                title="Move right"
                              >
                                →
                              </button>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedTargets(prev => prev.map(t => 
                                  t.id === target.id 
                                    ? { ...t, adjustedY: currentY + 5 }
                                    : t
                                ));
                              }}
                              className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center"
                              title="Move down"
                            >
                              ↓
                            </button>
                          </div>
                          
                          {/* Size adjustment controls */}
                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-xs text-gray-600">Size: {currentRadius.toFixed(1)}px</span>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  const newRadius = currentRadius * 0.95;
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
                                }}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                              >
                                -5%
                              </button>
                              <button
                                onClick={() => {
                                  const newRadius = currentRadius * 1.05;
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
                                }}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                              >
                                +5%
                              </button>
                              <button
                                onClick={() => {
                                  const adjustment = prompt(
                                    `Current radius: ${currentRadius.toFixed(1)}px\nEnter new radius in pixels:`,
                                    currentRadius.toFixed(1)
                                  );
                                  if (adjustment && !isNaN(parseFloat(adjustment))) {
                                    const newRadius = parseFloat(adjustment);
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
                                }}
                                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs"
                              >
                                Manual
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div 
                          className="relative bg-gray-100 rounded-lg overflow-hidden mb-4 cursor-crosshair"
                          style={{ paddingBottom: '100%' }}
                          onClick={(e) => {
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
                                maxWidth: 'none'
                              }}
                            />
                            
                            <svg 
                              className="absolute inset-0 w-full h-full pointer-events-none"
                              viewBox={`0 0 ${cropSize} ${cropSize}`}
                            >
                              {/* Target circle */}
                              <circle
                                cx={currentRadius * 3}
                                cy={currentRadius * 3}
                                r={currentRadius}
                                fill="none"
                                stroke="#22c55e"
                                strokeWidth="2"
                              />
                              
                              {/* Original detected circle for reference when adjusted */}
                              {(target.adjustedRadius || target.adjustedX !== null || target.adjustedY !== null) && (
                                <circle
                                  cx={currentRadius * 3 + (target.x - currentX)}
                                  cy={currentRadius * 3 + (target.y - currentY)}
                                  r={target.radius}
                                  fill="none"
                                  stroke="#94a3b8"
                                  strokeWidth="1"
                                  strokeDasharray="4,4"
                                  opacity="0.5"
                                />
                              )}
                              
                              {/* Crosshair lines */}
                              <line
                                x1={currentRadius * 3}
                                y1={0}
                                x2={currentRadius * 3}
                                y2={cropSize}
                                stroke="#22c55e"
                                strokeWidth="0.5"
                                strokeDasharray="2,2"
                                opacity="0.5"
                              />
                              <line
                                x1={0}
                                y1={currentRadius * 3}
                                x2={cropSize}
                                y2={currentRadius * 3}
                                stroke="#22c55e"
                                strokeWidth="0.5"
                                strokeDasharray="2,2"
                                opacity="0.5"
                              />
                              
                              {/* Shot markers */}
                              {target.shots.map((shot, shotIndex) => {
                                const shotDisplayX = shot.x - cropX;
                                const shotDisplayY = shot.y - cropY;
                                
                                if (shotDisplayX >= 0 && shotDisplayX <= cropSize && 
                                    shotDisplayY >= 0 && shotDisplayY <= cropSize) {
                                  return (
                                    <g key={shot.id}>
                                      <circle
                                        cx={shotDisplayX}
                                        cy={shotDisplayY}
                                        r="8"
                                        fill="#ef4444"
                                        stroke="#dc2626"
                                        strokeWidth="1"
                                      />
                                      <text
                                        x={shotDisplayX}
                                        y={shotDisplayY + 3}
                                        fill="white"
                                        fontSize="12"
                                        textAnchor="middle"
                                        fontWeight="bold"
                                      >
                                        {shotIndex + 1}
                                      </text>
                                    </g>
                                  );
                                }
                                return null;
                              })}
                            </svg>
                          </div>
                        </div>
                        
                        <div className="text-sm space-y-1">
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
                        
                        {target.shots.length > 0 && (
                          <button
                            onClick={() => {
                              setSelectedTargets(prev => prev.map(t => 
                                t.id === target.id 
                                  ? { ...t, shots: t.shots.slice(0, -1) }
                                  : t
                              ));
                            }}
                            className="mt-2 text-sm text-red-600 hover:text-red-700"
                          >
                            Remove last shot
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setCaptureStep('select-targets')}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setCaptureStep('review')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    Review Session
                  </button>
                </div>
              </div>
            )}

            {captureStep === 'review' && (
              <div className="space-y-6">
                <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>Session Review</h2>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Session Details</h3>
                  <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4 text-sm`}>
                    <div>
                      <p className="text-gray-600">Session Name</p>
                      <p className="font-medium">{sessionData.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Date</p>
                      <p className="font-medium">{sessionData.date}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Rifle</p>
                      <p className="font-medium">{sessionData.rifle}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Load</p>
                      <p className="font-medium">{sessionData.load}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Distance</p>
                      <p className="font-medium">{sessionData.distance} yards</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Temperature</p>
                      <p className="font-medium">{sessionData.temperature}°F</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Wind</p>
                      <p className="font-medium">{sessionData.windSpeed} mph @ {sessionData.windDirection} o'clock</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Humidity</p>
                      <p className="font-medium">{sessionData.humidity}%</p>
                    </div>
                  </div>
                  
                  {sessionData.chronoData && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Chronograph Data</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Shots</p>
                          <p className="font-medium">{sessionData.chronoData.count}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Average</p>
                          <p className="font-medium">{sessionData.chronoData.average.toFixed(0)} fps</p>
                        </div>
                        <div>
                          <p className="text-gray-600">ES</p>
                          <p className="font-medium">{sessionData.chronoData.es.toFixed(0)} fps</p>
                        </div>
                        <div>
                          <p className="text-gray-600">SD</p>
                          <p className="font-medium">{sessionData.chronoData.sd.toFixed(1)} fps</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold mb-4">Target Summary</h3>
                  <div className="space-y-4">
                    {selectedTargets.map((target, index) => {
                      const finalX = target.adjustedX ?? target.x;
                      const finalY = target.adjustedY ?? target.y;
                      const stats = calculateGroupStats(target.shots, finalX, finalY, target.pixelsPerInch);
                      
                      return (
                        <div key={target.id} className="border-l-4 border-blue-500 pl-4">
                          <h4 className="font-medium">Target {index + 1}</h4>
                          <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4 mt-2 text-sm`}>
                            <div>
                              <p className="text-gray-600">Shots</p>
                              <p className="font-medium">{target.shots.length}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Group Size</p>
                              <p className="font-medium">{stats.sizeInches.toFixed(3)}"</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Mean Radius</p>
                              <p className="font-medium">{stats.meanRadiusInches.toFixed(3)}"</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Std Dev</p>
                              <p className="font-medium">{stats.standardDevInches.toFixed(3)}"</p>
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
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={saveSession}
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
              <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>Performance Analytics</h2>
              <button
                onClick={exportToCSV}
                className={`bg-green-600 hover:bg-green-700 text-white ${isMobile ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'} rounded-lg font-medium transition-colors flex items-center`}
                disabled={sessions.length === 0}
              >
                <Download className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} mr-2`} />
                Export CSV
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Filters</h3>
              <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-3'} gap-4`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rifle</label>
                  <select
                    value={analyticsFilters.rifle}
                    onChange={(e) => setAnalyticsFilters({...analyticsFilters, rifle: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">All Rifles</option>
                    {equipment.rifles.map(rifle => (
                      <option key={rifle.name} value={rifle.name}>{rifle.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Load</label>
                  <select
                    value={analyticsFilters.load}
                    onChange={(e) => setAnalyticsFilters({...analyticsFilters, load: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">All Loads</option>
                    {equipment.loads.map(load => (
                      <option key={load.name} value={load.name}>{load.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
                  <select
                    value={analyticsFilters.session}
                    onChange={(e) => setAnalyticsFilters({...analyticsFilters, session: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">All Sessions</option>
                    {sessions.map(session => (
                      <option key={session.id} value={session.id}>{session.name} - {session.date}</option>
                    ))}
                  </select>
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
                        <div className="bg-white rounded-lg shadow-sm p-6">
                          <div className="flex items-center mb-2">
                            <FileText className="h-5 w-5 text-blue-600 mr-2" />
                            <p className="text-sm text-gray-600">Sessions</p>
                          </div>
                          <p className="text-2xl font-bold">{report.aggregateStats.totalSessions}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm p-6">
                          <div className="flex items-center mb-2">
                            <Target className="h-5 w-5 text-green-600 mr-2" />
                            <p className="text-sm text-gray-600">Total Shots</p>
                          </div>
                          <p className="text-2xl font-bold">{report.aggregateStats.totalShots}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm p-6">
                          <div className="flex items-center mb-2">
                            <TrendingUp className="h-5 w-5 text-yellow-600 mr-2" />
                            <p className="text-sm text-gray-600">Avg Group</p>
                          </div>
                          <p className="text-2xl font-bold">{report.aggregateStats.avgGroupSize.toFixed(3)}"</p>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm p-6">
                          <div className="flex items-center mb-2">
                            <Award className="h-5 w-5 text-purple-600 mr-2" />
                            <p className="text-sm text-gray-600">Best Group</p>
                          </div>
                          <p className="text-2xl font-bold">{report.aggregateStats.bestGroup.toFixed(3)}"</p>
                        </div>
                      </div>

                      {/* Group Details Toggle */}
                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold">Group Details</h3>
                          <button
                            onClick={() => setShowGroupDetails(!showGroupDetails)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            {showGroupDetails ? 'Hide Details' : 'Show Details'}
                          </button>
                        </div>
                        
                        {showGroupDetails && (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rifle</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Load</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shots</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Group Size</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mean Radius</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Velocity</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {report.targetStats.map((stat, index) => (
                                  <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-900">{stat.sessionName}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{stat.date}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{stat.rifle}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{stat.load}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{stat.targetIndex}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{stat.shots}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.groupSize.toFixed(3)}"</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{stat.meanRadius.toFixed(3)}"</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
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
                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold mb-4">Statistical Comparison</h3>
                        
                        <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-3'} gap-4 mb-4`}>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Compare By</label>
                            <select
                              value={comparisonType}
                              onChange={(e) => {
                                setComparisonType(e.target.value);
                                setComparisonA('');
                                setComparisonB('');
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="loads">Loads</option>
                              <option value="rifles">Rifles</option>
                              <option value="sessions">Sessions</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Group A</label>
                            <select
                              value={comparisonA}
                              onChange={(e) => setComparisonA(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Group B</label>
                            <select
                              value={comparisonB}
                              onChange={(e) => setComparisonB(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          Run Comparison
                        </button>
                        
                        {showStatistics && comparisonA && comparisonB && (() => {
                          let groupA, groupB;
                          
                          if (comparisonType === 'loads') {
                            groupA = comparisonData.groupsByLoad[comparisonA];
                            groupB = comparisonData.groupsByLoad[comparisonB];
                          } else if (comparisonType === 'rifles') {
                            groupA = comparisonData.groupsByRifle[comparisonA];
                            groupB = comparisonData.groupsByRifle[comparisonB];
                          } else {
                            groupA = comparisonData.groupsBySession[comparisonA].groups;
                            groupB = comparisonData.groupsBySession[comparisonB].groups;
                          }
                          
                          const result = performTTest(groupA, groupB);
                          
                          if (!result) {
                            return (
                              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-800">Unable to perform comparison. Ensure both groups have data.</p>
                              </div>
                            );
                          }
                          
                          return (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                              <h4 className="font-semibold mb-3">T-Test Results (Independent Samples)</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-gray-600">Group A Mean</p>
                                  <p className="font-medium">{result.mean1}" (n={result.n1})</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600">Group B Mean</p>
                                  <p className="font-medium">{result.mean2}" (n={result.n2})</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600">T-Statistic</p>
                                  <p className="font-medium">{result.tStat}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600">Degrees of Freedom</p>
                                  <p className="font-medium">{result.df}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-sm text-gray-600">Statistical Significance (α = 0.05)</p>
                                  <p className={`font-medium ${result.significant ? 'text-green-600' : 'text-gray-600'}`}>
                                    {result.significant 
                                      ? 'Statistically significant difference (p < 0.05)' 
                                      : 'No statistically significant difference (p > 0.05)'}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-sm text-gray-600">Interpretation</p>
                                  <p className="text-sm">
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

                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold mb-4">Session Summary</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rifle</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Load</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Targets</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Best Group</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Group</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Velocity</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {report.filteredSessions.map(session => {
                                const sessionGroups = session.targets
                                  .filter(t => t.shots.length >= 2)
                                  .map(t => t.stats?.sizeInches || 0);
                                const avgGroup = sessionGroups.length > 0
                                  ? sessionGroups.reduce((a, b) => a + b, 0) / sessionGroups.length
                                  : 0;
                                  
                                return (
                                  <tr key={session.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{session.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{session.date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{session.rifle}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{session.load}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{session.targets.length}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                      {Math.min(...session.targets.map(t => t.stats?.sizeInches || Infinity)).toFixed(3)}"
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {avgGroup.toFixed(3)}"
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {session.chronoData ? `${session.chronoData.average.toFixed(0)} fps` : 'N/A'}
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
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <BarChart3 className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-4">No sessions recorded yet</p>
                <button
                  onClick={() => setActiveTab('capture')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Start First Session
                </button>
              </div>
            )}
          </div>
        )}

        {/* Equipment Tab */}
        {activeTab === 'equipment' && (
          <div className="space-y-6">
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900`}>Equipment Management</h2>
            
            <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-6`}>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Rifles</h3>
                  <button
                    onClick={() => setShowAddRifle(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Add Rifle
                  </button>
                </div>
                
                {equipment.rifles.length > 0 ? (
                  <div className="space-y-3">
                    {equipment.rifles.map((rifle, index) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                        <p className="font-medium">{rifle.name}</p>
                        <p className="text-sm text-gray-600">{rifle.caliber} • {rifle.barrel} • {rifle.twist}</p>
                        <p className="text-sm text-gray-500">{rifle.scope}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No rifles added yet</p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Loads</h3>
                  <button
                    onClick={() => setShowAddLoad(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Add Load
                  </button>
                </div>
                
                {equipment.loads.length > 0 ? (
                  <div className="space-y-3">
                    {equipment.loads.map((load, index) => (
                      <div key={index} className="border-l-4 border-green-500 pl-4 py-2">
                        <p className="font-medium">{load.name}</p>
                        <p className="text-sm text-gray-600">{load.caliber} • {load.bulletWeight} {load.bullet}</p>
                        <p className="text-sm text-gray-500">{load.charge} {load.powder} • OAL: {load.oal}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No loads added yet</p>
                )}
              </div>
            </div>

            {/* iOS App Integration Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start">
                <Smartphone className="h-6 w-6 text-blue-600 mr-3 mt-1" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-2">iOS App Integration</h3>
                  <p className="text-sm text-blue-800 mb-3">
                    This app is ready for iOS integration with the following API endpoints:
                  </p>
                  <div className="bg-white bg-opacity-50 rounded p-3 font-mono text-xs">
                    <p className="text-blue-700">POST /api/sessions - Save session data</p>
                    <p className="text-blue-700">GET /api/sessions - Load all sessions</p>
                    <p className="text-blue-700">POST /api/equipment - Save equipment</p>
                    <p className="text-blue-700">GET /api/equipment - Load equipment</p>
                    <p className="text-blue-700">GET /api/export?format=csv - Export data</p>
                  </div>
                  <p className="text-sm text-blue-800 mt-3">
                    All data is currently stored in-memory. Connect to a backend service for persistence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Rifle Modal */}
        {showAddRifle && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Add New Rifle</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rifle Name*</label>
                  <input
                    type="text"
                    value={newRifle.name}
                    onChange={(e) => setNewRifle({...newRifle, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Custom 6.5 Creedmoor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Caliber*</label>
                  <input
                    type="text"
                    value={newRifle.caliber}
                    onChange={(e) => setNewRifle({...newRifle, caliber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 6.5 Creedmoor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barrel Length</label>
                  <input
                    type="text"
                    value={newRifle.barrel}
                    onChange={(e) => setNewRifle({...newRifle, barrel: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 26&quot;"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Twist Rate</label>
                  <input
                    type="text"
                    value={newRifle.twist}
                    onChange={(e) => setNewRifle({...newRifle, twist: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 1:8"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                  <input
                    type="text"
                    value={newRifle.scope}
                    onChange={(e) => setNewRifle({...newRifle, scope: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Nightforce ATACR 5-25x56"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setShowAddRifle(false);
                    setNewRifle({ name: '', caliber: '', barrel: '', twist: '', scope: '' });
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newRifle.name || !newRifle.caliber) {
                      alert('Please fill in required fields');
                      return;
                    }
                    const updatedEquipment = {
                      ...equipment,
                      rifles: [...equipment.rifles, newRifle]
                    };
                    setEquipment(updatedEquipment);
                    await dataEndpoints.saveEquipment(updatedEquipment);
                    setShowAddRifle(false);
                    setNewRifle({ name: '', caliber: '', barrel: '', twist: '', scope: '' });
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Add Rifle
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Load Modal */}
        {showAddLoad && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Add New Load</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Load Name*</label>
                  <input
                    type="text"
                    value={newLoad.name}
                    onChange={(e) => setNewLoad({...newLoad, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 6.5CM - 140gr ELD-M"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Caliber*</label>
                  <input
                    type="text"
                    value={newLoad.caliber}
                    onChange={(e) => setNewLoad({...newLoad, caliber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 6.5 Creedmoor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bullet</label>
                  <input
                    type="text"
                    value={newLoad.bullet}
                    onChange={(e) => setNewLoad({...newLoad, bullet: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Hornady ELD-M"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bullet Weight</label>
                  <input
                    type="text"
                    value={newLoad.bulletWeight}
                    onChange={(e) => setNewLoad({...newLoad, bulletWeight: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 140gr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Powder</label>
                  <input
                    type="text"
                    value={newLoad.powder}
                    onChange={(e) => setNewLoad({...newLoad, powder: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., H4350"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Charge Weight</label>
                  <input
                    type="text"
                    value={newLoad.charge}
                    onChange={(e) => setNewLoad({...newLoad, charge: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 41.5gr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primer</label>
                  <input
                    type="text"
                    value={newLoad.primer}
                    onChange={(e) => setNewLoad({...newLoad, primer: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., CCI BR-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brass</label>
                  <input
                    type="text"
                    value={newLoad.brass}
                    onChange={(e) => setNewLoad({...newLoad, brass: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Lapua"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OAL</label>
                  <input
                    type="text"
                    value={newLoad.oal}
                    onChange={(e) => setNewLoad({...newLoad, oal: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 2.800&quot;"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CBTO</label>
                  <input
                    type="text"
                    value={newLoad.cbto}
                    onChange={(e) => setNewLoad({...newLoad, cbto: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 2.230&quot;"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setShowAddLoad(false);
                    setNewLoad({
                      name: '', caliber: '', bullet: '', bulletWeight: '',
                      powder: '', charge: '', primer: '', brass: '', oal: '', cbto: ''
                    });
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newLoad.name || !newLoad.caliber) {
                      alert('Please fill in required fields');
                      return;
                    }
                    const updatedEquipment = {
                      ...equipment,
                      loads: [...equipment.loads, newLoad]
                    };
                    setEquipment(updatedEquipment);
                    await dataEndpoints.saveEquipment(updatedEquipment);
                    setShowAddLoad(false);
                    setNewLoad({
                      name: '', caliber: '', bullet: '', bulletWeight: '',
                      powder: '', charge: '', primer: '', brass: '', oal: '', cbto: ''
                    });
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Add Load
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