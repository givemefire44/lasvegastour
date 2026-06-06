import { TourIcons } from '@/lib/icons';

interface IconHeadingProps {
  icon: string;
  text: string;
  level: 'h2' | 'h3' | 'h4';
}

export default function IconHeading({ icon, text, level }: IconHeadingProps) {
  const IconComponent = TourIcons[icon as keyof typeof TourIcons];
  const Tag = level as keyof JSX.IntrinsicElements;
  
  return (
    <Tag className={`icon-heading ${level}`}>
      <span className="icon-heading-icon">
        {IconComponent}
      </span>
      <span className="icon-heading-text">{text}</span>
    </Tag>
  );
}