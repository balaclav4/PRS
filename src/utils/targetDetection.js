/**
 * Target Detection Utilities
 * Uses OpenCV.js for Hough Circle Transform to detect circular targets
 */

let cv = null;

/**
 * Initialize OpenCV
 * Must be called before using detection functions
 */
export const initializeOpenCV = async () => {
  if (cv) return cv;

  try {
    // Dynamic import to avoid SSR issues
    const opencv = await import('@techstark/opencv-js');
    cv = opencv.default || opencv;

    // Wait for OpenCV to be ready
    return new Promise((resolve) => {
      if (cv.getBuildInformation) {
        resolve(cv);
      } else {
        cv.onRuntimeInitialized = () => resolve(cv);
      }
    });
  } catch (error) {
    console.error('Failed to load OpenCV:', error);
    throw error;
  }
};

/**
 * Detect circular targets in an image using Hough Circle Transform
 * @param {HTMLImageElement} imageElement - The image to analyze
 * @param {Object} options - Detection options
 * @returns {Array} Array of detected circles with confidence scores
 */
export const detectTargets = async (imageElement, options = {}) => {
  if (!cv) {
    await initializeOpenCV();
  }

  const {
    minRadius = 20,          // Minimum target radius in pixels
    maxRadius = 400,         // Maximum target radius in pixels
    minDistance = 100,       // Minimum distance between target centers
    cannyThreshold = 100,    // Canny edge detection threshold
    circleThreshold = 30,    // Circle detection threshold (lower = more circles)
    maxTargets = 10          // Maximum number of targets to detect
  } = options;

  try {
    // Read image into OpenCV matrix
    const src = cv.imread(imageElement);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const circles = new cv.Mat();

    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Apply median blur to reduce noise
    cv.medianBlur(gray, blurred, 5);

    // Detect circles using Hough Circle Transform
    cv.HoughCircles(
      blurred,
      circles,
      cv.HOUGH_GRADIENT,
      1,                    // Inverse ratio of accumulator resolution
      minDistance,          // Minimum distance between circle centers
      cannyThreshold,       // Upper threshold for Canny edge detector
      circleThreshold,      // Accumulator threshold for circle centers
      minRadius,
      maxRadius
    );

    // Process detected circles
    const detectedTargets = [];
    const numCircles = Math.min(circles.cols, maxTargets);

    for (let i = 0; i < numCircles; i++) {
      const x = circles.data32F[i * 3];
      const y = circles.data32F[i * 3 + 1];
      const radius = circles.data32F[i * 3 + 2];

      // Calculate confidence score based on circle properties
      const confidence = calculateCircleConfidence(
        blurred,
        x,
        y,
        radius,
        imageElement.width,
        imageElement.height
      );

      detectedTargets.push({
        x: Math.round(x),
        y: Math.round(y),
        radius: Math.round(radius),
        confidence: confidence,
        id: Date.now() + i
      });
    }

    // Clean up OpenCV matrices
    src.delete();
    gray.delete();
    blurred.delete();
    circles.delete();

    // Sort by confidence (highest first)
    detectedTargets.sort((a, b) => b.confidence - a.confidence);

    return detectedTargets;
  } catch (error) {
    console.error('Error detecting targets:', error);
    return [];
  }
};

/**
 * Calculate confidence score for a detected circle
 * Higher score = more likely to be a valid target
 */
const calculateCircleConfidence = (grayImage, x, y, radius, imgWidth, imgHeight) => {
  let confidence = 100;

  // Penalize circles too close to edges
  const edgeDistance = Math.min(x, y, imgWidth - x, imgHeight - y);
  if (edgeDistance < radius * 1.2) {
    confidence -= 20;
  }

  // Penalize very small circles (likely noise)
  if (radius < 30) {
    confidence -= 30;
  }

  // Penalize very large circles (likely image boundary)
  if (radius > imgWidth * 0.4 || radius > imgHeight * 0.4) {
    confidence -= 40;
  }

  // Bonus for circles in reasonable size range
  if (radius >= 50 && radius <= 200) {
    confidence += 20;
  }

  // Check circle edge contrast (sample points around circumference)
  const edgeContrast = sampleCircleEdge(grayImage, x, y, radius);
  confidence += edgeContrast * 20;

  return Math.max(0, Math.min(100, confidence));
};

/**
 * Sample pixel intensity around circle edge to check for strong edges
 * Returns a score between 0 and 1
 */
const sampleCircleEdge = (grayImage, cx, cy, radius) => {
  const numSamples = 16;
  let contrastSum = 0;

  for (let i = 0; i < numSamples; i++) {
    const angle = (i / numSamples) * 2 * Math.PI;
    const innerX = Math.round(cx + (radius - 5) * Math.cos(angle));
    const innerY = Math.round(cy + (radius - 5) * Math.sin(angle));
    const outerX = Math.round(cx + (radius + 5) * Math.cos(angle));
    const outerY = Math.round(cy + (radius + 5) * Math.sin(angle));

    // Safety bounds check
    if (
      innerX >= 0 && innerX < grayImage.cols &&
      innerY >= 0 && innerY < grayImage.rows &&
      outerX >= 0 && outerX < grayImage.cols &&
      outerY >= 0 && outerY < grayImage.rows
    ) {
      const innerVal = grayImage.ucharPtr(innerY, innerX)[0];
      const outerVal = grayImage.ucharPtr(outerY, outerX)[0];
      contrastSum += Math.abs(innerVal - outerVal);
    }
  }

  const avgContrast = contrastSum / (numSamples * 255);
  return Math.min(1, avgContrast);
};

/**
 * Validate detected targets using additional heuristics
 * This is where we could add TensorFlow validation in the future
 */
export const validateTarget = (target, imageElement) => {
  // Basic validation
  const isValid =
    target.confidence > 40 &&
    target.radius > 20 &&
    target.radius < Math.min(imageElement.width, imageElement.height) * 0.5;

  return {
    ...target,
    validated: isValid,
    validationScore: target.confidence
  };
};

/**
 * Auto-detect target diameter in inches based on common target sizes
 * Returns best guess for target diameter
 */
export const estimateTargetDiameter = (radiusInPixels) => {
  // Common target sizes (in inches)
  const commonSizes = [1, 2, 3, 4, 6, 8, 10, 12];

  // Rough heuristic: assume ~50-100 pixels per inch for typical phone photos
  const estimatedInches = (radiusInPixels * 2) / 75;

  // Find closest common size
  const closest = commonSizes.reduce((prev, curr) =>
    Math.abs(curr - estimatedInches) < Math.abs(prev - estimatedInches) ? curr : prev
  );

  return closest;
};
