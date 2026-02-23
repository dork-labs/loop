'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface MarketingHeaderProps {
  logoSrc?: string;
  logoAlt?: string;
}

export function MarketingHeader({
  logoSrc = '/images/dorkian-logo.svg',
  logoAlt = 'Loop',
}: MarketingHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const scrollThreshold = 50;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > scrollThreshold);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial state
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className="bg-cream-primary fixed top-0 right-0 left-0 z-40 px-6 transition-all duration-500 ease-out"
      style={{
        paddingTop: isScrolled ? '12px' : '20px',
        paddingBottom: isScrolled ? '12px' : '20px',
      }}
    >
      <div className="flex w-full items-center justify-between">
        <div className="w-16" />
        <Link href="/" className="flex flex-col items-center gap-1.5">
          <Image
            src={logoSrc}
            alt={logoAlt}
            width={20}
            height={20}
            className="w-auto transition-all duration-500 ease-out"
            style={{
              height: isScrolled ? '14px' : '20px',
            }}
            priority
          />
          <span
            className="text-2xs text-warm-gray-light overflow-hidden font-mono tracking-[0.15em] uppercase transition-all duration-500 ease-out"
            style={{
              opacity: isScrolled ? 0 : 1,
              maxHeight: isScrolled ? '0px' : '20px',
              marginTop: isScrolled ? '0px' : '6px',
            }}
          >
            Loop
          </span>
        </Link>
        <Link
          href="/docs"
          className="text-2xs text-warm-gray-light hover:text-brand-orange transition-smooth w-16 text-right font-mono tracking-[0.15em] uppercase"
        >
          Docs
        </Link>
      </div>
    </header>
  );
}
