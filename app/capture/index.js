import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, StyleSheet, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, ImageIcon, ArrowRight, Ruler, Crosshair, RotateCcw, Eraser, Save, ChevronRight, Wand2, LoaderCircle } from 'lucide-react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Line } from 'react-native-svg';
import { useTheme, groupColor } from '../../lib/theme';
import { useData } from '../../store/data';
import { computeScale, computeGroupStats } from '../../lib/math';
import { lightTap, mediumTap, successTap } from '../../lib/haptics';
import { loadGrayscale, imageToNormalized, coverScale } from '../../lib/pixels';
import { detectShots } from '../../lib/detect';
import { bulletDiameterIn } from '../../lib/calibers';

const STEP_LABELS = ['Photo', 'Setup', 'Scale', 'Mark Shots', 'Review'];
const { width: SCREEN_W } = Dimensions.get('window');
const IMG_W = SCREEN_W - 40;

export default function CaptureScreen() {
  const { colors } = useTheme();
  const { addSession, rifles, loads } = useData();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [useDemo, setUseDemo] = useState(false);
  const [targetDia, setTargetDia] = useState('1.0');
  const [distance, setDistance] = useState(100);
  const [scalePts, setScalePts] = useState([]);
  const [shots, setShots] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [detectNote, setDetectNote] = useState(null);

  const dia = parseFloat(targetDia) || 1;
  const hasScale = scalePts.length === 2;
  const inchPerUnit = hasScale ? computeScale(scalePts[0], scalePts[1], dia) : null;
  const stats = computeGroupStats(shots, inchPerUnit, distance);

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      setUseDemo(false);
      setStep(1);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera Permission', 'Camera access is needed to photograph targets.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      setUseDemo(false);
      setStep(1);
    }
  }, []);

  const onTapImage = useCallback((e, mode) => {
    const ne = e.nativeEvent || e;
    const locationX = ne.locationX ?? ne.offsetX;
    const locationY = ne.locationY ?? ne.offsetY;
    if (locationX == null || locationY == null) return;
    // Both axes divide by the same reference length. Dividing y by the box
    // height instead made the coordinate space anisotropic, so hypot() mixed
    // units and vertical distances measured 20% short.
    const x = locationX / IMG_W;
    const y = locationY / IMG_W;
    if (!isFinite(x) || !isFinite(y)) return;
    const pt = { x, y };

    if (mode === 'scale') {
      setScalePts(prev => prev.length >= 2 ? [pt] : [...prev, pt]);
      mediumTap();
    } else {
      setShots(prev => [...prev, pt]);
      lightTap();
    }
  }, []);

  const removeShot = (i) => setShots(prev => prev.filter((_, j) => j !== i));

  /**
   * Find bullet holes automatically.
   *
   * Needs the scale first: the caliber gives the hole's real diameter, and the
   * scale converts that to pixels, which is the prior the detector runs on.
   */
  const autoDetect = useCallback(async () => {
    if (!photo || !inchPerUnit) return;
    setDetecting(true);
    setDetectNote(null);
    try {
      const { gray, width, height } = await loadGrayscale(photo);
      const boxH = IMG_W * 1.25;
      const k = coverScale(width, height, IMG_W, boxH);

      const caliberText = loads[0]?.caliber || rifles[0]?.cartridge;
      const { diameterIn, matched } = bulletDiameterIn(caliberText);

      // inches -> normalized units -> display px -> source-image px
      const radiusPx = ((diameterIn / inchPerUnit) * IMG_W / k) / 2;

      const { shots: found, reason } = detectShots(gray, width, height, { radiusPx });

      if (!found.length) {
        setDetectNote(reason || 'No holes found — mark them manually.');
      } else {
        setShots(found.map(f => imageToNormalized(f.x, f.y, width, height, IMG_W, boxH)));
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
  }, [photo, inchPerUnit, loads, rifles]);

  const canNext = step === 1 || (step === 2 && hasScale) || (step === 3 && shots.length >= 2);

  const saveAndFinish = async () => {
    await successTap();
    const id = 's' + Date.now();
    addSession({
      id,
      name: 'Session ' + new Date().toLocaleDateString(),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      rifleId: rifles[0]?.id || 'r1',
      loadId: loads[0]?.id || 'l1',
      distanceYd: distance,
      suppressed: true,
      notes: '',
      targets: [{ id: 't' + Date.now(), shots: shots.map(s => ({ x: s.x, y: s.y })) }],
      best: stats ? stats.extremeSpreadIn.toFixed(2) : '—',
      meanRadius: stats ? stats.meanRadiusIn.toFixed(2) : '—',
      sd: 0,
      mv: 0,
      targetCount: 1,
    });
    router.back();
  };

  const capGood = stats && stats.groupMoa <= 0.5;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => step > 0 ? setStep(step - 1) : router.back()}
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
            <Text style={[s.photoDesc, { color: colors.mut }]}>Photograph your target with an orange{'\n'}marker sticker of known diameter</Text>
            <View style={s.photoBtns}>
              <TouchableOpacity onPress={takePhoto} style={s.primaryBtn}>
                <Camera size={16} color="#fff" />
                <Text style={s.primaryBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickPhoto} style={[s.secondaryBtn, { backgroundColor: colors.acs }]}>
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
              <Text style={[s.fieldLabel, { color: colors.mut }]}>Marker / Target Diameter</Text>
              <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                <TextInput
                  value={targetDia}
                  onChangeText={setTargetDia}
                  keyboardType="decimal-pad"
                  style={[s.input, { color: colors.tx, fontFamily: 'JetBrainsMono_500Medium' }]}
                />
                <Text style={[s.inputUnit, { color: colors.mut }]}>inches</Text>
              </View>
              <Text style={[s.fieldHint, { color: colors.fnt }]}>Used as the scale reference — you'll mark this diameter on the photo next.</Text>
            </View>
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mut }]}>Rifle</Text>
              <View style={[s.picker, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                <Text style={[s.pickerText, { color: colors.tx }]}>{rifles[0]?.name || 'Select'} · {rifles[0]?.cartridge || ''}</Text>
                <ChevronRight size={18} color={colors.fnt} />
              </View>
            </View>
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mut }]}>Load</Text>
              <View style={[s.picker, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                <Text style={[s.pickerText, { color: colors.tx }]}>{loads[0]?.name || 'Select'}</Text>
                <ChevronRight size={18} color={colors.fnt} />
              </View>
            </View>
            <View style={s.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mut }]}>Distance</Text>
                <View style={[s.picker, { backgroundColor: colors.input, borderColor: colors.ibd }]}>
                  <Text style={[s.pickerText, { color: colors.tx, fontFamily: 'JetBrainsMono_700Bold' }]}>{distance} yd</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mut }]}>Suppressor</Text>
                <View style={[s.picker, { backgroundColor: colors.acs, borderColor: colors.acs }]}>
                  <Text style={[s.pickerText, { color: colors.act, fontWeight: '700' }]}>Yes</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Step 2: Scale */}
        {step === 2 && (
          <View>
            <View style={[s.instruction, { backgroundColor: colors.acs }]}>
              <Ruler size={17} color={colors.act} />
              <Text style={[s.instructionText, { color: colors.act }]}>Tap the two opposite edges of your marker to set the scale.</Text>
            </View>
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => onTapImage(e, 'scale')}
              style={[s.imgContainer, { borderColor: colors.bd }]}
            >
              {photo ? (
                <Image source={{ uri: photo }} style={s.targetImg} resizeMode="cover" />
              ) : useDemo ? (
                <Svg viewBox="0 0 320 400" style={s.demoSvg}>
                  <Circle cx="160" cy="185" r="92" fill="rgba(255,138,42,0.28)" stroke="#F0872B" strokeWidth="3" />
                  <Circle cx="160" cy="185" r="3.5" fill="#F0872B" />
                </Svg>
              ) : null}
              {hasScale && isFinite(scalePts[0].x) && isFinite(scalePts[1].x) && (
                <Svg viewBox="0 0 100 100" preserveAspectRatio="none" style={s.overlayLine}>
                  <Line
                    x1={scalePts[0].x * 100} y1={scalePts[0].y * 100}
                    x2={scalePts[1].x * 100} y2={scalePts[1].y * 100}
                    stroke="#F0872B" strokeWidth="1.5" strokeDasharray="3 2" vectorEffect="non-scaling-stroke"
                  />
                </Svg>
              )}
              {scalePts.map((p, i) => (
                <View key={i} style={[s.scaleDot, { left: p.x * IMG_W - 9, top: p.y * IMG_W - 9 }]} />
              ))}
            </TouchableOpacity>
            <View style={s.scaleFooter}>
              <Text style={[s.scaleCount, { color: colors.mut }]}>
                <Text style={{ color: colors.tx, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' }}>{scalePts.length}</Text>/2 edge points set
              </Text>
              <TouchableOpacity onPress={() => setScalePts([])} style={s.resetBtn}>
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
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => onTapImage(e, 'shots')}
              style={[s.imgContainer, { borderColor: colors.bd }]}
            >
              {photo ? (
                <Image source={{ uri: photo }} style={s.targetImg} resizeMode="cover" />
              ) : useDemo ? (
                <Svg viewBox="0 0 320 400" style={s.demoSvg}>
                  <Circle cx="160" cy="185" r="92" fill="rgba(255,138,42,0.28)" stroke="#F0872B" strokeWidth="3" />
                  <Circle cx="160" cy="185" r="3.5" fill="#F0872B" />
                </Svg>
              ) : null}
              {shots.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={(e) => { e.stopPropagation(); removeShot(i); }}
                  style={[s.shotDot, { left: p.x * IMG_W - 12, top: p.y * IMG_W - 12 }]}
                >
                  <Text style={s.shotDotText}>{i + 1}</Text>
                </TouchableOpacity>
              ))}
              <View style={s.shotOverlay}>
                <Text style={s.shotOverlayText}>
                  {shots.length} shots · {stats ? stats.extremeSpreadIn.toFixed(2) : '—'}"
                </Text>
              </View>
            </TouchableOpacity>
            <View style={s.scaleFooter}>
              <Text style={[s.scaleCount, { color: colors.mut }]}>
                Live group <Text style={{ color: colors.tx, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' }}>{stats ? stats.groupMoa.toFixed(2) : '—'} MOA</Text>
              </Text>
              <TouchableOpacity onPress={() => setShots([])} style={s.resetBtn}>
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
                {photo && <Image source={{ uri: photo }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />}
              </View>
              <View>
                <Text style={[s.reviewMsg, { color: capGood ? colors.okt : colors.tx }]}>
                  {capGood ? 'Tight group!' : (shots.length >= 2 ? 'Group measured' : 'Mark at least 2 shots')}
                </Text>
                <Text style={[s.reviewSub, { color: colors.mut }]}>
                  <Text style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{shots.length}</Text> shots · <Text style={{ fontFamily: 'JetBrainsMono_700Bold' }}>{stats ? stats.extremeSpreadIn.toFixed(2) : '—'}"</Text> extreme spread
                </Text>
              </View>
            </View>

            <View style={s.reviewGrid}>
              {[
                ['GROUP SIZE', stats ? stats.extremeSpreadIn.toFixed(2) + '"' : '—'],
                ['GROUP MOA', stats ? stats.groupMoa.toFixed(2) : '—'],
                ['MEAN RADIUS', stats ? stats.meanRadiusIn.toFixed(2) + '"' : '—'],
                ['SHOTS', String(shots.length)],
              ].map(([label, val], i) => (
                <View key={i} style={[s.reviewTile, { backgroundColor: colors.card, borderColor: colors.bd }]}>
                  <Text style={[s.reviewTileLabel, { color: colors.mut }]}>{label}</Text>
                  <Text style={[s.reviewTileVal, { color: colors.tx }]}>{val}</Text>
                </View>
              ))}
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
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 13, padding: 14 },
  pickerText: { fontSize: 15, fontWeight: '600' },
  twoCol: { flexDirection: 'row', gap: 10 },

  // Scale / Shots
  instruction: { flexDirection: 'row', gap: 9, alignItems: 'center', padding: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 14 },
  instructionText: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  imgContainer: { position: 'relative', borderRadius: 18, overflow: 'hidden', borderWidth: 1, width: IMG_W, height: IMG_W * 1.25, backgroundColor: '#222' },
  targetImg: { position: 'absolute', width: '100%', height: '100%' },
  demoSvg: { position: 'absolute', width: '100%', height: '100%' },
  overlayLine: { position: 'absolute', width: '100%', height: '100%' },
  scaleDot: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#F0872B', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.45, shadowRadius: 5, elevation: 4 },
  shotDot: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(21,16,25,0.55)', borderWidth: 2.5, borderColor: '#8257F0', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  shotDotText: { color: '#fff', fontSize: 10, fontWeight: '800', fontFamily: 'JetBrainsMono_700Bold' },
  shotOverlay: { position: 'absolute', left: 12, bottom: 12, backgroundColor: 'rgba(11,11,16,0.82)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, zIndex: 4 },
  shotOverlayText: { color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: 'JetBrainsMono_700Bold' },
  detectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6D3BEB', padding: 13, borderRadius: 13, marginBottom: 10 },
  detectBtnText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
  detectNote: { borderWidth: 1, borderRadius: 11, padding: 11, paddingHorizontal: 13, marginBottom: 10 },
  detectNoteText: { fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
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
  reviewTile: { width: (IMG_W - 10) / 2, borderWidth: 1, borderRadius: 14, padding: 14 },
  reviewTileLabel: { fontSize: 11, fontWeight: '600' },
  reviewTileVal: { fontSize: 19, fontWeight: '700', marginTop: 5, fontFamily: 'JetBrainsMono_700Bold' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6D3BEB', padding: 16, borderRadius: 14 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6D3BEB', padding: 16, borderRadius: 14, marginTop: 20 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
