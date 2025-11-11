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
  Clock, File, Smartphone, Moon, Sun
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import {
  addSession, getSessions, deleteSession,
  addRifle, getRifles, deleteRifle,
  addLoad, getLoads, deleteLoad,
  addTrainingImage, getTrainingDataCount
} from './services/firestore';

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

      const sessionToSave = {
        ...sessionData,
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
            <Target className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-blue-600 dark:text-blue-400`} />
            <h1 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900 dark:text-white`}>PRS Precision</h1>
          </div>
          <div className="flex items-center space-x-2">
            {user && (
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
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
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
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
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
          <Target className="h-16 w-16 text-blue-600 dark:text-blue-400 mx-auto mb-4 animate-pulse" />
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
            <Target className="h-16 w-16 text-blue-600 dark:text-blue-400 mx-auto mb-4 animate-pulse" />
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
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors">
                <div className="flex items-center mb-4">
                  <Target className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
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
                        ? 'bg-blue-600 text-white'
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
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Session Name*</label>
                      <input
                        type="text"
                        value={sessionData.name}
                        onChange={(e) => setSessionData({...sessionData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="e.g., Range Day - Load Testing"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Target Diameter (inches)*</label>
                      <input
                        type="number"
                        step="0.1"
                        value={targetDiameter}
                        onChange={(e) => setTargetDiameter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                        placeholder="e.g., 1.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Rifle*</label>
                      <select
                        value={sessionData.rifle}
                        onChange={(e) => setSessionData({...sessionData, rifle: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
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
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Date</label>
                      <input
                        type="date"
                        value={sessionData.date}
                        onChange={(e) => setSessionData({...sessionData, date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg border dark:border-blue-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">Chronograph Data</h4>
                        {sessionData.chronoData ? (
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            {sessionData.chronoData.count} shots • Avg: {sessionData.chronoData.average.toFixed(0)} fps • ES: {sessionData.chronoData.es.toFixed(0)} fps
                          </p>
                        ) : (
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">No chrono data imported</p>
                        )}
                      </div>
                      <button
                        onClick={() => setShowChronoImport(true)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium flex items-center"
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
                        if (!sessionData.name || !targetDiameter || !sessionData.rifle || !sessionData.load) {
                          alert('Please fill in all required fields');
                          return;
                        }
                        setCaptureStep('select-targets');
                      }}
                      className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
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
                <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">📍 Mark Target Locations</h3>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Click on each target to mark its location. They'll be numbered 1, 2, 3, etc.
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
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
                <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">📐 Adjust Target Size & Position</h3>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
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
                              className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
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
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
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
                        <div key={target.id} className="border-l-4 border-blue-500 dark:border-blue-400 pl-4">
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
              <button
                onClick={exportToCSV}
                className={`bg-green-600 hover:bg-green-700 text-white ${isMobile ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'} rounded-lg font-medium transition-colors flex items-center`}
                disabled={sessions.length === 0}
              >
                <Download className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} mr-2`} />
                Export CSV
              </button>
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
                            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
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
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
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
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:dark:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
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

                          if (!result) {
                            return (
                              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
                                <p className="text-red-800 dark:text-red-200">Unable to perform comparison. Ensure both groups have data.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">T-Test Results (Independent Samples)</h4>
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
                                  <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
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
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-white`}>Equipment Management</h2>

            <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-6`}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rifles</h3>
                  <button
                    onClick={() => setShowAddRifle(true)}
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Add Rifle
                  </button>
                </div>

                {equipment.rifles.length > 0 ? (
                  <div className="space-y-3">
                    {equipment.rifles.map((rifle, index) => (
                      <div key={index} className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 py-2 flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{rifle.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{rifle.caliber} • {rifle.barrel} • {rifle.twist}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{rifle.scope}</p>
                        </div>
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
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
                          <p className="text-sm text-gray-500 dark:text-gray-400">{load.charge} {load.powder} • OAL: {load.oal}</p>
                        </div>
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
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No loads added yet</p>
                )}
              </div>
            </div>

            {/* iOS App Integration Info */}
            <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
              <div className="flex items-start">
                <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3 mt-1" />
                <div>
                  <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">iOS App Integration</h3>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                    This app is ready for iOS integration with the following API endpoints:
                  </p>
                  <div className="bg-white dark:bg-gray-800 bg-opacity-50 rounded p-3 font-mono text-xs">
                    <p className="text-blue-700 dark:text-blue-400">POST /api/sessions - Save session data</p>
                    <p className="text-blue-700 dark:text-blue-400">GET /api/sessions - Load all sessions</p>
                    <p className="text-blue-700 dark:text-blue-400">POST /api/equipment - Save equipment</p>
                    <p className="text-blue-700 dark:text-blue-400">GET /api/equipment - Load equipment</p>
                    <p className="text-blue-700 dark:text-blue-400">GET /api/export?format=csv - Export data</p>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mt-3">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add New Rifle</h3>
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
                      // Save to Firestore
                      const rifleId = await addRifle(user.uid, newRifle);

                      // Update local state
                      const rifleWithId = { id: rifleId, ...newRifle };
                      setEquipment(prev => ({
                        ...prev,
                        rifles: [...prev.rifles, rifleWithId]
                      }));

                      setShowAddRifle(false);
                      setNewRifle({ name: '', caliber: '', barrel: '', twist: '', scope: '' });
                    } catch (error) {
                      console.error('Error adding rifle:', error);
                      alert('Failed to add rifle. Please try again.');
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
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
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add New Load</h3>
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
                      // Save to Firestore
                      const loadId = await addLoad(user.uid, newLoad);

                      // Update local state
                      const loadWithId = { id: loadId, ...newLoad };
                      setEquipment(prev => ({
                        ...prev,
                        loads: [...prev.loads, loadWithId]
                      }));

                      setShowAddLoad(false);
                      setNewLoad({
                        name: '', caliber: '', bullet: '', bulletWeight: '',
                        powder: '', charge: '', primer: '', brass: '', oal: '', cbto: ''
                      });
                    } catch (error) {
                      console.error('Error adding load:', error);
                      alert('Failed to add load. Please try again.');
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
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