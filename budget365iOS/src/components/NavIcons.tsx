import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

type IconProps = { size?: number; color?: string };

export const IconChevronLeft = ({ size = 26, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 6l-6 6 6 6"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const IconTransactions = ({ size = 26, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M7 4v13" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path
      d="M4 14l3 3.5 3-3.5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M17 20V7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path
      d="M14 10l3-3.5 3 3.5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const IconBudget = ({ size = 26, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={5} width={18} height={15} rx={2.5} stroke={color} strokeWidth={1.8} />
    <Path d="M3 9.5h18" stroke={color} strokeWidth={1.8} />
    <Path d="M8 3v4M16 3v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path
      d="M7.5 14.5l2.5 2.5 5-5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const IconSavings = ({ size = 26, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={4} width={18} height={14} rx={3} stroke={color} strokeWidth={1.8} />
    <Circle cx={12} cy={11} r={3.75} stroke={color} strokeWidth={1.8} />
    <Circle cx={12} cy={11} r={1.5} fill={color} />
    <Path d="M15.75 11H18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M6.5 19v2M17.5 19v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

export const IconStats = ({ size = 26, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 3.5v14a.5.5 0 0 0 .5.5H21"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    <Path
      d="M6.5 16l3.5-4.5 3.5 2.5 4.5-6"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx={6.5} cy={16} r={1.75} fill={color} />
    <Circle cx={18} cy={8} r={1.75} fill={color} />
  </Svg>
);
