interface AnimatedNumberProps {
  value: number; duration?: number; formatter?: (value: number) => string;
  className?: string; style?: React.CSSProperties;
}
/** Financial values are immediately readable, including during navigation. */
export default function AnimatedNumber({value, formatter = v => v.toLocaleString('he-IL'), className = '', style}: AnimatedNumberProps) {
  return <bdi dir="ltr" className={`font-mono-numbers ${className}`} style={{fontVariantNumeric:'tabular-nums', display:'inline-block', ...style}}>{formatter(value)}</bdi>
}
