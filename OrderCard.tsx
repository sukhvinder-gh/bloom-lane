"use client";

import Link from 'next/link';
import { ReactNode, useState } from 'react';

interface OrderCardProps {
  href: string;
  children: ReactNode;
}

export default function OrderCard({ href, children }: OrderCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ 
          background: 'white', 
          borderRadius: 'var(--r-card)', 
          border: '1px solid var(--olive)', 
          padding: '1.25rem 1.5rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1.5rem', 
          flexWrap: 'wrap', 
          cursor: 'pointer', 
          transition: 'all 0.2s ease',
          boxShadow: isHovered ? 'var(--shadow-card)' : 'none',
          borderColor: isHovered ? 'var(--sage)' : 'var(--olive)'
        }}
      >
        {children}
      </div>
    </Link>
  );
}