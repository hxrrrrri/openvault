export function LatticeMark({ size = 18 }: { size?: number }) {
  return (
    <img
      src="/brand/lattice-logo.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="block rounded-[6px] object-cover"
      style={{ width: size, height: size }}
    />
  );
}
