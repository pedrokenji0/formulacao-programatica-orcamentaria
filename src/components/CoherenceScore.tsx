export function CoherenceScore({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const color = value >= 80 ? '#1d7a4d' : value >= 50 ? '#d97316' : '#c0233f';
  return (
    <div className="score">
      <div className="ring" style={{ ['--ring-v' as any]: value, ['--ring-c' as any]: color }}>
        <span>{value}</span>
      </div>
      <div className="lbl"><b>{label}</b>{sub}</div>
    </div>
  );
}
