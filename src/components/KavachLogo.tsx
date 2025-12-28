import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

interface KavachLogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function KavachLogo({ size = 'md', animated = false }: KavachLogoProps) {
  const sizes = {
    sm: { icon: 20, text: 'text-lg' },
    md: { icon: 28, text: 'text-2xl' },
    lg: { icon: 40, text: 'text-4xl' },
  };
  
  const { icon, text } = sizes[size];

  return (
    <motion.div
      className="flex items-center gap-2"
      initial={animated ? { opacity: 0, y: -10 } : {}}
      animate={animated ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="text-primary"
        animate={animated ? { rotate: [0, -5, 5, 0] } : {}}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
      >
        <Shield size={icon} strokeWidth={2.5} />
      </motion.div>
      <span className={`${text} font-bold tracking-tight text-foreground`}>
        KAVACH
      </span>
    </motion.div>
  );
}
