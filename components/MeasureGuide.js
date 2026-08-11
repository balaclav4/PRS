import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Line, Polygon, Circle, Text as SvgText, Rect } from 'react-native-svg';
import { useState } from 'react';
import { useTheme } from '../lib/theme';
import { ChevronDown, Ruler } from 'lucide-react-native';

/**
 * Diagrams that explain what to measure, next to the box you type it into.
 *
 * Most bad load development data is entered correctly and measured wrong. COAL
 * typed into a CBTO field is the classic: nothing downstream can tell, every
 * seating conclusion is quietly built on it, and the numbers look perfectly
 * reasonable the whole way. The statistics in this app are careful about what
 * they claim; this is the same care applied one step earlier, to whether the
 * number meant what the field thinks it means.
 *
 * Drawn rather than photographed, for three reasons. They theme with the rest
 * of the app instead of being a light-mode image on a dark screen. They stay
 * sharp at any size. And a diagram drawn here is unambiguously ours - a scan
 * out of a reloading manual would be the one thing docs/METHODS.md exists to
 * prevent.
 *
 * Each guide names the tool the measurement actually needs. A diagram that
 * teaches a measurement without saying what it is measured *with* invites
 * someone to do it with a ruler, and the whole point is that these dimensions
 * are decided in thousandths.
 */

// Everything is drawn in a 300-wide space with the cartridge on this axis.
const VB_W = 300;
const CY = 56;

/**
 * Half-height of a bottleneck rifle cartridge along its length.
 *
 * One profile shared by every diagram, so the same cartridge is recognisably
 * the same object from one guide to the next - the reader should not have to
 * re-learn the picture each time. Proportions are a generic bottleneck case,
 * not any particular cartridge, because these guides are about *where* a
 * dimension is taken rather than what it should read.
 */
function cartridgeProfile() {
  const pts = [
    [14, 19],   // rim
    [22, 19],
    [22, 17.5], // extractor groove step
    [26, 17.5],
    [26, 18],
    [96, 17],   // body, very slightly tapered
    [116, 9.6], // shoulder
    [140, 9.6], // neck
  ];
  // Bullet: bearing surface, then an ogive sampled as an arc to the meplat.
  pts.push([140, 8.8], [168, 8.8]);
  const x0 = 168, x1 = 236, h0 = 8.8;
  for (let i = 1; i <= 14; i++) {
    const t = i / 14;
    pts.push([x0 + (x1 - x0) * t, Math.max(1.5, h0 * Math.sqrt(Math.max(0, 1 - t * t * 0.97)))]);
  }
  return pts;
}

/** Closed outline from a half-profile, mirrored about the centreline. */
function outlinePath(profile) {
  const top = profile.map(([x, h], i) => `${i ? 'L' : 'M'} ${x} ${CY - h}`).join(' ');
  const bottom = [...profile].reverse().map(([x, h]) => `L ${x} ${CY + h}`).join(' ');
  return `${top} ${bottom} Z`;
}

const PROFILE = cartridgeProfile();
const OUTLINE = outlinePath(PROFILE);

/** Where the case mouth sits, so bullet and case can be drawn separately. */
const MOUTH_X = 140;
const HEAD_X = 14;
const TIP_X = 236;
const SHOULDER_X = 116;
/** The ogive datum: where a comparator insert contacts the bullet. */
const OGIVE_DATUM_X = 178;

/** Top of the drawn profile at an x, so things can be placed against it. */
function ogiveTopAt(x) {
  let best = PROFILE[0];
  for (const p of PROFILE) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
  return CY - best[1];
}

function Cartridge({ colors, caseFill, bulletFill, dim = false }) {
  const caseProfile = PROFILE.filter(([x]) => x <= MOUTH_X);
  const bulletProfile = PROFILE.filter(([x]) => x >= MOUTH_X);
  return (
    <>
      <Path d={outlinePath(caseProfile)} fill={caseFill || colors.inset}
        stroke={colors.mut} strokeWidth={1.2} opacity={dim ? 0.45 : 1} />
      <Path d={outlinePath(bulletProfile)} fill={bulletFill || colors.ring}
        stroke={colors.mut} strokeWidth={1.2} opacity={dim ? 0.45 : 1} />
    </>
  );
}

/**
 * A dimension line: arrows at both ends, extension lines, a label.
 *
 * Arrowheads are polygons rather than SVG markers, which react-native-svg does
 * not render.
 */
function Dim({ x1, x2, y, label, colors, accent, above = false, tickTop, tickBottom }) {
  const c = accent || colors.act;
  const a = 4;
  const ly = above ? y - 5 : y + 11;
  return (
    <>
      {tickTop != null && <Line x1={x1} y1={tickTop} x2={x1} y2={y} stroke={c} strokeWidth={0.7} strokeDasharray="2 2" />}
      {tickTop != null && <Line x1={x2} y1={tickTop} x2={x2} y2={y} stroke={c} strokeWidth={0.7} strokeDasharray="2 2" />}
      {tickBottom != null && <Line x1={x1} y1={y} x2={x1} y2={tickBottom} stroke={c} strokeWidth={0.7} strokeDasharray="2 2" />}
      {tickBottom != null && <Line x1={x2} y1={y} x2={x2} y2={tickBottom} stroke={c} strokeWidth={0.7} strokeDasharray="2 2" />}
      <Line x1={x1} y1={y} x2={x2} y2={y} stroke={c} strokeWidth={1.3} />
      <Polygon points={`${x1},${y} ${x1 + a},${y - a / 1.6} ${x1 + a},${y + a / 1.6}`} fill={c} />
      <Polygon points={`${x2},${y} ${x2 - a},${y - a / 1.6} ${x2 - a},${y + a / 1.6}`} fill={c} />
      <SvgText x={(x1 + x2) / 2} y={ly} fontSize="9" fontWeight="700"
        textAnchor="middle" fill={c}>{label}</SvgText>
    </>
  );
}

/** A label with a leader line to the thing it names. */
function Callout({ x, y, tx, ty, label, colors, anchor = 'middle' }) {
  return (
    <>
      <Line x1={x} y1={y} x2={tx} y2={ty} stroke={colors.fnt} strokeWidth={0.7} />
      <Circle cx={x} cy={y} r={1.6} fill={colors.fnt} />
      <SvgText x={tx} y={ty + (ty < y ? -3 : 8)} fontSize="8" textAnchor={anchor}
        fill={colors.mut}>{label}</SvgText>
    </>
  );
}

// ---------------------------------------------------------------- diagrams

function Anatomy({ colors }) {
  return (
    <Svg viewBox="0 0 300 118" style={[s.svg, { aspectRatio: 300 / 118 }]}>
      <Cartridge colors={colors} />
      <Callout x={18} y={CY + 19} tx={26} ty={104} label="head" colors={colors} />
      <Callout x={24} y={CY + 17.5} tx={72} ty={104} label="extractor groove" colors={colors} />
      <Callout x={60} y={CY - 17.4} tx={60} ty={16} label="body" colors={colors} />
      <Callout x={SHOULDER_X - 8} y={CY - 13} tx={126} ty={14} label="shoulder" colors={colors} />
      <Callout x={128} y={CY - 9.6} tx={158} ty={26} label="neck" colors={colors} />
      <Callout x={MOUTH_X} y={CY + 9.6} tx={140} ty={104} label="case mouth" colors={colors} />
      <Callout x={200} y={CY - 6.5} tx={206} ty={20} label="ogive" colors={colors} />
      <Callout x={TIP_X} y={CY} tx={266} ty={92} label="meplat (tip)" colors={colors} />
    </Svg>
  );
}

function CbtoVsCoal({ colors }) {
  return (
    <Svg viewBox="0 0 300 132" style={[s.svg, { aspectRatio: 300 / 132 }]}>
      <Cartridge colors={colors} />
      {/* The comparator insert, drawn *touching* the ogive.
          It floated a few units clear at first, which quietly undid the point
          of the diagram: the whole idea is that the datum is wherever the
          insert makes contact, so a gap says the opposite. Seated against the
          profile height at that x. */}
      <Rect x={OGIVE_DATUM_X - 3} y={ogiveTopAt(OGIVE_DATUM_X) - 13} width={6} height={13} rx={1}
        fill={colors.acs} stroke={colors.act} strokeWidth={1} />
      <SvgText x={OGIVE_DATUM_X} y={ogiveTopAt(OGIVE_DATUM_X) - 16} fontSize="7.5"
        textAnchor="middle" fill={colors.act}>comparator</SvgText>

      <Dim x1={HEAD_X} x2={TIP_X} y={112} label="COAL — base to tip"
        colors={colors} accent={colors.mut} tickTop={CY + 20} />
      <Dim x1={HEAD_X} x2={OGIVE_DATUM_X} y={92} label="CBTO — base to ogive"
        colors={colors} accent={colors.act} tickTop={CY + 20} />
    </Svg>
  );
}

function Jump({ colors }) {
  /**
   * Where the rifling starts — *ahead* of the seated bullet, which is the whole
   * geometry of the thing. The first version drew the throat behind the tip, so
   * the bullet sat engraved in the lands while a dimension line claimed to
   * measure the gap to them. A diagram that contradicts its own label teaches
   * the reader nothing except that the app is careless.
   */
  const throatX = 250;
  return (
    <Svg viewBox="0 0 300 134" style={[s.svg, { aspectRatio: 300 / 134 }]}>
      {/* Chamber, stepping down to the throat and bore. */}
      <Path d={`M 4 ${CY - 34} L ${throatX} ${CY - 34} L ${throatX} ${CY - 10} L 296 ${CY - 10}`}
        fill="none" stroke={colors.mut} strokeWidth={1.4} />
      <Path d={`M 4 ${CY + 34} L ${throatX} ${CY + 34} L ${throatX} ${CY + 10} L 296 ${CY + 10}`}
        fill="none" stroke={colors.mut} strokeWidth={1.4} />
      {/* Rifling, beginning at the throat. */}
      {[0, 1, 2, 3, 4].map(i => (
        <Line key={i} x1={throatX + 2 + i * 9} y1={CY - 10} x2={throatX + 6 + i * 9} y2={CY - 6}
          stroke={colors.act} strokeWidth={1.1} />
      ))}
      <SvgText x={296} y={CY - 38} fontSize="8" textAnchor="end" fill={colors.mut}>lands (rifling)</SvgText>

      <Cartridge colors={colors} />

      {/* The gap: nose of the bullet to the start of the rifling. */}
      <Dim x1={TIP_X} x2={throatX} y={CY + 46} label="jump" colors={colors}
        accent={colors.warnt} tickTop={CY + 12} />
      <SvgText x={150} y={128} fontSize="8" textAnchor="middle" fill={colors.fnt}>
        recorded as a CBTO difference, never measured from the tip
      </SvgText>
    </Svg>
  );
}

function ShoulderBump({ colors }) {
  // Two cases, one fired and one sized, sharing a datum line.
  const fired = PROFILE.filter(([x]) => x <= MOUTH_X);
  /**
   * The set-back, drawn far larger than life.
   *
   * A real bump is one or two thousandths on a case two inches long - about one
   * part in a thousand, which at this scale is a third of a pixel and invisible.
   * Drawn to scale the two cases would sit exactly on top of each other and the
   * diagram would teach nothing, so the offset is exaggerated and the caption
   * says so rather than letting the reader infer a magnitude from the picture.
   */
  const OFFSET = 11;
  const sized = fired.map(([x, h]) => [x >= 96 ? x - OFFSET : x, h]);
  const datumX = 106;
  return (
    <Svg viewBox="0 0 300 154" style={[s.svg, { aspectRatio: 300 / 154 }]}>
      {/* Fired case, above. */}
      <Path d={outlinePath(fired)} fill="none" stroke={colors.mut} strokeWidth={1.2}
        transform="translate(20,-22)" />
      <SvgText x={12} y={CY - 22} fontSize="8" fill={colors.mut}>fired</SvgText>
      {/* Sized case, below, shoulder set back. */}
      <Path d={outlinePath(sized)} fill="none" stroke={colors.act} strokeWidth={1.2}
        transform="translate(20,30)" />
      <SvgText x={12} y={CY + 30} fontSize="8" fill={colors.act}>sized</SvgText>

      {/* The datum: a fixed diameter on the shoulder cone, which is what a
          headspace gauge registers on. */}
      <Line x1={datumX + 20} y1={6} x2={datumX + 20} y2={116} stroke={colors.fnt}
        strokeWidth={0.8} strokeDasharray="3 3" />
      <SvgText x={datumX + 24} y={13} fontSize="7.5" fill={colors.fnt}>datum</SvgText>
      <Dim x1={datumX + 20 - OFFSET} x2={datumX + 20} y={122} label="bump" colors={colors}
        accent={colors.warnt} tickTop={100} />
      <SvgText x={150} y={148} fontSize="7.5" textAnchor="middle" fill={colors.fnt}>
        difference exaggerated — a real bump is one or two thousandths
      </SvgText>
    </Svg>
  );
}

function CaseLength({ colors }) {
  const caseProfile = PROFILE.filter(([x]) => x <= MOUTH_X);
  return (
    <Svg viewBox="0 0 300 104" style={[s.svg, { aspectRatio: 300 / 104 }]}>
      <Path d={outlinePath(caseProfile)} fill={colors.inset} stroke={colors.mut} strokeWidth={1.2} />
      <Dim x1={HEAD_X} x2={MOUTH_X} y={90} label="case length" colors={colors}
        accent={colors.act} tickTop={CY + 20} />
      <SvgText x={215} y={CY - 6} fontSize="8" fill={colors.mut}>trim when this</SvgText>
      <SvgText x={215} y={CY + 6} fontSize="8" fill={colors.mut}>exceeds maximum</SvgText>
    </Svg>
  );
}

const GUIDES = {
  anatomy: {
    title: 'Cartridge anatomy',
    Diagram: Anatomy,
    tool: null,
    body: 'The names every other measurement refers to. The shoulder and the ogive are the two that matter most, because both are cones — a dimension taken on a cone means nothing until you say at what diameter.',
  },
  cbto: {
    title: 'CBTO and COAL are not the same number',
    Diagram: CbtoVsCoal,
    tool: 'Calipers with a comparator body and the insert for your caliber.',
    body: 'COAL runs to the tip. Tips vary — the meplat is the least consistent part of a bullet, so COAL varies between rounds that are seated identically. CBTO runs to a fixed diameter on the ogive, which is the part that meets the rifling, and is therefore the one worth comparing. Seating depth work uses CBTO. Typing a COAL into a CBTO field will not look wrong anywhere: the ladder still solves, and every conclusion from it is built on the wrong dimension.',
  },
  jump: {
    title: 'Jump, and finding the lands',
    Diagram: Jump,
    tool: 'A modified case or a split-neck dummy, plus the same comparator setup.',
    body: 'Jump is how far the bullet travels before it meets the rifling. Find the CBTO at which the bullet just touches the lands, then jump is that figure minus your seated CBTO — "0.020 off" means seated twenty thousandths shorter than touching. Recorded per rifle, because the throat is a property of the barrel and it moves as the barrel wears.',
  },
  bump: {
    title: 'Shoulder bump',
    Diagram: ShoulderBump,
    tool: 'Calipers with a headspace comparator insert.',
    body: 'A fired case has taken the shape of the chamber. Sizing pushes the shoulder back so it will chamber again — usually one to two thousandths for a bolt gun. The measurement is taken to the datum, a fixed diameter partway up the shoulder cone, because the shoulder is a cone and any other reference gives a different answer. Bump is the difference between the fired and sized figures on the same brass.',
  },
  caseLength: {
    title: 'Case length',
    Diagram: CaseLength,
    tool: 'Calipers, or a case length gauge.',
    body: 'Brass flows forward each firing. Past the maximum the mouth can be pinched in the chamber throat, which raises pressure. Measured head to mouth, and trimmed to the trim-to length rather than the maximum, so it does not need doing every firing.',
  },
};

export function MeasureDiagram({ kind }) {
  const { colors } = useTheme();
  const g = GUIDES[kind];
  if (!g) return null;
  const { Diagram } = g;
  return <Diagram colors={colors} />;
}

/**
 * The diagram, folded away, next to the field it explains.
 *
 * Collapsed by default: someone who has measured a thousand cases does not need
 * a picture every time, and someone who has measured none needs it badly. A
 * fold serves both; a permanent diagram serves only the second and annoys the
 * first into ignoring the screen.
 */
export default function MeasureGuide({ kind, style }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const g = GUIDES[kind];
  if (!g) return null;
  const { Diagram } = g;

  return (
    <View style={[{ marginTop: 10 }, style]}>
      <TouchableOpacity onPress={() => setOpen(o => !o)}
        style={[s.head, { borderColor: colors.bd, backgroundColor: colors.card }]}>
        <Ruler size={14} color={colors.act} />
        <Text style={[s.headText, { color: colors.act }]} numberOfLines={1}>{g.title}</Text>
        <ChevronDown size={16} color={colors.mut}
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </TouchableOpacity>

      {open && (
        <View style={[s.panel, { borderColor: colors.bd, backgroundColor: colors.inset }]}>
          <Diagram colors={colors} />
          <Text style={[s.body, { color: colors.mut }]}>{g.body}</Text>
          {!!g.tool && (
            <View style={[s.tool, { borderTopColor: colors.line }]}>
              <Text style={[s.toolLabel, { color: colors.fnt }]}>MEASURED WITH</Text>
              <Text style={[s.toolText, { color: colors.tx }]}>{g.tool}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // height comes from aspectRatio per diagram; without it the box collapses.
  svg: { width: '100%', height: undefined, marginBottom: 4 },
  head: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12,
  },
  headText: { flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: '700' },
  panel: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 6 },
  body: { fontSize: 12, lineHeight: 17.5, marginTop: 6 },
  tool: { borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  toolLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
  toolText: { fontSize: 12, lineHeight: 17 },
});
