'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import './WalletCardStack.css';

export interface WalletCardItem {
  id: string;
  name: string;
  type?: string;
  balance: number; // Valor da fatura atual
  num: string;
  exp: string;
  spent?: string;
  limitLabel?: string;
  limitValue?: string;
  theme?: 'graphite' | 'ocean' | 'copper' | 'emerald' | 'purple' | string;
  brand?: string;
  holder?: string;
  customBg?: string;
}

interface WalletCardStackProps {
  cards?: WalletCardItem[];
  titlePrefix?: string;
  currencyFormatter?: (n: number) => string;
  className?: string;
  onCardClick?: (card: WalletCardItem) => void;
}

const DEFAULT_CARDS: WalletCardItem[] = [
  {
    id: 'c-1',
    name: 'Everyday',
    type: 'Crédito',
    balance: 1284.20,
    num: '•••• 4821',
    exp: '08/28',
    limitLabel: 'Limite disponível',
    limitValue: 'R$ 12.480,50',
    spent: 'R$ 12.480,50',
    theme: 'graphite',
    brand: 'Lumen',
    holder: 'Douglas Menezes'
  },
  {
    id: 'c-2',
    name: 'Travel',
    type: 'Crédito',
    balance: 642.90,
    num: '•••• 0937',
    exp: '11/27',
    limitLabel: 'Limite disponível',
    limitValue: 'R$ 3.215,08',
    spent: 'R$ 3.215,08',
    theme: 'ocean',
    brand: 'Visa Infinite',
    holder: 'Douglas Menezes'
  },
  {
    id: 'c-3',
    name: 'Savings',
    type: 'Crédito',
    balance: 120.00,
    num: '•••• 5502',
    exp: '03/29',
    limitLabel: 'Limite disponível',
    limitValue: 'R$ 48.902,17',
    spent: 'R$ 48.902,17',
    theme: 'copper',
    brand: 'Mastercard',
    holder: 'Douglas Menezes'
  }
];

export function WalletCardStack({
  cards: propCards,
  titlePrefix = 'Fatura atual de',
  currencyFormatter,
  className = '',
  onCardClick
}: WalletCardStackProps) {
  const cards = useMemo(() => {
    if (propCards && propCards.length > 0) return propCards;
    return DEFAULT_CARDS;
  }, [propCards]);

  const [order, setOrder] = useState<number[]>(() => {
    // Top card is last in the order array: e.g. [2, 1, 0] for 3 cards => 0 is front
    const len = cards.length;
    return Array.from({ length: len }, (_, i) => len - 1 - i);
  });

  const [isOpen, setIsOpen] = useState(false);

  // Sync order when card count changes
  useEffect(() => {
    setOrder(prev => {
      const len = cards.length;
      if (prev.length === len) return prev;
      return Array.from({ length: len }, (_, i) => len - 1 - i);
    });
  }, [cards.length]);

  const walletRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<HTMLSpanElement>(null);
  const srOnlyRef = useRef<HTMLSpanElement>(null);
  const defsRef = useRef<SVGDefsElement>(null);
  const swapElRef = useRef<HTMLSpanElement>(null);

  const cardElementsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const setBalanceFnRef = useRef<((text: string, animate: boolean) => void) | null>(null);

  const formatBalance = useCallback((n: number) => {
    if (currencyFormatter) return currencyFormatter(n);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }, [currencyFormatter]);

  // Current front card
  const frontIndex = order[order.length - 1] ?? 0;
  const currentCard = cards[frontIndex] || cards[0];

  // Initialize Reel Counter animation engine
  useEffect(() => {
    const reel = reelRef.current;
    const live = srOnlyRef.current;
    const defs = defsRef.current;
    if (!reel || !live || !defs) return;

    const NS = 'http://www.w3.org/2000/svg';
    let cur = '';
    let raf = 0;
    let fid = 0;

    const getCSSNum = (name: string) => {
      if (typeof window === 'undefined') return 0;
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
    };

    function place(strip: HTMLElement, idx: number) {
      strip.style.transform = `translateY(calc(var(--reel-cell) * -${idx}))`;
    }

    function createColumn() {
      const col = document.createElement('span') as HTMLSpanElement & {
        _strip: HTMLElement;
        _blur: SVGElement;
        _fid: string;
        _target?: number;
        _digit?: number;
        _dist?: number;
        _delay?: number;
      };
      col.className = 't-reel-col';

      const strip = document.createElement('span');
      strip.className = 't-reel-strip';

      for (let k = 0; k < 20; k++) {
        const d = document.createElement('span');
        d.className = 't-reel-digit';
        d.textContent = String(k % 10);
        strip.appendChild(d);
      }
      col.appendChild(strip);

      const f = document.createElementNS(NS, 'filter');
      const id = 't-reel-blur-' + (fid++);
      f.setAttribute('id', id);
      f.setAttribute('x', '-20%');
      f.setAttribute('y', '-50%');
      f.setAttribute('width', '140%');
      f.setAttribute('height', '200%');

      const g = document.createElementNS(NS, 'feGaussianBlur');
      g.setAttribute('stdDeviation', '0 0');
      f.appendChild(g);
      defs!.appendChild(f);

      col._strip = strip;
      col._blur = g;
      col._fid = id;
      return col;
    }

    function set(text: string, animate: boolean) {
      if (text === cur) return;
      live!.textContent = text;
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animate = false;
      }
      cancelAnimationFrame(raf);

      const pd = cur.replace(/\D/g, '');
      const nd = text.replace(/\D/g, '');
      let di = 0;
      const moving: ReturnType<typeof createColumn>[] = [];
      cur = text;

      reel!.replaceChildren();
      defs!.replaceChildren();

      text.split('').forEach(ch => {
        if (!/\d/.test(ch)) {
          const s = document.createElement('span');
          s.className = 't-reel-sym';
          s.textContent = ch;
          reel!.appendChild(s);
          return;
        }

        const d = +ch;
        const fromEnd = nd.length - 1 - di++;
        const p = pd.charAt(pd.length - 1 - fromEnd);
        const col = createColumn();
        let start = d;
        let target = d;
        let dist = 0;

        if (animate && p !== ch) {
          const from = p === '' ? 0 : +p;
          const fwd = (d - from + 10) % 10;
          if (fwd <= 10 - fwd) {
            start = from;
            target = from + fwd;
            dist = fwd;
          } else {
            start = from + 10;
            target = from + fwd;
            dist = 10 - fwd;
          }
          col._target = target;
          col._digit = d;
          col._dist = dist;
          moving.push(col);
        }

        col._strip.style.transition = 'none';
        place(col._strip, start);
        reel!.appendChild(col);
      });

      if (!moving.length) return;
      void reel!.offsetHeight; // trigger reflow

      const dur = getCSSNum('--reel-dur') || 327;
      const stag = getCSSNum('--reel-stagger') || 19;
      const blur = getCSSNum('--reel-spin-blur') || 2;

      moving.forEach((col, i) => {
        col._delay = i * stag;
        col._strip.style.filter = `url(#${col._fid})`;
        col._strip.style.transition = `transform var(--reel-dur) var(--reel-ease) ${col._delay}ms`;
        place(col._strip, col._target!);
      });

      const t0 = performance.now();
      function tick(now: number) {
        let done = true;
        moving.forEach(col => {
          const p = (now - t0 - (col._delay || 0)) / dur;
          if (p < 1) done = false;
          const b = p <= 0 || p >= 1 ? 0 : blur * Math.min(1, (col._dist || 0) / 5) * Math.pow(1 - p, 3);
          col._blur.setAttribute('stdDeviation', `0 ${b.toFixed(2)}`);
        });

        if (!done) {
          raf = requestAnimationFrame(tick);
          return;
        }

        moving.forEach(col => {
          col._strip.style.filter = 'none';
          col._strip.style.transition = 'none';
          place(col._strip, col._digit!);
        });
      }

      raf = requestAnimationFrame(tick);
    }

    setBalanceFnRef.current = set;
    set(formatBalance(currentCard?.balance || 0), false);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  // Synchronize balance and details whenever currentCard or cards load/update
  useEffect(() => {
    if (!currentCard || !setBalanceFnRef.current) return;
    setBalanceFnRef.current(formatBalance(currentCard.balance || 0), false);
    setDisplayedDetails({
      num: currentCard.num,
      exp: currentCard.exp,
      limitLabel: currentCard.limitLabel || 'Limite disponível',
      limitValue: currentCard.limitValue || currentCard.spent || ''
    });
  }, [currentCard?.id, currentCard?.balance, currentCard?.num, currentCard?.exp, currentCard?.limitValue, formatBalance]);

  // Update layout positions for cards whenever order or open status changes
  useEffect(() => {
    const front = order[order.length - 1];
    cardElementsRef.current.forEach((cardEl, i) => {
      if (!cardEl) return;
      const p = order.indexOf(i);
      cardEl.style.setProperty('--p', String(p));
      cardEl.style.zIndex = String(p + 1);

      const isFront = i === front;
      cardEl.classList.toggle('is-front', isFront);
      if (isFront) {
        cardEl.setAttribute('aria-expanded', String(isOpen));
        cardEl.setAttribute('aria-label', `${cards[i]?.name || ''} card, ${isOpen ? 'hide' : 'show'} details`);
      } else {
        cardEl.removeAttribute('aria-expanded');
        cardEl.setAttribute('aria-label', `Select ${cards[i]?.name || ''} card`);
      }
    });
  }, [order, isOpen, cards]);

  // Text swap animation
  const swapTimerRef = useRef<number | null>(null);
  const swapText = useCallback((nextText: string) => {
    const swapEl = swapElRef.current;
    if (!swapEl) return;

    if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    swapEl.classList.add('is-exit');

    const rootCS = getComputedStyle(document.documentElement);
    const swapDur = parseFloat(rootCS.getPropertyValue('--text-swap-dur')) || 150;

    swapTimerRef.current = window.setTimeout(() => {
      swapEl.textContent = nextText;
      swapEl.classList.remove('is-exit');
      swapEl.classList.add('is-enter-start');
      void swapEl.offsetHeight; // reflow
      swapEl.classList.remove('is-enter-start');
    }, swapDur);
  }, []);

  // Detail timer
  const detailTimerRef = useRef<number | null>(null);
  const [displayedDetails, setDisplayedDetails] = useState({
    num: currentCard?.num || '',
    exp: currentCard?.exp || '',
    limitLabel: currentCard?.limitLabel || 'Limite disponível',
    limitValue: currentCard?.limitValue || currentCard?.spent || ''
  });

  const selectCard = (index: number) => {
    const wasOpen = isOpen;
    const nextOrder = order.filter(x => x !== index).concat(index);
    setOrder(nextOrder);

    if (wasOpen) {
      setIsOpen(false);
    }

    const card = cards[index];
    if (card) {
      if (setBalanceFnRef.current) {
        setBalanceFnRef.current(formatBalance(card.balance), true);
      }
      swapText(card.name);

      if (detailTimerRef.current) clearTimeout(detailTimerRef.current);
      const rootCS = getComputedStyle(document.documentElement);
      const collapseDur = parseFloat(rootCS.getPropertyValue('--acc-collapse')) || 250;

      detailTimerRef.current = window.setTimeout(() => {
        setDisplayedDetails({
          num: card.num,
          exp: card.exp,
          limitLabel: card.limitLabel || 'Limite disponível',
          limitValue: card.limitValue || card.spent || ''
        });
      }, wasOpen ? collapseDur : 0);

      if (onCardClick) onCardClick(card);
    }
  };

  const handleCardClick = (index: number) => {
    const isFront = order[order.length - 1] === index;
    if (isFront) {
      setIsOpen(prev => !prev);
    } else {
      selectCard(index);
    }
  };

  const toggleAccordion = () => {
    setIsOpen(prev => !prev);
  };

  // Touch press effect listener
  useEffect(() => {
    const SEL = 'button,[role="button"],summary,.t-pressable';
    const minDur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--press-dur')) || 150;

    function handlePointerDown(e: PointerEvent) {
      if (e.pointerType === 'mouse') return;
      const target = e.target as HTMLElement | null;
      const el = target?.closest(SEL) as HTMLElement | null;
      if (!el || (el as HTMLButtonElement).disabled) return;

      const t0 = performance.now();
      el.classList.add('is-pressed');

      function handleUp() {
        document.removeEventListener('pointerup', handleUp, true);
        document.removeEventListener('pointercancel', handleUp, true);
        const elapsed = performance.now() - t0;
        setTimeout(() => {
          el?.classList.remove('is-pressed');
        }, Math.max(0, minDur - elapsed));
      }

      document.addEventListener('pointerup', handleUp, true);
      document.addEventListener('pointercancel', handleUp, true);
    }

    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <div
      ref={walletRef}
      className={`wallet ${className}`}
      data-open={String(isOpen)}
    >
      {/* Header with spinning balance */}
      <div className="wallet-head">
        <span className="balance">
          <span ref={reelRef} className="t-reel" aria-hidden="true"></span>
          <span ref={srOnlyRef} className="sr-only" aria-live="polite">
            {formatBalance(currentCard?.balance || 0)}
          </span>
        </span>
        <p className="meta">
          <span>{titlePrefix}</span>
          <span ref={swapElRef} className="t-text-swap">
            {currentCard?.name || 'Everyday'}
          </span>
        </p>
        <svg className="t-reel-defs" width="0" height="0" aria-hidden="true" focusable="false">
          <defs ref={defsRef}></defs>
        </svg>
      </div>

      {/* Card Stack */}
      <div className="stack t-resize">
        {cards.map((card, i) => {
          const themeClass = card.theme ? `w-card--${card.theme}` : 'w-card--graphite';
          return (
            <button
              key={card.id || i}
              ref={el => { cardElementsRef.current[i] = el; }}
              type="button"
              className={`w-card ${themeClass}`}
              data-i={i}
              aria-controls="card-details"
              onClick={() => handleCardClick(i)}
              style={card.customBg ? { background: card.customBg } : undefined}
            >
              {/* Top row: Name & Type */}
              <span className="w-row">
                <span className="w-name">{card.name}</span>
                <span className="w-type">{card.type || 'Crédito'}</span>
              </span>

              {/* Middle row: EMV Chip & Contactless NFC */}
              <span className="w-mid" aria-hidden="true">
                <span className="w-emv"></span>
                <svg
                  className="hi w-nfc"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
                </svg>
              </span>

              {/* Bottom row: Digits, Holder & Brand */}
              <span className="w-row w-row--end">
                <span className="w-num">
                  <span className="w-digits">{card.num}</span>
                  <span className="w-holder">{card.holder || 'Titular'}</span>
                </span>
                <span className="w-brand">{card.brand || 'Lumen'}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Accordion Details */}
      <div className="t-acc" data-open={String(isOpen)}>
        <button
          type="button"
          className="t-acc-head"
          aria-expanded={isOpen}
          aria-controls="card-details"
          onClick={toggleAccordion}
        >
          <span>Detalhes do cartão</span>
          <span className="t-acc-chevron">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path
                d="M4.46967 6.46967C4.76256 6.17678 5.23744 6.17678 5.53033 6.46967L8 8.93934L10.4697 6.46967C10.7626 6.17678 11.2374 6.17678 11.5303 6.46967C11.8232 6.76256 11.8232 7.23744 11.5303 7.53033L8.53033 10.5303C8.23744 10.8232 7.76256 10.8232 7.46967 10.5303L4.46967 7.53033C4.17678 7.23744 4.17678 6.76256 4.46967 6.46967Z"
                style={{ fill: 'currentColor', stroke: 'none' }}
              />
            </svg>
          </span>
        </button>

        <div className="t-acc-panel" id="card-details">
          <div className="t-acc-panel-inner">
            <div className="d-row">
              <span className="d-label">Número do cartão</span>
              <span className="d-val" data-k="num">{displayedDetails.num}</span>
            </div>
            <div className="d-row">
              <span className="d-label">Vencimento</span>
              <span className="d-val" data-k="exp">{displayedDetails.exp}</span>
            </div>
            <div className="d-row">
              <span className="d-label">{displayedDetails.limitLabel}</span>
              <span className="d-val" data-k="limit">{displayedDetails.limitValue}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
