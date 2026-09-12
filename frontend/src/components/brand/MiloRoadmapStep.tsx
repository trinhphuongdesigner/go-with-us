import Image from 'next/image';
import type { CSSProperties } from 'react';
import styles from './MiloRoadmapStep.module.css';

export type MiloRoadmapStatus = 'completed' | 'current' | 'upcoming' | 'goal';
export type MiloRoadmapStepProps = {
  number: number;
  title: string;
  status: MiloRoadmapStatus;
  period: string;
  width?: number;
  showMilo?: boolean;
  message?: string;
  className?: string;
};

const base = '/brand/careermate/v2-reference';
const statusLabels: Record<MiloRoadmapStatus, string> = {
  completed: 'Đã hoàn thành', current: 'Đang thực hiện', upcoming: 'Sắp tới', goal: 'Mục tiêu',
};

/** Visual milestone. The parent supplies navigation/button behavior and manages progress. */
export function MiloRoadmapStep({
  number, title, status, period, width = 160, showMilo = status === 'current',
  message = 'Tiếp tục bước tiếp theo nhé!', className,
}: MiloRoadmapStepProps) {
  const label = String(number).padStart(2, '0');
  return (
    <figure
      className={[styles.step, className].filter(Boolean).join(' ')}
      data-status={status}
      aria-current={status === 'current' ? 'step' : undefined}
      style={{ '--node-width': `${width}px` } as CSSProperties}
    >
      <div className={styles.stage}>
        <Image className={styles.platform} src={`${base}/step-${status}.svg`} width={260} height={152} alt="" unoptimized />
        {status !== 'completed' && <span className={styles.frontNumber} aria-hidden="true">{label}</span>}
        {status === 'completed' && <Image className={styles.marker} src={`${base}/check-marker.svg`} width={96} height={100} alt="" unoptimized />}
        {status === 'goal' && <Image className={styles.flag} src={`${base}/goal-flag.svg`} width={104} height={176} alt="" unoptimized />}
        {showMilo && <>
          <Image className={styles.footShadow} src={`${base}/milo-contact-shadow.svg`} width={200} height={60} alt="" unoptimized />
          <Image className={styles.milo} src={`${base}/milo-purple-tablet.png`} width={1254} height={1254} alt="" sizes={`${Math.round(width * 1.24)}px`} />
          <span className={styles.miloName}>Milo</span>
          {message && <p className={styles.bubble}>{message}</p>}
        </>}
      </div>
      <figcaption className={styles.caption}>
        <span className={styles.labelNumber}>{label}</span>
        <span className={styles.title}>{title}</span>
        <span className={styles.status}>{statusLabels[status]}</span>
        <span className={styles.period}>{period}</span>
      </figcaption>
    </figure>
  );
}
