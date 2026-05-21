interface LatticeMarkProps {
  size?: number;
  rounded?: number;
}

export function LatticeMark({ size = 18, rounded = 6 }: LatticeMarkProps) {
  return (
    <img
      src="/brand/lattice-logo.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="block object-contain"
      style={{ width: size, height: size, borderRadius: rounded }}
    />
  );
}

interface LatticeWordmarkProps {
  height?: number;
}

export function LatticeWordmark({ height = 26 }: LatticeWordmarkProps) {
  return (
    <img
      src="/brand/lattice-wordmark.png"
      alt="Lattice"
      height={height}
      className="block object-contain"
      style={{ height, width: "auto" }}
    />
  );
}
