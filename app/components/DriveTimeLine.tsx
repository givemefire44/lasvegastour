import { driveTimeSentences, type GeoDestination } from '@/lib/driveTimeLine';

// Linea estandar de distancia desde el Strip. Va en el HTML del servidor: sin estado ni efectos.
export default function DriveTimeLine({ geo }: { geo?: GeoDestination | null }) {
  if (!geo) return null;
  return (
    <p
      className="drive-time-line"
      style={{
        margin: '0 0 20px 0',
        padding: '12px 16px',
        background: '#f8f9fa',
        borderLeft: '3px solid #e91e63',
        borderRadius: '6px',
        fontSize: '15px',
        lineHeight: 1.5,
        color: '#333',
      }}
    >
      <span aria-hidden="true">🧭 </span>
      {driveTimeSentences(geo).join(' ')}
    </p>
  );
}
