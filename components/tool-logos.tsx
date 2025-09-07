import Image from 'next/image';

interface ToolLogoProps {
  tool: 'outreach' | 'salesloft' | 'both';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { width: 80, height: 24 },
  md: { width: 100, height: 30 },
  lg: { width: 120, height: 36 }
};

export function ToolLogo({ tool, className = '', size = 'md' }: ToolLogoProps) {
  const dimensions = sizeMap[size];
  
  if (tool === 'both') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Image
          src="/logos/outreach_transparent.png"
          alt="Outreach"
          width={dimensions.width * 0.8}
          height={dimensions.height * 0.8}
          className="object-contain"
        />
        <span className="text-muted-foreground text-xs">+</span>
        <Image
          src="/logos/salesloft_transparent.png"
          alt="SalesLoft"
          width={dimensions.width * 0.8}
          height={dimensions.height * 0.8}
          className="object-contain"
        />
      </div>
    );
  }
  
  const logo = tool === 'outreach' ? '/logos/outreach_transparent.png' : '/logos/salesloft_transparent.png';
  const alt = tool === 'outreach' ? 'Outreach' : 'SalesLoft';
  
  return (
    <Image
      src={logo}
      alt={alt}
      width={dimensions.width}
      height={dimensions.height}
      className={`object-contain ${className}`}
    />
  );
}

interface ToolIconProps {
  tool: string;
  className?: string;
  showText?: boolean;
}

export function ToolIcon({ tool, className = '', showText = false }: ToolIconProps) {
  const normalizedTool = tool?.toLowerCase();
  
  if (normalizedTool === 'both') {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <Image
          src="/logos/outreach_transparent.png"
          alt="Outreach"
          width={60}
          height={18}
          className="object-contain"
        />
        <span className="text-muted-foreground text-xs">+</span>
        <Image
          src="/logos/salesloft_transparent.png"
          alt="SalesLoft"
          width={60}
          height={18}
          className="object-contain"
        />
      </div>
    );
  }
  
  if (normalizedTool === 'outreach' || normalizedTool === 'outreach.io') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <Image
          src="/logos/outreach_transparent.png"
          alt="Outreach"
          width={80}
          height={24}
          className="object-contain"
        />
      </div>
    );
  }
  
  if (normalizedTool === 'salesloft') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <Image
          src="/logos/salesloft_transparent.png"
          alt="SalesLoft"
          width={80}
          height={24}
          className="object-contain"
        />
      </div>
    );
  }
  
  return <span className="text-xs text-muted-foreground">{tool}</span>;
}