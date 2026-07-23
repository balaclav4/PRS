import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../lib/theme';

export default function TargetPlot({ shots = [], size = 150, showLabels = false }) {
  const { colors } = useTheme();
  const c = size / 2;
  const outerR = c - 9;
  const midR = outerR * 0.56;
  const innerR = outerR * 0.28;

  const scatterPts = shots.map(s => ({
    cx: c + (s.x - 0.5) * outerR * 3,
    cy: c + (s.y - 0.45) * outerR * 3,
  }));

  return (
    <Svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <Circle cx={c} cy={c} r={outerR} fill={colors.tgt} stroke={colors.grid} strokeWidth={1} />
      <Circle cx={c} cy={c} r={midR} fill="none" stroke={colors.ring} strokeWidth={1} strokeDasharray="3 3" />
      <Circle cx={c} cy={c} r={innerR} fill="none" stroke={colors.ring} strokeWidth={1} strokeDasharray="3 3" />
      <Line x1={c} y1={c - outerR} x2={c} y2={c + outerR} stroke={colors.grid} strokeWidth={1} />
      <Line x1={c - outerR} y1={c} x2={c + outerR} y2={c} stroke={colors.grid} strokeWidth={1} />
      {showLabels && (
        <>
          <SvgText x={c + 3} y={c - midR + 4} fontSize={9} fontFamily="JetBrains Mono" fill={colors.fnt}>1 MOA</SvgText>
          <SvgText x={c + 3} y={c - innerR + 4} fontSize={9} fontFamily="JetBrains Mono" fill={colors.fnt}>0.5</SvgText>
        </>
      )}
      {scatterPts.map((p, i) => (
        <Circle key={i} cx={p.cx} cy={p.cy} r={size > 120 ? 4.5 : 5} fill="rgba(130,87,240,0.9)" />
      ))}
    </Svg>
  );
}
