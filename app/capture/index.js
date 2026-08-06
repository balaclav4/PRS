import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, StyleSheet, useWindowDimensions, Alert, Platform, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, ImageIcon, ArrowRight, Ruler, Crosshair, RotateCcw, Eraser, Save, ChevronRight, Wand2, LoaderCircle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react-native';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Polygon, Line } from 'react-native-svg';
import { useTheme, groupColor } from '../../lib/theme';
import { useData } from '../../store/data';
import { computeGroupStats } from '../../lib/math';
import { rectifyToInches, project, orderCorners, perspectiveSeverity } from '../../lib/homography';
import { lightTap, mediumTap, successTap } from '../../lib/haptics';
import { loadGrayscale, imageToNormalized, coverScale } from '../../lib/pixels';
import { detectShots } from '../../lib/detect';
import { bulletDiameterIn } from '../../lib/calibers';
import { normalizePhoto } from '../../lib/photo';
import { toImage, clampPan, zoomAbout, fitViewport, pinchDistance, pinchCentre } from '../../lib/viewport';
import { quadCentre } from '../../lib/homography';
import { formatGroup, groupUnitLabel, formatDistance } from '../../lib/units';
import { consentIsCurrent } from '../../lib/consent';

const STEP_LABELS = ['Photo', 'Setup', 'Corners', 'Mark Shots', 'Review'];
const IMG_ASPECT = 1.25;

export default function CaptureScreen() {
  const { colors } = useTheme();
  const { addSession, rifles, loads, units, trainingConsent } = useData();
  const router = useRouter();

  // Reactive, not Dimensions.get() at module scope: that captured the width
  // once at first load, so a browser resize or device rotation left the photo
  // box at a stale width and it overflowed the viewport. Tap coordinates are
  // normalised fractions of this width, so they stay valid across a resize.
  const { width: SCREEN_W } = useWindowDimensions();
  const IMG_W = SCREEN_W - 40;
  const IMG_H = IMG_W * IMG_ASPECT;

  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(null); // { uri, width, height } — normalized, upright
  const [processing, setProcessing] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const [refW, setRefW] = useState('8.5');
  const [refH, setRefH] = useState('11');
  const [distanceStr, setDistanceStr] = useState('100');
  const [rifleIdx, setRifleIdx] = useState(0);
  const [loadIdx, setLoadIdx] = useState(0);
  const [suppressed, setSuppressed] = useState(true);
  const [sessionName, setSessionName] = useState('');
  const [corners, setCorners] = useState([]);
  // Point of aim. Optional: only a shooter zeroing or truing needs it, so it
  // never blocks saving, but without it point of impact is unmeasurable.
  const [aim, setAim] = useState(null);
  const [markMode, setMarkMode] = useState('shot');
  const [shots, setShots] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [detectNote, setDetectNote] = useState(null);
  // True while the shot set is exactly what detection produced. Re-running
  // detection then is idempotent and needs no confirmation; any hand edit
  // clears it so the next run warns before overwriting that work.
  const detectedRef = useRef(false);

  // Photo viewport. Zooming is what makes marking a tight group possible at
  // all — at 6x a shaky 3px touch resolves to half an image pixel.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggedRef = useRef(false);
  const gestureRef = useRef({ startPan: null, startDist: null, startZoom: 1 });

  const refWIn = parseFloat(refW) || 0;
  const refHIn = parseFloat(refH) || 0;
  const distance = parseFloat(distanceStr) || 0;

  // Continue is disabled on bad input; say why rather than just greying it out.
  const badNum = (raw, parsed) => raw.trim() !== '' && parsed <= 0;
  const refSizeError =
    badNum(refW, refWIn) || badNum(refH, refHIn)
      ? 'Width and height must be positive numbers.'
      : null;
  const distanceError = badNum(distanceStr, distance)
    ? 'Distance must be a positive number.'
    : null;

  // Rifle selection cycles through equipment; loads are scoped to the rifle.
  const rifle = rifles.length ? rifles[rifleIdx % rifles.length] : null;
  const rifleLoads = useMemo(
    () => loads.filter(l => l.rifleId === rifle?.id),
    [loads, rifle]
  );
  const load = rifleLoads.length ? rifleLoads[loadIdx % rifleLoads.length] : null;

  const cycleRifle = () => { setRifleIdx(i => i + 1); setLoadIdx(0); };
  const cycleLoad = () => setLoadIdx(i => i + 1);

  // Suggested name follows the selections, so leaving the field blank still
  // yields something more useful than a bare date.
  const defaultSessionName = rifle
    ? `${rifle.name} · ${distance || '—'}yd`
    : 'Session ' + new Date().toLocaleDateString();

  // Four corners of a reference rectangle of known size give both the absolute
  // scale and the perspective correction in one homography — shots project
  // straight to inches on the target plane, no marker sticker needed.
  const { Hmat, ordered, severity } = useMemo(() => {
    if (corners.length !== 4 || refWIn <= 0 || refHIn <= 0) {
      return { Hmat: null, ordered: null, severity: 0 };
    }
    const ord = orderCorners(corners);
    return {
      Hmat: rectifyToInches(ord, refWIn, refHIn),
      ordered: ord,
      severity: perspectiveSeverity(ord),
    };
  }, [corners, refWIn, refHIn]);

  // Seed the aim at the centre of the framed reference as soon as it exists, so
  // the assumption is visible and movable at capture time rather than applied
  // silently when the target is read back.
  useEffect(() => {
    if (ordered && !aim) setAim(quadCentre(ordered));
  }, [ordered, aim]);

  // Shot positions on the target plane, in inches.
  const shotsIn = useMemo(
    () => (Hmat ? shots.map(p => project(Hmat, p)).filter(Boolean) : []),
    [Hmat, shots]
  );
  const stats = computeGroupStats(shotsIn, Hmat ? 1 : null, distance);

  // Shrink the markers when the group is tight enough that fixed 24px badges
  // would overlap and make individual shots impossible to tap. Floors at 14px
  // so they stay a usable target.
  const dotSize = useMemo(() => {
    if (shots.length < 2) return 24;
    let min = Infinity;
    for (let i = 0; i < shots.length; i++) {
      for (let j = i + 1; j < shots.length; j++) {
        const d = Math.hypot(shots[i].x - shots[j].x, shots[i].y - shots[j].y) * IMG_W;
        if (d < min) min = d;
      }
    }
    return Math.max(14, Math.min(24, min));
  }, [shots, IMG_W]);

  // Normalize at intake: bakes out EXIF orientation so the displayed image and
  // the analyzed pixels can never disagree, and caps decoded size.
  const acceptPhoto = useCallback(async (asset) => {
    setProcessing(true);
    try {
      const norm = await normalizePhoto(asset.uri);
      setPhoto(norm);
      setUseDemo(false);
      setStep(1);
    } catch (e) {
      const msg = 'Could not process that photo: ' + e.message;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Photo Error', msg);
    }
    setProcessing(false);
  }, []);

  /**
   * Both pickers previously ran with no try/catch, so any rejection became an
   * unhandled promise and the button simply did nothing — indistinguishable
   * from a dead control. Every failure now says what went wrong.
   */
  const reportPickerFailure = useCallback((what, e) => {
    const msg = e?.message || String(e);
    if (Platform.OS === 'web') alert(`${what} failed: ${msg}`);
    else Alert.alert(`${what} failed`, msg);
  }, []);

  const pickPhoto = useCallback(async () => {
    try {
      // Requested explicitly rather than relying on the picker to prompt.
      // Without this a denied library permission returns `canceled` and looks
      // identical to the user backing out.
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        const msg = 'Photo library access is needed to import a target. Enable it in Settings for PRS Precision.';
        if (Platform.OS === 'web') alert(msg); else Alert.alert('Photo Permission', msg);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) await acceptPhoto(result.assets[0]);
    } catch (e) {
      reportPickerFailure('Import', e);
    }
  }, [acceptPhoto, reportPickerFailure]);

  const takePhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        const msg = 'Camera access is needed to photograph targets. Enable it in Settings for PRS Precision.';
        if (Platform.OS === 'web') alert(msg); else Alert.alert('Camera Permission', msg);
        return;
      }
      // `capture` is not a valid ImagePickerOptions field in SDK 57 — it only
      // ever meant anything to the web file input. Passing it on native was at
      // best ignored and at worst rejected, so it is confined to web.
      const opts = { quality: 0.8 };
      if (Platform.OS === 'web') opts.capture = 'back';
      const result = await ImagePicker.launchCameraAsync(opts);
      if (!result.canceled && result.assets?.[0]) await acceptPhoto(result.assets[0]);
    } catch (e) {
      reportPickerFailure('Camera', e);
    }
  }, [acceptPhoto, reportPickerFailure]);

  const onTapImage = useCallback((e, mode) => {
    // A pan gesture ends with a release over the photo, which would otherwise
    // drop a shot wherever the drag finished.
    if (draggedRef.current) { draggedRef.current = false; return; }

    const ne = e.nativeEvent || e;
    const locationX = ne.locationX ?? ne.offsetX;
    const locationY = ne.locationY ?? ne.offsetY;
    if (locationX == null || locationY == null) return;
    // Undo zoom/pan first: the tap is in screen space, the stored point is in
    // the unzoomed image space.
    const img = toImage({ x: locationX, y: locationY }, zoom, pan);

    // Both axes divide by the same reference length. Dividing y by the box
    // height instead made the coordinate space anisotropic, so hypot() mixed
    // units and vertical distances measured 20% short.
    const x = img.x / IMG_W;
    const y = img.y / IMG_W;
    if (!isFinite(x) || !isFinite(y)) return;
    const pt = { x, y };

    if (mode === 'corner') {
      // Extra taps are inert rather than restarting — a stray 5th tap must not
      // silently destroy the calibration. Reset is the deliberate redo.
      setCorners(prev => prev.length >= 4 ? prev : [...prev, pt]);
      mediumTap();
    } else if (mode === 'aim') {
      // One aim point per target; tapping again moves it.
      setAim(pt);
      mediumTap();
    } else {
      detectedRef.current = false;
      setShots(prev => [...prev, pt]);
      lightTap();
    }
  }, [IMG_W]);

  /**
   * One responder handles both panning and pinching, and decides at release
   * whether the gesture was a tap. Doing this with a single PanResponder keeps
   * it identical on web and native rather than depending on gesture-handler's
   * differing web behaviour.
   */
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) =>
      Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3 || _e.nativeEvent.touches?.length === 2,

    onPanResponderGrant: () => {
      draggedRef.current = false;
      gestureRef.current = { startPan: pan, startDist: null, startZoom: zoom };
    },

    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches;
      const dist = pinchDistance(touches);

      if (dist != null) {
        // Pinch: scale about the midpoint so the group stays under the fingers.
        draggedRef.current = true;
        const st = gestureRef.current;
        if (st.startDist == null) { st.startDist = dist; st.startZoom = zoom; st.startPan = pan; }
        const centre = pinchCentre(touches, 0, 0) || { x: IMG_W / 2, y: IMG_H / 2 };
        const next = zoomAbout(centre, st.startZoom * (dist / st.startDist), zoom, pan, IMG_W, IMG_H);
        setZoom(next.zoom);
        setPan(next.pan);
        return;
      }

      if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) draggedRef.current = true;
      if (zoom > 1 && gestureRef.current.startPan) {
        const base = gestureRef.current.startPan;
        setPan(clampPan({ x: base.x + g.dx, y: base.y + g.dy }, zoom, IMG_W, IMG_H));
      }
    },

    onPanResponderRelease: () => { gestureRef.current.startDist = null; },
    onPanResponderTerminate: () => { gestureRef.current.startDist = null; },
  }), [zoom, pan, IMG_W, IMG_H]);

  const stepZoom = (factor) => {
    const next = zoomAbout({ x: IMG_W / 2, y: IMG_H / 2 }, zoom * factor, zoom, pan, IMG_W, IMG_H);
    setZoom(next.zoom);
    setPan(next.pan);
  };
  const resetView = () => { const f = fitViewport(); setZoom(f.zoom); setPan(f.pan); };

  const removeShot = (i) => {
    detectedRef.current = false;
    setShots(prev => prev.filter((_, j) => j !== i));
  };

  const clearShots = () => {
    detectedRef.current = false;
    setShots([]);
    setDetectNote(null);
  };

  /**
   * Find bullet holes automatically.
   *
   * Needs the scale first: the caliber gives the hole's real diameter, and the
   * scale converts that to pixels, which is the prior the detector runs on.
   */
  const autoDetect = useCallback(async () => {
    if (!photo || !Hmat) return;

    // Detection replaces the whole set, so confirm before discarding manual work.
    if (shots.length && !detectedRef.current) {
      const ok = Platform.OS === 'web'
        ? confirm('Replace your marked shots with auto-detected ones?')
        : await new Promise(res => Alert.alert(
            'Replace marked shots?',
            'Auto-detect will discard the shots you marked by hand.',
            [{ text: 'Cancel', style: 'cancel', onPress: () => res(false) },
             { text: 'Replace', style: 'destructive', onPress: () => res(true) }]
          ));
      if (!ok) return;
    }

    setDetecting(true);
    setDetectNote(null);
    try {
      const { gray, width, height } = await loadGrayscale(photo.uri);
      const boxH = IMG_H;
      const k = coverScale(width, height, IMG_W, boxH);

      const caliberText = load?.caliber || rifle?.cartridge;
      const { diameterIn, matched } = bulletDiameterIn(caliberText);

      // Source-image px per inch, averaged over the quad's top and bottom
      // edges (display units -> display px -> source px).
      const edge = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const quadWDisp = (edge(ordered[0], ordered[1]) + edge(ordered[3], ordered[2])) / 2;
      const pxPerIn = (quadWDisp * IMG_W / k) / refWIn;
      const radiusPx = (diameterIn * pxPerIn) / 2;

      // Corner-derived scale is exact, and a hole cannot be smaller than the
      // bullet, so skip the sub-caliber sweep scale — on the real-photo
      // harness it produced every junction false positive.
      const { shots: found, reason } = detectShots(gray, width, height, {
        radiusPx,
        scales: [1.0, 1.35],
      });

      if (!found.length) {
        setDetectNote(reason || 'No holes found — mark them manually.');
      } else {
        setShots(found.map(f => imageToNormalized(f.x, f.y, width, height, IMG_W, boxH)));
        detectedRef.current = true;
        setDetectNote(
          `Found ${found.length} hole${found.length === 1 ? '' : 's'}` +
          (matched ? '' : ' · caliber not recognised, assumed 6.5mm') +
          ' — tap any marker to remove, tap the photo to add.'
        );
        await successTap();
      }
    } catch (e) {
      setDetectNote('Detection failed: ' + e.message);
    }
    setDetecting(false);
  }, [photo, Hmat, ordered, refWIn, load, rifle, shots.length, IMG_W, IMG_H]);

  const canNext =
    (step === 1 && refWIn > 0 && refHIn > 0 && distance > 0) ||
    (step === 2 && !!Hmat) ||
    (step === 3 && shots.length >= 2);

  const saveAndFinish = async () => {
    await successTap();
    const id = 's' + Date.now();
    addSession({
      id,
      name: sessionName.trim() || defaultSessionName,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      rifleId: rifle?.id || null,
      loadId: load?.id || null,
      distanceYd: distance,
      suppressed,
      notes: '',
      targets: [{
        id: 't' + Date.now(),
        shots: shots.map(sh => ({ x: sh.x, y: sh.y })),
        scale: ordered ? { corners: ordered, widthIn: refWIn, heightIn: refHIn } : null,
        aim,
        // Recorded at capture, because that is when the decision applied.
        // Enabling contribution later must not reach back over photos taken
        // while it was off.
        contributeConsent: consentIsCurrent(trainingConsent) ? trainingConsent : null,
      }],
      best: stats ? stats.extremeSpreadIn.toFixed(2) : '—',
      meanRadius: stats ? stats.meanRadiusIn.toFixed(2) : '—',
      sd: 0,
      mv: 0,
      targetCount: 1,
    });
    // On web a deep link straight to /capture has no history to pop.
    if (router.canGoBack?.()) router.back();
    else router.replace('/');
  };

  const capGood = stats && stats.groupMoa <= 0.5;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => step > 0 ? setStep(step - 1) : (router.canGoBack?.() ? router.back() : router.replace('/'))}
            style={[s.backBtn, { backgroundColor: colors.card, borderColor: colors.bd }]}
          >
            <ArrowLeft size={19} color={colors.tx} />
          </TouchableOpacity>
          <View>
            <Text style={[s.title, { color: colors.tx }]}>New Session</Text>
            <Text style={[s.subtitle, { color: colors.mut }]}>Step {step + 1} of 5 · {STEP_LABELS[step]}</Text>
          </View>
        </View>

        {/* Progress dots */}
        <View style={s.dots}>
          {STEP_LABELS.map((_, i) => (
            <View key={i} style={[s.dot, { backgroundColor: i <= step ? '#6D3BEB' : colors.ibd }]} />
          ))}
        </View>

        {/* Step 0: Photo */}
        {step === 0 && (
          <View style={[s.photoBox, { borderColor: colors.ibd, backgroundColor: colors.inset }]}>
            <View style={[s.photoIcon, { backgroundColor: colors.acs }]}>
              <Camera size={30} color={colors.act} />
            </View>
            <Text style={[s.photoTitle, { color: colors.tx }]}>Add a target photo</Text>
            <Text style={[s.photoDesc, { color: colors.mut }]}>Photograph the whole target sheet — square-on{'\n'}or at an angle, perspective is corrected</Text>
            <View style={s.photoBtns}>
              <TouchableOpacity onPress={takePhoto} disabled={processing} style={[s.primaryBtn, { opacity: processing ? 0.6 : 1 }]}>
                <Camera size={16} color="#fff" />
                <Text style={s.primaryBtnText}>{processing ? 'Processing…' : 'Take Photo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickPhoto} disabled={processing} style={[s.secondaryBtn, { backgroundColor: colors.acs, opacity: processing ? 0.6 : 1 }]}>
                <ImageIcon size={16} color={colors.act} />
                <Text style={[s.secondaryBtnText, { color: colors.act }]}>Upload Photo</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => { setUseDemo(true); setPhoto(null); setStep(1); }}>
              <Text style={[s.demoLink, { color: colors.act }]}>Use a demo target instead</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 1: Setup */}
        {step === 1 && (
          <View style={s.setupWrap}>
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mut }]}>Reference Size (width × height)</Text>
              <View style={s.twoCol}>
                <View style={[s.inputRow, { flex: 1, backgroundColor: colors.input, borderColor: colors.ibd }]}>
                  <TextInput
                    value={refW}
                    onChangeText={setRefW}
                    keyboardType="decimal-pad"
                    style={[s.input, { color: colors.tx, fontFamily: 'JetBrainsMono_500Medium' }]}
                  />
                  <Text style={[s.inputUnit, { color: colors.mut }]}>in</Text>
                </View>
                <View style={[s.inputRow, { flex: 1, backgroundColor: colors.input, borderColor: colors.ibd }]}>
                  <TextInput
                    value={refH}
                    onChangeText={setRefH}
                    keyboardType="decimal-pad"
                    style={[s.input, { color: colors.tx, fontFamily: 'JetBrainsMono_500Medium' }]}
                  />
                  <Text style={[s.inputUnit, { color: colors.mut }]}>in</Text>
                </View>
              </View>
              {refSizeError
                ? <Text style={[s.fieldError, { color: colors.dngt }]}>{refSizeError}</Text>
                : <Text style={[s.fieldHint, { color: colors.fnt }]}>The printed size of your target sheet or backer — you'll tap its four corners next. Sets the scale and corrects off-axis photos. Letter paper is 8.5 × 11.</Text>}
            </View>
            {/* Tapping cycles rather than opening a list, so the control says so
                and shows the position — a bare chevron promised a picker. */}
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mut }]}>Rifle</Text>
              <TouchableOpacity onPress={cycleRifle} disabled={rifles.length < 2} style={[s.picker, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                <Text style={[s.pickerText, { color: rifle ? colors.tx : colors.mut }]}>
                  {rifle ? `${rifle.name} · ${rifle.cartridge}` : 'No rifles — add one in Equipment'}
                </Text>
                {rifles.length > 1 && (
                  <View style={s.pickerCycle}>
                    <Text style={[s.pickerCount, { color: colors.mut }]}>{(rifleIdx % rifles.length) + 1}/{rifles.length}</Text>
                    <ChevronRight size={18} color={colors.act} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mut }]}>Load</Text>
              <TouchableOpacity onPress={cycleLoad} disabled={rifleLoads.length < 2} style={[s.picker, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                <Text style={[s.pickerText, { color: load ? colors.tx : colors.mut }]}>
                  {load ? load.name : 'No loads for this rifle'}
                </Text>
                {rifleLoads.length > 1 && (
                  <View style={s.pickerCycle}>
                    <Text style={[s.pickerCount, { color: colors.mut }]}>{(loadIdx % rifleLoads.length) + 1}/{rifleLoads.length}</Text>
                    <ChevronRight size={18} color={colors.act} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <View style={s.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mut }]}>Distance</Text>
                <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                  <TextInput
                    value={distanceStr}
                    onChangeText={setDistanceStr}
                    keyboardType="number-pad"
                    style={[s.input, { color: colors.tx, fontFamily: 'JetBrainsMono_700Bold' }]}
                  />
                  <Text style={[s.inputUnit, { color: colors.mut }]}>yd</Text>
                </View>
                {distanceError && <Text style={[s.fieldError, { color: colors.dngt }]}>{distanceError}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mut }]}>Suppressor</Text>
                <TouchableOpacity
                  onPress={() => setSuppressed(v => !v)}
                  style={[s.picker, suppressed
                    ? { backgroundColor: colors.acs, borderColor: colors.acs }
                    : { backgroundColor: colors.input, borderColor: colors.ibd }]}
                >
                  <Text style={[s.pickerText, { color: suppressed ? colors.act : colors.mut, fontWeight: '700' }]}>
                    {suppressed ? 'Yes' : 'No'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Step 2: Corners */}
        {step === 2 && (
          <View>
            <View style={[s.instruction, { backgroundColor: colors.acs }]}>
              <Ruler size={17} color={colors.act} />
              <Text style={[s.instructionText, { color: colors.act }]}>Tap the four corners of your {refW}″ × {refH}″ reference, in any order.</Text>
            </View>
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => onTapImage(e, 'corner')}
              style={[s.imgContainer, { borderColor: colors.bd, width: IMG_W, height: IMG_H }]}
              {...panResponder.panHandlers}
            >
              <View style={{
                position: 'absolute',
                left: pan.x, top: pan.y,
                width: IMG_W * zoom, height: IMG_H * zoom,
              }}>
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={s.targetImg} resizeMode="cover" />
                ) : useDemo ? (
                  <Svg viewBox="0 0 320 400" style={s.demoSvg}>
                    <Circle cx="160" cy="185" r="92" fill="rgba(255,138,42,0.28)" stroke="#F0872B" strokeWidth="3" />
                    <Circle cx="160" cy="185" r="3.5" fill="#F0872B" />
                  </Svg>
                ) : null}
              </View>
              {ordered && (
                // Corners are normalized by the box *width*, so y spans 0..1.25
                // in a 1.25-aspect box: the viewBox must be 100x125 for a
                // uniform x100 mapping on both axes.
                <Svg viewBox="0 0 100 125" preserveAspectRatio="none" style={{
                  position: 'absolute',
                  left: pan.x, top: pan.y,
                  width: IMG_W * zoom, height: IMG_H * zoom,
                }}>
                  <Polygon
                    points={ordered.map(p => `${p.x * 100},${p.y * 100}`).join(' ')}
                    fill="rgba(240,135,43,0.10)"
                    stroke="#F0872B" strokeWidth="1.5" strokeDasharray="3 2" vectorEffect="non-scaling-stroke"
                  />
                </Svg>
              )}
              {corners.map((p, i) => (
                <View key={i} style={[s.cornerDot, { left: p.x * IMG_W * zoom + pan.x - 12, top: p.y * IMG_W * zoom + pan.y - 12 }]}>
                  <Text style={s.cornerDotText}>{i + 1}</Text>
                </View>
              ))}
            </TouchableOpacity>
            {Hmat && severity > 0.04 && (
              <View style={[s.detectNote, { backgroundColor: colors.acs, borderColor: colors.acs, marginTop: 10, marginBottom: 0 }]}>
                <Text style={[s.detectNoteText, { color: colors.act }]}>
                  Off-axis photo detected ({(severity * 100).toFixed(0)}% skew) — measurements are perspective-corrected.
                </Text>
              </View>
            )}
            {corners.length === 4 && !Hmat && (
              <View style={[s.detectNote, { backgroundColor: colors.inset, borderColor: colors.ibd, marginTop: 10, marginBottom: 0 }]}>
                <Text style={[s.detectNoteText, { color: colors.mut }]}>
                  Those corners don't form a usable rectangle — tap Reset and try again.
                </Text>
              </View>
            )}
            <View style={s.zoomBar}>
              <TouchableOpacity onPress={() => stepZoom(1 / 1.6)} disabled={zoom <= 1}
                style={[s.zoomBtn, { backgroundColor: colors.card, borderColor: colors.bd, opacity: zoom <= 1 ? 0.4 : 1 }]}>
                <ZoomOut size={16} color={colors.tx} />
              </TouchableOpacity>
              <Text style={[s.zoomLabel, { color: colors.mut }]}>{zoom.toFixed(1)}x</Text>
              <TouchableOpacity onPress={() => stepZoom(1.6)} disabled={zoom >= 8}
                style={[s.zoomBtn, { backgroundColor: colors.card, borderColor: colors.bd, opacity: zoom >= 8 ? 0.4 : 1 }]}>
                <ZoomIn size={16} color={colors.tx} />
              </TouchableOpacity>
              <TouchableOpacity onPress={resetView} disabled={zoom === 1}
                style={[s.zoomBtn, { backgroundColor: colors.card, borderColor: colors.bd, opacity: zoom === 1 ? 0.4 : 1 }]}>
                <Maximize2 size={15} color={colors.tx} />
              </TouchableOpacity>
              <Text style={[s.zoomHint, { color: colors.fnt }]}>
                {zoom > 1 ? 'Drag to pan' : 'Pinch or zoom in to place precisely'}
              </Text>
            </View>
            <View style={s.scaleFooter}>
              <Text style={[s.scaleCount, { color: colors.mut }]}>
                <Text style={{ color: colors.tx, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' }}>{corners.length}</Text>/4 corners set
              </Text>
              <TouchableOpacity onPress={() => setCorners([])} style={s.resetBtn}>
                <RotateCcw size={14} color={colors.act} />
                <Text style={[s.resetText, { color: colors.act }]}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Mark Shots */}
        {step === 3 && (
          <View>
            <View style={[s.instruction, { backgroundColor: colors.acs }]}>
              <Crosshair size={17} color={colors.act} />
              <Text style={[s.instructionText, { color: colors.act }]}>Tap each bullet hole. Tap a marker again to remove it.</Text>
            </View>

            {photo && (
              <TouchableOpacity
                onPress={autoDetect}
                disabled={detecting}
                style={[s.detectBtn, { opacity: detecting ? 0.6 : 1 }]}
              >
                {detecting
                  ? <LoaderCircle size={17} color="#fff" />
                  : <Wand2 size={17} color="#fff" />}
                <Text style={s.detectBtnText}>
                  {detecting ? 'Scanning target…' : 'Auto-detect shots'}
                </Text>
              </TouchableOpacity>
            )}

            {detectNote && (
              <View style={[s.detectNote, { backgroundColor: colors.inset, borderColor: colors.ibd }]}>
                <Text style={[s.detectNoteText, { color: colors.mut }]}>{detectNote}</Text>
              </View>
            )}
            <View style={s.markModeRow}>
              {[['shot', 'Shots'], ['aim', 'Aim point']].map(([k, label]) => (
                <TouchableOpacity
                  key={k}
                  onPress={() => setMarkMode(k)}
                  style={[s.markModeBtn, {
                    backgroundColor: markMode === k ? colors.act : colors.card,
                    borderColor: markMode === k ? colors.act : colors.bd,
                  }]}
                >
                  <Text style={[s.markModeText, { color: markMode === k ? '#fff' : colors.mut }]}>
                    {label}{k === 'aim' && aim ? ' ✓' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {markMode === 'aim' && (
              <Text style={[s.markModeHint, { color: colors.fnt }]}>
                Tap where you were aiming. Optional — but without it, point of impact
                can't be measured for zeroing or truing.
              </Text>
            )}

            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => onTapImage(e, markMode === 'aim' ? 'aim' : 'shots')}
              style={[s.imgContainer, { borderColor: colors.bd, width: IMG_W, height: IMG_H }]}
              {...panResponder.panHandlers}
            >
              <View style={{
                position: 'absolute',
                left: pan.x, top: pan.y,
                width: IMG_W * zoom, height: IMG_H * zoom,
              }}>
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={s.targetImg} resizeMode="cover" />
                ) : useDemo ? (
                  <Svg viewBox="0 0 320 400" style={s.demoSvg}>
                    <Circle cx="160" cy="185" r="92" fill="rgba(255,138,42,0.28)" stroke="#F0872B" strokeWidth="3" />
                    <Circle cx="160" cy="185" r="3.5" fill="#F0872B" />
                  </Svg>
                ) : null}
              </View>
              {aim && (
                <View pointerEvents="none" style={{
                  position: 'absolute',
                  left: aim.x * IMG_W * zoom + pan.x - 13,
                  top: aim.y * IMG_W * zoom + pan.y - 13,
                  width: 26, height: 26,
                }}>
                  <Svg width={26} height={26} viewBox="0 0 26 26">
                    <Circle cx="13" cy="13" r="10" fill="none" stroke="#12B76A" strokeWidth="2" />
                    <Line x1="13" y1="0" x2="13" y2="8" stroke="#12B76A" strokeWidth="2" />
                    <Line x1="13" y1="18" x2="13" y2="26" stroke="#12B76A" strokeWidth="2" />
                    <Line x1="0" y1="13" x2="8" y2="13" stroke="#12B76A" strokeWidth="2" />
                    <Line x1="18" y1="13" x2="26" y2="13" stroke="#12B76A" strokeWidth="2" />
                  </Svg>
                </View>
              )}
              {shots.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={(e) => { e.stopPropagation(); removeShot(i); }}
                  style={[s.shotDot, {
                    width: dotSize, height: dotSize, borderRadius: dotSize / 2,
                    left: p.x * IMG_W * zoom + pan.x - dotSize / 2,
                    top: p.y * IMG_W * zoom + pan.y - dotSize / 2,
                  }]}
                >
                  <Text style={[s.shotDotText, { fontSize: dotSize < 20 ? 8 : 10 }]}>{i + 1}</Text>
                </TouchableOpacity>
              ))}
              <View style={s.shotOverlay}>
                <Text style={s.shotOverlayText}>
                  {shots.length} shots · {stats ? formatGroup(stats.extremeSpreadIn, distance, units.group) : '—'}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={s.zoomBar}>
              <TouchableOpacity onPress={() => stepZoom(1 / 1.6)} disabled={zoom <= 1}
                style={[s.zoomBtn, { backgroundColor: colors.card, borderColor: colors.bd, opacity: zoom <= 1 ? 0.4 : 1 }]}>
                <ZoomOut size={16} color={colors.tx} />
              </TouchableOpacity>
              <Text style={[s.zoomLabel, { color: colors.mut }]}>{zoom.toFixed(1)}x</Text>
              <TouchableOpacity onPress={() => stepZoom(1.6)} disabled={zoom >= 8}
                style={[s.zoomBtn, { backgroundColor: colors.card, borderColor: colors.bd, opacity: zoom >= 8 ? 0.4 : 1 }]}>
                <ZoomIn size={16} color={colors.tx} />
              </TouchableOpacity>
              <TouchableOpacity onPress={resetView} disabled={zoom === 1}
                style={[s.zoomBtn, { backgroundColor: colors.card, borderColor: colors.bd, opacity: zoom === 1 ? 0.4 : 1 }]}>
                <Maximize2 size={15} color={colors.tx} />
              </TouchableOpacity>
              <Text style={[s.zoomHint, { color: colors.fnt }]}>
                {zoom > 1 ? 'Drag to pan' : 'Pinch or zoom in to place precisely'}
              </Text>
            </View>
            <View style={s.scaleFooter}>
              <Text style={[s.scaleCount, { color: colors.mut }]}>
                Live group <Text style={{ color: colors.tx, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' }}>{stats ? formatGroup(stats.extremeSpreadIn, distance, units.group) : '—'}</Text>
              </Text>
              <TouchableOpacity onPress={clearShots} style={s.resetBtn}>
                <Eraser size={14} color={colors.act} />
                <Text style={[s.resetText, { color: colors.act }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <View>
            <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.bd }]}>
              <View style={[s.reviewThumb, { borderColor: colors.bd }]}>
                {useDemo && (
                  <Svg viewBox="0 0 320 400" style={{ position: 'absolute', width: '100%', height: '100%' }}>
                    <Circle cx="160" cy="185" r="92" fill="rgba(255,138,42,0.28)" stroke="#F0872B" strokeWidth="4" />
                  </Svg>
                )}
                {photo && <Image source={{ uri: photo.uri }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />}
              </View>
              <View>
                <Text style={[s.reviewMsg, { color: capGood ? colors.okt : colors.tx }]}>
                  {capGood ? 'Tight group!' : (shots.length >= 2 ? 'Group measured' : 'Mark at least 2 shots')}
                </Text>
                <Text style={[s.reviewSub, { color: colors.mut }]}>
                  <Text style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{shots.length}</Text> shots · <Text style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{stats ? formatGroup(stats.extremeSpreadIn, distance, units.group) : '—'}</Text> extreme spread
                </Text>
              </View>
            </View>

            <View style={s.reviewGrid}>
              {[
                [`GROUP (${groupUnitLabel(units.group)})`,
                  stats ? formatGroup(stats.extremeSpreadIn, distance, units.group, { withUnit: false }) : '—'],
                // The complement: an angle alone hides how big the group is, an
                // absolute length alone hides how it compares across distances.
                units.group === 'Inches'
                  ? ['GROUP MOA', stats ? stats.groupMoa.toFixed(2) : '—']
                  : ['GROUP SIZE', stats ? formatGroup(stats.extremeSpreadIn, distance, 'Inches') : '—'],
                [`MEAN RADIUS (${groupUnitLabel(units.group)})`,
                  stats ? formatGroup(stats.meanRadiusIn, distance, units.group, { withUnit: false }) : '—'],
                ['SHOTS', String(shots.length)],
              ].map(([label, val], i) => (
                <View key={i} style={[s.reviewTile, { backgroundColor: colors.card, borderColor: colors.bd }]}>
                  <Text style={[s.reviewTileLabel, { color: colors.mut }]}>{label}</Text>
                  <Text style={[s.reviewTileVal, { color: colors.tx }]}>{val}</Text>
                </View>
              ))}
            </View>

            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mut }]}>Session Name</Text>
              <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                <TextInput
                  value={sessionName}
                  onChangeText={setSessionName}
                  placeholder={defaultSessionName}
                  placeholderTextColor={colors.fnt}
                  style={[s.input, { color: colors.tx }]}
                />
              </View>
            </View>

            <TouchableOpacity onPress={saveAndFinish} style={s.saveBtn}>
              <Save size={18} color="#fff" />
              <Text style={s.saveBtnText}>Save Session</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Next button */}
        {(step >= 1 && step <= 3) && (
          <TouchableOpacity
            onPress={() => canNext && setStep(step + 1)}
            style={[s.nextBtn, { opacity: canNext ? 1 : 0.45 }]}
            disabled={!canNext}
          >
            <Text style={s.nextBtnText}>
              {step === 3 ? 'Review Group' : step === 2 ? 'Mark Shots' : 'Continue'}
            </Text>
            <ArrowRight size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  dots: { flexDirection: 'row', gap: 5, marginBottom: 20 },
  dot: { flex: 1, height: 5, borderRadius: 99 },

  // Photo step
  photoBox: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 20, padding: 40, paddingHorizontal: 20, alignItems: 'center' },
  photoIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  photoTitle: { fontSize: 16, fontWeight: '700' },
  photoDesc: { fontSize: 13, fontWeight: '500', lineHeight: 20, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  photoBtns: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#6D3BEB', paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12 },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12 },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  demoLink: { fontSize: 13, fontWeight: '700', marginTop: 14 },

  // Setup step
  setupWrap: { gap: 14 },
  field: {},
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 7 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 13, paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15 },
  inputUnit: { fontSize: 13, fontWeight: '600' },
  fieldHint: { fontSize: 11.5, fontWeight: '600', lineHeight: 16, marginTop: 7, marginHorizontal: 2 },
  fieldError: { fontSize: 11.5, fontWeight: '700', lineHeight: 16, marginTop: 7, marginHorizontal: 2 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 13, padding: 14, gap: 8 },
  pickerText: { flex: 1, fontSize: 15, fontWeight: '600' },
  pickerCycle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pickerCount: { fontSize: 12, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  twoCol: { flexDirection: 'row', gap: 10 },

  // Scale / Shots
  instruction: { flexDirection: 'row', gap: 9, alignItems: 'center', padding: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 14 },
  instructionText: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  imgContainer: { position: 'relative', borderRadius: 18, overflow: 'hidden', borderWidth: 1, backgroundColor: '#222' },
  targetImg: { position: 'absolute', width: '100%', height: '100%' },
  demoSvg: { position: 'absolute', width: '100%', height: '100%' },
  overlayLine: { position: 'absolute', width: '100%', height: '100%' },
  cornerDot: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#F0872B', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.45, shadowRadius: 5, elevation: 4 },
  cornerDotText: { color: '#fff', fontSize: 11, fontWeight: '800', fontFamily: 'JetBrainsMono_700Bold' },
  shotDot: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(21,16,25,0.55)', borderWidth: 2.5, borderColor: '#8257F0', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  shotDotText: { color: '#fff', fontSize: 10, fontWeight: '800', fontFamily: 'JetBrainsMono_700Bold' },
  shotOverlay: { position: 'absolute', left: 12, bottom: 12, backgroundColor: 'rgba(11,11,16,0.82)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, zIndex: 4 },
  shotOverlayText: { color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  detectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6D3BEB', padding: 13, borderRadius: 13, marginBottom: 10 },
  detectBtnText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
  markModeRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  markModeBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  markModeText: { fontSize: 13, fontWeight: '700' },
  markModeHint: { fontSize: 11.5, fontWeight: '600', marginBottom: 8, lineHeight: 16 },
  detectNote: { borderWidth: 1, borderRadius: 11, padding: 11, paddingHorizontal: 13, marginBottom: 10 },
  detectNoteText: { fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  zoomBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  zoomBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  zoomLabel: { fontSize: 12.5, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold', minWidth: 34, textAlign: 'center' },
  zoomHint: { flex: 1, fontSize: 10.5, fontWeight: '600', textAlign: 'right' },
  scaleFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  scaleCount: { fontSize: 12.5, fontWeight: '600' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resetText: { fontSize: 13, fontWeight: '700' },

  // Review
  reviewCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 16, paddingHorizontal: 18, marginBottom: 14 },
  reviewThumb: { width: 78, height: 78, borderRadius: 12, overflow: 'hidden', borderWidth: 1, backgroundColor: '#222' },
  reviewMsg: { fontSize: 17, fontWeight: '800' },
  reviewSub: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  reviewTile: { flexGrow: 1, flexBasis: '47%', borderWidth: 1, borderRadius: 14, padding: 14 },
  reviewTileLabel: { fontSize: 11, fontWeight: '600' },
  reviewTileVal: { fontSize: 19, fontWeight: '700', marginTop: 5, fontFamily: 'JetBrainsMono_700Bold' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6D3BEB', padding: 16, borderRadius: 14 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6D3BEB', padding: 16, borderRadius: 14, marginTop: 20 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
