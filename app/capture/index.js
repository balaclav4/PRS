import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, StyleSheet, useWindowDimensions, Alert, Platform, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, ImageIcon, ArrowRight, Ruler, Crosshair, RotateCcw, Eraser, Save, ChevronRight, Wand2, LoaderCircle, ZoomIn, ZoomOut, Maximize2, Plus } from 'lucide-react-native';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Polygon, Line } from 'react-native-svg';
import { useTheme, groupColor } from '../../lib/theme';
import { useData } from '../../store/data';
import { computeGroupStats } from '../../lib/math';
import { rectifyToInches, project, orderCorners, perspectiveSeverity } from '../../lib/homography';
import { lightTap, mediumTap, successTap } from '../../lib/haptics';
import { loadGrayscale, imageToNormalized, normalizedToImage, coverScale } from '../../lib/pixels';
import { detectShots, expandPolygon } from '../../lib/detect';
import { fitCircle, circleQuality, circleQuad, BULL_PRESETS } from '../../lib/circlefit';
import { bulletDiameterIn } from '../../lib/calibers';
import { normalizePhoto } from '../../lib/photo';
import { toImage, clampPan, zoomAbout, fitViewport, pinchDistance, pinchCentre } from '../../lib/viewport';
import { quadCentre } from '../../lib/homography';
import { formatGroup, groupUnitLabel, formatDistance } from '../../lib/units';
import { consentIsCurrent } from '../../lib/consent';
import { rowsForStep, stepDimension, variantLabel, variantComponents } from '../../lib/variants';

const STEP_LABELS = ['Photo', 'Setup', 'Corners', 'Mark Shots', 'Review'];
const IMG_ASPECT = 1.25;

export default function CaptureScreen() {
  const { colors } = useTheme();
  const { addSession, rifles, loads, projects, units, trainingConsent } = useData();
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
  // Which load development variant this group is being fired for, if any.
  // Recorded here so the analysis reads measured sessions instead of numbers
  // typed from a notebook.
  const [devProjectId, setDevProjectId] = useState(null);
  const [devStep, setDevStep] = useState(null);
  const [devRowId, setDevRowId] = useState(null);
  const [loadIdx, setLoadIdx] = useState(0);
  const [suppressed, setSuppressed] = useState(true);
  const [sessionName, setSessionName] = useState('');

  // Point of aim. Optional: only a shooter zeroing or truing needs it, so it
  // never blocks saving, but without it point of impact is unmeasurable.
  /**
   * One photo can hold several targets - a sheet of diamonds, a row of bulls.
   * They share the reference and therefore the scale, but each has its own
   * shots and its own point of aim, because each is a separate group.
   *
   * `shots` and `aim` below are views onto the active group, with setters that
   * write through. Everything downstream that already reads them keeps working
   * unchanged, which is what makes this tractable rather than a rewrite.
   */
  const [groups, setGroups] = useState([{ id: 'g' + Date.now(), corners: [], shots: [], aim: null }]);
  const [activeGroup, setActiveGroup] = useState(0);
  const [markMode, setMarkMode] = useState('shot');
  // Which placed corner is being moved. Tap a corner to pick it up, tap the
  // photo to put it down — more reliable than dragging a 24px dot on a zoomed
  // photo, and it works the same whether or not the view is panned.
  const [editingCorner, setEditingCorner] = useState(null);
  // 'quad' corrects perspective from four corners. 'span' takes two points a
  // known distance apart and assumes the photo is square-on. 'bull' fits a
  // circle to taps around a printed bull of known diameter, which is one number
  // instead of two and is usually a better reference than the sheet: the bull
  // lies flat, its printed size is exact, and its centre is where the shooter
  // was actually aiming. It shares span's limitation - a circle carries no
  // perspective information, so an off-axis photo is caught and reported rather
  // than silently mis-scaled.
  const [refMode, setRefMode] = useState('quad');
  const [bullDiameter, setBullDiameter] = useState('3');
  const shots = groups[activeGroup]?.shots ?? [];
  const aim = groups[activeGroup]?.aim ?? null;
  const corners = groups[activeGroup]?.corners ?? [];

  const setCorners = useCallback((updater) => {
    setGroups(prev => prev.map((g, i) => (i === activeGroup
      ? { ...g, corners: typeof updater === 'function' ? updater(g.corners) : updater }
      : g)));
  }, [activeGroup]);

  const setShots = useCallback((updater) => {
    setGroups(prev => prev.map((g, i) => (i === activeGroup
      ? { ...g, shots: typeof updater === 'function' ? updater(g.shots) : updater }
      : g)));
  }, [activeGroup]);

  const setAim = useCallback((updater) => {
    setGroups(prev => prev.map((g, i) => (i === activeGroup
      ? { ...g, aim: typeof updater === 'function' ? updater(g.aim) : updater }
      : g)));
  }, [activeGroup]);

  const addGroup = useCallback(() => {
    setGroups(prev => [...prev, { id: 'g' + Date.now(), corners: [], shots: [], aim: null }]);
    setActiveGroup(prev => prev + 1);
    detectedRef.current = false;
    mediumTap();
  }, []);

  const removeGroup = useCallback((idx) => {
    setGroups(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
    setActiveGroup(prev => (prev >= idx && prev > 0 ? prev - 1 : prev));
  }, []);

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
  // Which marker a drag picked up, if any. Dragging is the reliable way to
  // reposition a point: tapping a marker relies on the tap not also reaching
  // the photo underneath, and that propagation behaves differently on native
  // than on web, which is why moving a point worked in one place and not the
  // other.
  const dragMarkerRef = useRef(null);
  const gestureRef = useRef({ startPan: null, startDist: null, startZoom: 1 });

  // A bull is described by one number, and it is square by definition, so both
  // reference dimensions come from the diameter.
  const bullIn = parseFloat(bullDiameter) || 0;
  const refWIn = refMode === 'bull' ? bullIn : (parseFloat(refW) || 0);
  const refHIn = refMode === 'bull' ? bullIn : (parseFloat(refH) || 0);
  // What the shooter typed, in whatever unit the field shows.
  const distanceEntered = parseFloat(distanceStr) || 0;
  // Yards is the canonical unit every angular calculation needs. Keeping the
  // two separate is the whole point: the field can show metres without every
  // MOA figure silently becoming wrong.
  const distance = units.distance === 'm' ? distanceEntered / 0.9144 : distanceEntered;

  // Continue is disabled on bad input; say why rather than just greying it out.
  const badNum = (raw, parsed) => raw.trim() !== '' && parsed <= 0;
  const refSizeError = refMode === 'bull'
    ? (badNum(bullDiameter, bullIn) ? 'Bull diameter must be a positive number.' : null)
    : (badNum(refW, refWIn) || badNum(refH, refHIn)
        ? 'Width and height must be positive numbers.'
        : null);
  const distanceError = badNum(distanceStr, distanceEntered)
    ? 'Distance must be a positive number.'
    : null;

  // Rifle selection cycles through equipment; loads are scoped to the rifle.
  const rifle = rifles.length ? rifles[rifleIdx % rifles.length] : null;
  const rifleLoads = useMemo(
    () => loads.filter(l => l.rifleId === rifle?.id),
    [loads, rifle]
  );
  const load = rifleLoads.length ? rifleLoads[loadIdx % rifleLoads.length] : null;

  /**
   * Every project, with ones for the selected rifle first.
   *
   * Filtering to the selected rifle hid the picker entirely whenever the rifle
   * did not match, which reads as the feature not existing rather than as a
   * filter doing its job. Ordering conveys the same relevance without removing
   * the option - and a shooter genuinely might fire a ladder with a rifle other
   * than the one recorded on the project.
   */
  const devProjects = useMemo(() => {
    const all = projects || [];
    if (!rifle) return all;
    return [...all].sort((a, b) =>
      (b.rifleId === rifle.id ? 1 : 0) - (a.rifleId === rifle.id ? 1 : 0));
  }, [projects, rifle]);
  const devProject = devProjects.find(pr => pr.id === devProjectId) || null;
  const devRows = useMemo(
    () => (devProject && devStep ? rowsForStep(devProject, devStep) : []),
    [devProject, devStep]
  );
  const devVariant = useMemo(() => {
    if (!devProject || !devRowId) return null;
    const row = devRows.find(r => r.id === devRowId);
    if (!row) return null;
    const baseLoad = loads.find(l => l.id === devProject.loadId) || load;
    return variantComponents(baseLoad, devStep, row);
  }, [devProject, devRows, devRowId, devStep, loads, load]);


  const cycleRifle = () => { setRifleIdx(i => i + 1); setLoadIdx(0); };
  const cycleLoad = () => setLoadIdx(i => i + 1);

  // Suggested name follows the selections, so leaving the field blank still
  // yields something more useful than a bare date.
  const defaultSessionName = rifle
    ? `${rifle.name} · ${distanceEntered || '—'}${units.distance}`
    : 'Session ' + new Date().toLocaleDateString();

  // Four corners of a reference rectangle of known size give both the absolute
  // scale and the perspective correction in one homography — shots project
  // straight to inches on the target plane, no marker sticker needed.
  // Six for a bull rather than a fixed three: three taps determine a circle
  // exactly and therefore cannot reveal that the bull was photographed as an
  // ellipse. Extra taps are what make that check possible, so the mode invites
  // them and reports the fit as soon as three exist.
  const maxRefPoints = refMode === 'span' ? 2 : refMode === 'bull' ? 6 : 4;
  const minRefPoints = refMode === 'span' ? 2 : refMode === 'bull' ? 3 : 4;

  /**
   * Four corners, however they were obtained.
   *
   * Span mode records two points a known width apart and builds the rectangle
   * they imply, using the reference aspect ratio for the perpendicular edge.
   * The result feeds the same homography, so nothing downstream changes — but
   * it encodes an assumption the four-corner path does not make, namely that
   * the photo was taken square-on. Perspective cannot be recovered from two
   * points; there is not enough information in them.
   */
  const quadFrom = useCallback((pts) => {
    if (refMode === 'quad') return pts.length === 4 ? pts : null;
    if (refMode === 'bull') {
      // The bounding square of the fitted circle, which is a D by D rectangle
      // and so joins the existing homography path unchanged. Refused outright
      // when the fit says the bull is too oval to size from, because a scale
      // taken from an ellipse is wrong along one axis and nothing downstream
      // would ever notice.
      const fit = fitCircle(pts);
      return fit && circleQuality(fit).ok ? circleQuad(fit) : null;
    }
    if (pts.length !== 2 || !(refWIn > 0) || !(refHIn > 0)) return null;
    const [a, b] = pts;
    const vx = b.x - a.x, vy = b.y - a.y;
    if (Math.hypot(vx, vy) < 1e-6) return null;
    // Perpendicular, scaled so the rectangle matches the reference aspect.
    const k = (refHIn / refWIn);
    const px = -vy * k, py = vx * k;
    return [a, b, { x: b.x + px, y: b.y + py }, { x: a.x + px, y: a.y + py }];
  }, [refMode, refWIn, refHIn]);

  /** Ordered corners and homography for one target's own reference. */
  const solveFor = useCallback((pts) => {
    const quad = quadFrom(pts || []);
    if (!quad || refWIn <= 0 || refHIn <= 0) return { H: null, ord: null, sev: 0 };
    const ord = orderCorners(quad);
    return { H: rectifyToInches(ord, refWIn, refHIn), ord, sev: perspectiveSeverity(ord) };
  }, [quadFrom, refWIn, refHIn]);

  const refQuad = useMemo(() => quadFrom(corners), [quadFrom, corners]);

  const { Hmat, ordered, severity } = useMemo(() => {
    const { H, ord, sev } = solveFor(corners);
    return { Hmat: H, ordered: ord, severity: sev };
  }, [solveFor, corners]);

  // Seed the aim at the centre of the framed reference as soon as it exists, so
  // the assumption is visible and movable at capture time rather than applied
  // silently when the target is read back.
  //
  // In bull mode this is not an assumption at all: the quad is the circle's
  // bounding square, so its centre is the fitted centre of the bull, which is
  // the thing the shooter was aiming at. That falls out of circleQuad rather
  // than needing a special case, but it is the main reason the mode is worth
  // having over a sheet.
  useEffect(() => {
    if (ordered && !aim) setAim(quadCentre(ordered));
  }, [ordered, aim]);

  // The raw fit, for the setup screen to report on. Kept separate from the quad
  // because the quad is null once quality fails, and that is exactly when there
  // is most to say.
  const bullFit = useMemo(
    () => (refMode === 'bull' ? fitCircle(corners) : null),
    [refMode, corners]
  );
  const bullQuality = useMemo(
    () => (refMode === 'bull' && corners.length >= 3 ? circleQuality(bullFit) : null),
    [refMode, corners.length, bullFit]
  );

  // Shot positions on the target plane, in inches.
  const shotsIn = useMemo(
    () => (Hmat ? shots.map(p => project(Hmat, p)).filter(Boolean) : []),
    [Hmat, shots]
  );
  const stats = computeGroupStats(shotsIn, Hmat ? 1 : null, distance);

  // Every group measured, not just the visible one.
  const groupStats = useMemo(() => groups.map(g => {
    const { H } = solveFor(g.corners);
    if (!H) return null;
    const pts = g.shots.map(p => project(H, p)).filter(Boolean);
    return computeGroupStats(pts, 1, distance);
  }), [groups, solveFor, distance]);

  const savedCount = groups.filter(g => g.shots.length >= 2).length;
  const savedShots = groups.reduce((a, g) => a + (g.shots.length >= 2 ? g.shots.length : 0), 0);
  const scored = groupStats.filter(Boolean);
  const bestStat = scored.length
    ? scored.reduce((a, b) => (b.extremeSpreadIn < a.extremeSpreadIn ? b : a))
    : null;

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

  /**
   * Target selector.
   *
   * Shown at the reference step as well as the shot step, because on a
   * competition face each target has its own edges and centre - the choice of
   * which target you are working on has to come before marking its edges, not
   * after.
   */
  const TargetChips = () => (
    <>
      <View style={s.groupRow}>
        {groups.map((g, i) => {
          const ready = solveFor(g.corners).H;
          return (
            <TouchableOpacity
              key={g.id}
              onPress={() => { setActiveGroup(i); setEditingCorner(null); detectedRef.current = false; }}
              onLongPress={() => removeGroup(i)}
              style={[s.groupChip, {
                backgroundColor: i === activeGroup ? colors.act : colors.card,
                borderColor: i === activeGroup ? colors.act : (ready ? colors.okt : colors.bd),
              }]}
            >
              <Text style={[s.groupChipText, { color: i === activeGroup ? '#fff' : colors.mut }]}>
                Target {i + 1}
                {g.shots.length ? ` · ${g.shots.length}` : (ready ? ' ·' : '')}
                {ready && !g.shots.length ? ' ✓' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={addGroup} style={[s.groupAdd, { borderColor: colors.ibd }]}>
          <Plus size={14} color={colors.act} />
        </TouchableOpacity>
      </View>
      {groups.length > 1 && (
        <Text style={[s.markModeHint, { color: colors.fnt }]}>
          Each target has its own edges, centre and shots, and is measured
          separately. Long-press a chip to remove one.
        </Text>
      )}
    </>
  );

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
      setCorners(prev => {
        // A corner was picked up: put it down here.
        if (editingCorner != null && editingCorner < prev.length) {
          const next = [...prev];
          next[editingCorner] = pt;
          return next;
        }
        // Extra taps are inert rather than restarting — a stray tap past the
        // last point must not silently destroy the calibration.
        return prev.length >= maxRefPoints ? prev : [...prev, pt];
      });
      setEditingCorner(null);
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
  // setShots and setAim are rebound whenever the active target changes. Omitting
  // them here meant every tap wrote to whichever target was selected when the
  // handler was first created, so adding a second target silently kept filling
  // the first.
  }, [IMG_W, editingCorner, maxRefPoints, setShots, setAim]);

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

    onPanResponderGrant: (e) => {
      draggedRef.current = false;
      gestureRef.current = { startPan: pan, startDist: null, startZoom: zoom };
      dragMarkerRef.current = null;

      // Did this touch land on an existing marker? Test in screen space so the
      // hit radius stays a constant finger-sized target at any zoom.
      const { locationX, locationY } = e.nativeEvent;
      if (locationX == null || locationY == null) return;
      const HIT_PX = 26;
      const list = step === 2 ? corners : step === 3 ? shots : [];
      let best = -1, bestD = HIT_PX;
      for (let i = 0; i < list.length; i++) {
        const sx = list[i].x * IMG_W * zoom + pan.x;
        const sy = list[i].y * IMG_W * zoom + pan.y;
        const d = Math.hypot(sx - locationX, sy - locationY);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) {
        dragMarkerRef.current = { kind: step === 2 ? 'corner' : 'shot', index: best };
        if (step === 2) setEditingCorner(best);
      }
    },

    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches;
      const dist = pinchDistance(touches);

      // A marker is being dragged: move it and do not pan the view.
      const held = dragMarkerRef.current;
      if (held && dist == null) {
        if (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2) draggedRef.current = true;
        const { locationX, locationY } = e.nativeEvent;
        if (locationX == null || locationY == null) return;
        const img = toImage({ x: locationX, y: locationY }, zoom, pan);
        const pt = { x: img.x / IMG_W, y: img.y / IMG_W };
        if (!isFinite(pt.x) || !isFinite(pt.y)) return;
        if (held.kind === 'corner') {
          setCorners(prev => prev.map((c, i) => (i === held.index ? pt : c)));
        } else {
          setShots(prev => prev.map((c, i) => (i === held.index ? pt : c)));
        }
        return;
      }

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

    onPanResponderRelease: () => {
      gestureRef.current.startDist = null;
      // A dragged corner is already where it belongs; clear the pick-up state so
      // the next tap on the photo adds a point rather than moving this one.
      if (dragMarkerRef.current?.kind === 'corner' && draggedRef.current) setEditingCorner(null);
      dragMarkerRef.current = null;
    },
    onPanResponderTerminate: () => {
      gestureRef.current.startDist = null;
      dragMarkerRef.current = null;
    },
  }), [zoom, pan, IMG_W, IMG_H, step, corners, shots, setShots]);

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

      // Search only the target the shooter marked.
      //
      // Measured on real photographs this is the largest single source of false
      // positives: an NRA sheet on a cutting mat returned 104 detections for
      // about a dozen holes, and the surplus was the mat's grid, the wall, the
      // staples and a second target in the background. The quad was already
      // being collected here and was being used only for scale.
      //
      // Grown by 15%, because the quad marks the reference rectangle rather
      // than a promise about where every shot landed, and a flyer off the edge
      // is the shot most worth recording. On the measured photo the count is
      // unchanged from 0% to 20% and climbs past 30% as neighbouring bulls come
      // into range.
      const region = expandPolygon(
        ordered.map(p => normalizedToImage(p.x, p.y, width, height, IMG_W, boxH)),
        1.15
      );

      // Corner-derived scale is exact, and a hole cannot be smaller than the
      // bullet, so skip the sub-caliber sweep scale — on the real-photo
      // harness it produced every junction false positive.
      const { shots: found, reason } = detectShots(gray, width, height, {
        radiusPx,
        scales: [1.0, 1.35],
        region,
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
    (step === 3 && groups.some(g => g.shots.length >= 2 && solveFor(g.corners).H));

  const saveAndFinish = async () => {
    await successTap();
    const id = 's' + Date.now();
    // An empty group is one the shooter added and did not use; saving it would
    // create a target with no shots that every downstream statistic has to
    // guard against.
    const savedGroups = groups.filter(g => g.shots.length >= 2 && solveFor(g.corners).H);
    addSession({
      id,
      name: sessionName.trim() || defaultSessionName,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      rifleId: rifle?.id || null,
      loadId: load?.id || null,
      // Canonical yards for every calculation, plus the unit it was entered in.
      // A recorded distance is a fact about that session; changing the app's
      // units later must not rewrite what was shot.
      distanceYd: distance,
      projectId: devProjectId,
      projectStep: devStep,
      projectRowId: devRowId,
      distanceUnit: units.distance,
      suppressed,
      notes: '',
      // Every group from this photo becomes its own target. They share the
      // reference, so they share the scale.
      targets: savedGroups.map(g => ({
        id: g.id,
        shots: g.shots.map(sh => ({ x: sh.x, y: sh.y })),
        // Its own reference, not the active one - each face on the sheet is
        // measured against the edges marked around it.
        scale: (() => {
          const { ord } = solveFor(g.corners);
          return ord ? { corners: ord, widthIn: refWIn, heightIn: refHIn } : null;
        })(),
        aim: g.aim,
        // Recorded at capture, because that is when the decision applied.
        // Enabling contribution later must not reach back over photos taken
        // while it was off.
        contributeConsent: consentIsCurrent(trainingConsent) ? trainingConsent : null,
      })),
      best: bestStat ? bestStat.extremeSpreadIn.toFixed(2) : '—',
      meanRadius: bestStat ? bestStat.meanRadiusIn.toFixed(2) : '—',
      sd: 0,
      mv: 0,
      targetCount: savedGroups.length,
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
            {/* What the scale is taken from. A bull is one number rather than
                two and is usually the better reference: it lies flat, its
                printed diameter is exact, and its centre is the aim point. */}
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mut }]}>Scale reference</Text>
              <View style={s.twoCol}>
                {[['bull', 'Printed bull'], ['quad', 'Sheet, 4 corners'], ['span', 'Known width']].map(([k, label]) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => { setRefMode(k); setCorners([]); }}
                    style={[s.refModeBtn, {
                      backgroundColor: refMode === k ? colors.act : colors.input,
                      borderColor: refMode === k ? colors.act : colors.ibd,
                    }]}
                  >
                    <Text style={[s.refModeText, { color: refMode === k ? '#fff' : colors.mut }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {refMode === 'bull' ? (
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: colors.mut }]}>Bull diameter</Text>
                <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                  <TextInput
                    value={bullDiameter}
                    onChangeText={setBullDiameter}
                    keyboardType="decimal-pad"
                    style={[s.input, { color: colors.tx, fontFamily: 'JetBrainsMono_500Medium' }]}
                  />
                  <Text style={[s.inputUnit, { color: colors.mut }]}>in</Text>
                </View>
                <View style={s.presetRow}>
                  {BULL_PRESETS.map(p => (
                    <TouchableOpacity
                      key={p.inches}
                      onPress={() => setBullDiameter(String(p.inches))}
                      style={[s.presetChip, {
                        backgroundColor: bullIn === p.inches ? colors.acs : colors.input,
                        borderColor: bullIn === p.inches ? colors.act : colors.ibd,
                      }]}
                    >
                      <Text style={[s.presetText, { color: bullIn === p.inches ? colors.act : colors.mut }]}>
                        {p.inches}"
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {refSizeError
                  ? <Text style={[s.fieldError, { color: colors.dngt }]}>{refSizeError}</Text>
                  : <Text style={[s.fieldHint, { color: colors.fnt }]}>
                      The printed diameter of the bull you shot at. Next you'll tap around its edge.
                      The presets are Shoot-N-C sizes; for anything else measure it, because a guessed
                      reference size is a scale error on every number this reads off the photo.
                    </Text>}
              </View>
            ) : (
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
                  : <Text style={[s.fieldHint, { color: colors.fnt }]}>
                      {refMode === 'quad'
                        ? 'The printed size of your target sheet or backer — you\'ll tap its four corners next. Sets the scale and corrects off-axis photos. Letter paper is 8.5 × 11.'
                        : 'The size of whatever you\'ll mark two points across. Assumes the photo is square-on; perspective cannot be recovered from two points.'}
                    </Text>}
              </View>
            )}
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
                  <Text style={[s.inputUnit, { color: colors.mut }]}>{units.distance}</Text>
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

            {/* Load development: pin this group to the variant it tests. */}
            {!!devProjects.length && (
              <View style={[s.devCard, { backgroundColor: colors.card, borderColor: devRowId ? colors.act : colors.bd }]}>
                <Text style={[s.fieldLabel, { color: colors.mut }]}>Load development</Text>

                <View style={s.devChips}>
                  <TouchableOpacity
                    onPress={() => { setDevProjectId(null); setDevStep(null); setDevRowId(null); }}
                    style={[s.devChip, {
                      backgroundColor: devProjectId ? colors.inset : colors.act,
                      borderColor: devProjectId ? colors.ibd : colors.act,
                    }]}
                  >
                    <Text style={[s.devChipText, { color: devProjectId ? colors.mut : '#fff' }]}>Not a test</Text>
                  </TouchableOpacity>
                  {devProjects.map(pr => (
                    <TouchableOpacity
                      key={pr.id}
                      onPress={() => {
                        setDevProjectId(pr.id);
                        setDevStep(pr.currentStep || 6);
                        setDevRowId(null);
                      }}
                      style={[s.devChip, {
                        backgroundColor: devProjectId === pr.id ? colors.act : colors.inset,
                        borderColor: devProjectId === pr.id ? colors.act : colors.ibd,
                      }]}
                    >
                      <Text style={[s.devChipText, { color: devProjectId === pr.id ? '#fff' : colors.mut }]}>
                        {pr.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {!!devProjectId && (
                  <>
                    <Text style={[s.devHint, { color: colors.fnt }]}>
                      Step {devStep} · pick which {stepDimension(devStep)?.noun || 'variant'} this group is
                    </Text>
                    <View style={s.devChips}>
                      {devRows.length === 0 && (
                        <Text style={[s.devHint, { color: colors.fnt }]}>
                          No rows on that step yet. Add them in Load Development first.
                        </Text>
                      )}
                      {devRows.map(row => (
                        <TouchableOpacity
                          key={row.id}
                          onPress={() => setDevRowId(devRowId === row.id ? null : row.id)}
                          style={[s.devChip, {
                            backgroundColor: devRowId === row.id ? colors.act : colors.inset,
                            borderColor: devRowId === row.id ? colors.act : colors.ibd,
                          }]}
                        >
                          <Text style={[s.devChipText, { color: devRowId === row.id ? '#fff' : colors.mut }]}>
                            {variantLabel(devStep, row)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {!!devVariant && (
                  <Text style={[s.devHint, { color: colors.act }]}>
                    {[devVariant.bullet, devVariant.powder, devVariant.charge ? `${devVariant.charge} gr` : null,
                      devVariant.primer, devVariant.cbto ? `${devVariant.cbto}" CBTO` : null]
                      .filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Step 2: Corners */}
        {step === 2 && (
          <View>
            <TargetChips />
            <View style={s.markModeRow}>
              {[['bull', 'Bull'], ['quad', '4 corners'], ['span', '2 points']].map(([k, label]) => (
                <TouchableOpacity
                  key={k}
                  onPress={() => { setRefMode(k); setCorners([]); setEditingCorner(null); }}
                  style={[s.markModeBtn, {
                    backgroundColor: refMode === k ? colors.act : colors.card,
                    borderColor: refMode === k ? colors.act : colors.bd,
                  }]}
                >
                  <Text style={[s.markModeText, { color: refMode === k ? '#fff' : colors.mut }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[s.instruction, { backgroundColor: colors.acs }]}>
              <Ruler size={17} color={colors.act} />
              <Text style={[s.instructionText, { color: colors.act }]}>
                {editingCorner != null
                  ? `Moving point ${editingCorner + 1} — tap where it should go.`
                  : refMode === 'bull'
                    ? (corners.length < 3
                        ? `Tap around the edge of the ${bullDiameter}″ bull — at least three, spread right around it rather than bunched on one side.`
                        : `${corners.length} on the rim. A fourth and beyond let the fit check whether the bull was round in the photo; three cannot. Tap a point to move it.`)
                    : refMode === 'span'
                      ? `Tap the two ends of the ${refW}″ edge. Faster, but it assumes the photo is square-on — it cannot correct for angle.`
                      : `Tap the four corners of your ${refW}″ × ${refH}″ reference, in any order. Tap a placed corner to move it.`}
              </Text>
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
                <TouchableOpacity
                  key={i}
                  onPress={(e) => { e.stopPropagation(); setEditingCorner(editingCorner === i ? null : i); mediumTap(); }}
                  style={[
                    s.cornerDot,
                    { left: p.x * IMG_W * zoom + pan.x - 12, top: p.y * IMG_W * zoom + pan.y - 12 },
                    editingCorner === i && s.cornerDotEditing,
                  ]}
                >
                  <Text style={s.cornerDotText}>{i + 1}</Text>
                </TouchableOpacity>
              ))}
            </TouchableOpacity>
            {Hmat && severity > 0.04 && (
              <View style={[s.detectNote, { backgroundColor: colors.acs, borderColor: colors.acs, marginTop: 10, marginBottom: 0 }]}>
                <Text style={[s.detectNoteText, { color: colors.act }]}>
                  Off-axis photo detected ({(severity * 100).toFixed(0)}% skew) — measurements are perspective-corrected.
                </Text>
              </View>
            )}
            {/* What the fitted bull says about itself. A circle has no
                perspective information in it, so this verdict is the only thing
                standing between an off-axis photo and a scale that is quietly
                wrong along one axis. */}
            {bullQuality && (
              <View style={[s.detectNote, {
                backgroundColor: bullQuality.ok
                  ? (bullQuality.level === 'good' ? colors.oks : colors.warns)
                  : colors.dngs,
                borderColor: 'transparent', marginTop: 10, marginBottom: 0,
              }]}>
                <Text style={[s.detectNoteText, {
                  color: bullQuality.ok
                    ? (bullQuality.level === 'good' ? colors.okt : colors.warnt)
                    : colors.dngt,
                }]}>
                  {bullQuality.text}
                </Text>
                {bullFit && bullQuality.level !== 'arc' && (
                  <Text style={[s.detectNoteText, { color: colors.mut, marginTop: 4 }]}>
                    {/* The fit works in normalized tap space, where both axes
                        are divided by the box width, so a radius has to be
                        multiplied back up to mean anything on screen. Printed
                        raw it read "1px". */}
                    {bullDiameter}″ across {(2 * bullFit.radius * IMG_W).toFixed(0)}px,
                    from {bullFit.count} taps, widest gap {bullFit.maxGapDeg}°.
                  </Text>
                )}
              </View>
            )}
            {refMode !== 'bull' && corners.length === maxRefPoints && !Hmat && (
              <View style={[s.detectNote, { backgroundColor: colors.inset, borderColor: colors.ibd, marginTop: 10, marginBottom: 0 }]}>
                <Text style={[s.detectNoteText, { color: colors.mut }]}>
                  Those points don't form a usable reference. Tap one to move it, or Reset.
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
                <Text style={{ color: colors.tx, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' }}>{corners.length}</Text>
                {refMode === 'bull' ? ` rim taps, ${minRefPoints} minimum` : `/${maxRefPoints} ${refMode === 'span' ? 'points' : 'corners'} set`}
              </Text>
              <TouchableOpacity onPress={() => { setCorners([]); setEditingCorner(null); }} style={s.resetBtn}>
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
            <TargetChips />
            <View style={{ display: 'none' }}>
              {groups.map((g, i) => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => { setActiveGroup(i); detectedRef.current = false; }}
                  onLongPress={() => removeGroup(i)}
                  style={[s.groupChip, {
                    backgroundColor: i === activeGroup ? colors.act : colors.card,
                    borderColor: i === activeGroup ? colors.act : colors.bd,
                  }]}
                >
                  <Text style={[s.groupChipText, { color: i === activeGroup ? '#fff' : colors.mut }]}>
                    Target {i + 1}{g.shots.length ? ` · ${g.shots.length}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
              {groups.map((g, gi) => (gi === activeGroup ? null : g.shots.map((p, i) => (
                <View
                  key={`${g.id}-${i}`}
                  pointerEvents="none"
                  style={[s.shotDot, {
                    width: dotSize, height: dotSize, borderRadius: dotSize / 2,
                    left: p.x * IMG_W * zoom + pan.x - dotSize / 2,
                    top: p.y * IMG_W * zoom + pan.y - dotSize / 2,
                    opacity: 0.28,
                  }]}
                />
              ))))}
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
                  {capGood ? 'Tight group!' : (savedCount ? (savedCount > 1 ? `${savedCount} groups measured` : 'Group measured') : 'Mark at least 2 shots')}
                </Text>
                <Text style={[s.reviewSub, { color: colors.mut }]}>
                  <Text style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{savedShots}</Text> shots
                  {savedCount > 1 ? ` across ${savedCount} targets` : ''} · best{' '}
                  <Text style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{bestStat ? formatGroup(bestStat.extremeSpreadIn, distance, units.group) : '—'}</Text>
                </Text>
              </View>
            </View>

            {savedCount > 1 && (
              <View style={[s.perTarget, { backgroundColor: colors.inset }]}>
                {groups.map((g, i) => {
                  const st = groupStats[i];
                  if (g.shots.length < 2) return null;
                  return (
                    <View key={g.id} style={s.perTargetRow}>
                      <Text style={[s.perTargetLabel, { color: colors.mut }]}>Target {i + 1}</Text>
                      <Text style={[s.perTargetVal, { color: colors.tx }]}>
                        {g.shots.length} shots · {st ? formatGroup(st.extremeSpreadIn, distance, units.group) : '—'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={s.reviewGrid}>
              {[
                [`BEST GROUP (${groupUnitLabel(units.group)})`,
                  bestStat ? formatGroup(bestStat.extremeSpreadIn, distance, units.group, { withUnit: false }) : '—'],
                // The complement: an angle alone hides how big the group is, an
                // absolute length alone hides how it compares across distances.
                units.group === 'Inches'
                  ? ['BEST MOA', bestStat ? bestStat.groupMoa.toFixed(2) : '—']
                  : ['BEST SIZE', bestStat ? formatGroup(bestStat.extremeSpreadIn, distance, 'Inches') : '—'],
                [`MEAN RADIUS (${groupUnitLabel(units.group)})`,
                  bestStat ? formatGroup(bestStat.meanRadiusIn, distance, units.group, { withUnit: false }) : '—'],
                [savedCount > 1 ? 'TARGETS' : 'SHOTS', savedCount > 1 ? String(savedCount) : String(savedShots)],
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
  refModeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  refModeText: { fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  presetChip: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1 },
  presetText: { fontSize: 12, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  markModeRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  devCard: { marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1, gap: 9 },
  devChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  devChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1 },
  devChipText: { fontSize: 12, fontWeight: '700' },
  devHint: { fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  groupRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 },
  groupChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1 },
  groupChipText: { fontSize: 12, fontWeight: '700' },
  groupAdd: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  cornerDotEditing: { borderColor: '#12B76A', borderWidth: 3, transform: [{ scale: 1.25 }] },
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
  perTarget: { padding: 12, borderRadius: 12, gap: 7, marginBottom: 12 },
  perTargetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  perTargetLabel: { fontSize: 12, fontWeight: '700' },
  perTargetVal: { fontSize: 12.5, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  reviewTile: { flexGrow: 1, flexBasis: '47%', borderWidth: 1, borderRadius: 14, padding: 14 },
  reviewTileLabel: { fontSize: 11, fontWeight: '600' },
  reviewTileVal: { fontSize: 19, fontWeight: '700', marginTop: 5, fontFamily: 'JetBrainsMono_700Bold' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6D3BEB', padding: 16, borderRadius: 14 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6D3BEB', padding: 16, borderRadius: 14, marginTop: 20 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
