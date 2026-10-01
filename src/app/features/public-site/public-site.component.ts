import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type CarouselVisual = 'balance' | 'movements' | 'transfer' | 'goals';

interface CarouselRow {
  readonly title: string;
  readonly date: string;
  readonly amount: string;
  readonly out?: boolean;
}

interface CarouselBar {
  readonly label: string;
  readonly value: number;
}

interface CarouselSlide {
  readonly id: string;
  readonly visual: CarouselVisual;
  readonly kicker: string;
  readonly title: string;
  readonly body: string;
  readonly points: readonly string[];
  readonly metric: string;
  readonly metricLabel: string;
  readonly rows?: readonly CarouselRow[];
  readonly bars?: readonly CarouselBar[];
}

@Component({
  selector: 'app-public-site',
  templateUrl: './public-site.component.html',
  styleUrl: './public-site.component.scss',
})
export class PublicSiteComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);
  private cardTimeline?: gsap.core.Timeline;
  private cardInertia?: gsap.core.Timeline;
  private heroRevealTimeline?: gsap.core.Timeline;
  private firstAnimationFrame?: number;
  private secondAnimationFrame?: number;
  private readonly currentTilt = { x: 0, y: 0, roll: 0, glareX: 50, glareY: 50 };
  private readonly tiltVelocity = { x: 0, y: 0, roll: 0 };
  private lastPointerTime = 0;
  @ViewChild('heroArt') private heroArt?: ElementRef<HTMLElement>;
  readonly menuOpen = signal(false);
  readonly faqOpen = signal<number | null>(null);
  readonly frontCardTransform = signal('perspective(1100px) rotateX(25deg) rotateY(0deg) rotateZ(8deg)');
  readonly backCardTransform = signal('perspective(1100px) rotateX(0deg) rotateY(0deg) rotateZ(-7deg)');
  readonly cardGlare = signal('radial-gradient(ellipse 112% 150% at 50% 50%, rgba(255, 255, 255, .07) 0%, transparent 70%)');

  readonly slides: readonly CarouselSlide[] = [
    {
      id: 'saldo',
      visual: 'balance',
      kicker: 'Control',
      title: 'Tu saldo, siempre a la vista.',
      body: 'El disponible aparece primero, sin menús ni búsquedas. Sabes cuánto tienes y en qué cuentas antes de mover un solo sol.',
      points: ['Disponible y saldos por cuenta', 'Se actualiza al entrar', 'Sin cifras redundantes'],
      metric: 'S/ 19,390.50',
      metricLabel: 'Saldo disponible',
    },
    {
      id: 'movimientos',
      visual: 'movements',
      kicker: 'Claridad',
      title: 'Movimientos sin ruido.',
      body: 'Ingresos y salidas ordenados con el detalle justo para decidir, sin extractos que tengas que interpretar.',
      points: ['Ordenados por fecha', 'Categorías claras', 'Detalle en un clic'],
      metric: '24',
      metricLabel: 'Movimientos este mes',
      rows: [
        { title: 'Transferencia recibida', date: 'Hoy, 09:14', amount: '+ S/ 450.00' },
        { title: 'Pago de servicio', date: 'Ayer, 18:02', amount: '− S/ 89.90', out: true },
        { title: 'Compra con tarjeta', date: '12 sep, 20:15', amount: '− S/ 64.20', out: true },
        { title: 'Devolución', date: '10 sep, 08:00', amount: '+ S/ 128.00' },
      ],
    },
    {
      id: 'transferencia',
      visual: 'transfer',
      kicker: 'Velocidad',
      title: 'Transferencias en segundos.',
      body: 'Elige, revisa y confirma. El flujo está pensado para que mover tu dinero no se sienta como un trámite.',
      points: ['Destinatarios frecuentes', 'Revisión antes de enviar', 'Confirmación inmediata'],
      metric: '3',
      metricLabel: 'Pasos para transferir',
    },
    {
      id: 'metas',
      visual: 'goals',
      kicker: 'Proyección',
      title: 'Tus metas, en camino.',
      body: 'Un espacio para ver tus proyectos avanzando, sin pedirte que hagas las cuentas a mano cada mes.',
      points: ['Progreso visible de golpe', 'Aportes a tu ritmo', 'Sin cálculos manuales'],
      metric: '68%',
      metricLabel: 'Meta de emergencia',
      bars: [
        { label: 'Fondo de emergencia', value: 68 },
        { label: 'Viaje', value: 42 },
        { label: 'Equipo nuevo', value: 25 },
      ],
    },
  ];

  readonly activeSlide = signal(0);

  @ViewChild('carouselProgress') private carouselProgressBar?: ElementRef<HTMLElement>;
  private readonly scrollTriggers: ScrollTrigger[] = [];
  private progressTween?: gsap.core.Tween;
  private carouselPaused = false;
  private reducedMotion = false;
  private readonly autoplayMs = 6800;
  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.pauseCarousel();
    else this.resumeCarousel();
  };

  toggleMenu(): void { this.menuOpen.update((open) => !open); }
  closeMenu(): void { this.menuOpen.set(false); }

  toggleFaq(index: number): void {
    const previouslyOpen = this.faqOpen();
    const isClosing = previouslyOpen === index;
    this.faqOpen.set(isClosing ? null : index);
    if (this.reducedMotion) return;
    if (previouslyOpen !== null && previouslyOpen !== index) this.animateFaqAnswer(previouslyOpen, false);
    this.animateFaqAnswer(index, !isClosing);
  }

  nextSlide(): void { this.advanceSlide(); this.restartAutoplay(); }
  prevSlide(): void { this.activeSlide.update((i) => (i - 1 + this.slides.length) % this.slides.length); this.restartAutoplay(); }
  goToSlide(index: number): void { this.activeSlide.set(index); this.restartAutoplay(); }
  pauseCarousel(): void { this.carouselPaused = true; this.progressTween?.pause(); }
  resumeCarousel(): void {
    if (!this.carouselPaused) return;
    this.carouselPaused = false;
    if (!this.autoplayEnabled) return;
    if (this.progressTween?.isActive()) { this.progressTween.resume(); return; }
    this.startAutoplay();
  }

  ngAfterViewInit(): void {
    const canvas = this.heroArt?.nativeElement;
    if (!canvas) return;
    const hero = canvas.closest<HTMLElement>('.hero');
    const heroCopy = hero?.querySelector<HTMLElement>('.hero-copy');
    const topbar = document.querySelector<HTMLElement>('.topbar');
    if (!hero || !heroCopy || !topbar) return;
    const heading = heroCopy.querySelector<HTMLElement>('h1');
    const headingLetters = heading ? [heading] : [];
    const copyDetails = heroCopy.querySelectorAll<HTMLElement>('.eyebrow, .lede');

    this.zone.runOutsideAngular(() => {
      const backCard = canvas.querySelector<HTMLElement>('.back-motion');
      const frontCard = canvas.querySelector<HTMLElement>('.front-motion');
      const balance = canvas.querySelector<HTMLElement>('.balance-motion');
      if (!backCard || !frontCard) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const backBounds = backCard.firstElementChild?.getBoundingClientRect();
      const frontBounds = frontCard.firstElementChild?.getBoundingClientRect();
      if (!backBounds || !frontBounds) return;
      const finalHeroBounds = hero.getBoundingClientRect();

      // Place each card fully beyond its respective viewport edge before its entrance.
      const backTravel = -(backBounds.right + 80);
      const frontTravel = window.innerWidth - frontBounds.left + 80;
      // Scale from the centre instead of changing layout dimensions: this prevents a diagonal drift.
      const openingScale = Math.max(
        window.innerWidth / finalHeroBounds.width,
        window.innerHeight / finalHeroBounds.height,
      ) * 1.22;
      gsap.set(hero, {
        borderRadius: 0,
        transformOrigin: 'center center',
        scale: openingScale,
      });
      gsap.set(topbar, { autoAlpha: 0 });
      gsap.set(heroCopy, { autoAlpha: 0 });
      gsap.set(copyDetails, { autoAlpha: 0, y: 10 });
      gsap.set(headingLetters, { autoAlpha: 0, y: 72 });
      gsap.set(backCard, { x: backTravel, y: 22, rotation: -7, autoAlpha: 0, force3D: false });
      gsap.set(frontCard, { x: frontTravel, y: -18, rotation: 7, autoAlpha: 0, force3D: false });
      if (balance) gsap.set(balance, { y: 34, autoAlpha: 0, force3D: false });

      this.firstAnimationFrame = window.requestAnimationFrame(() => {
        this.secondAnimationFrame = window.requestAnimationFrame(() => {
          this.cardTimeline = gsap.timeline({ paused: true })
            .to(backCard, { x: 0, y: 0, rotation: 0, duration: 1.16, ease: 'power3.out', force3D: false }, 0)
            .to(frontCard, { x: 0, y: 0, rotation: 0, duration: 1.24, ease: 'power3.out', force3D: false }, .08)
            .to([backCard, frontCard], { autoAlpha: 1, duration: .58, ease: 'sine.out' }, 0);
          if (balance) this.cardTimeline.to(balance, { y: 0, autoAlpha: 1, duration: .7, ease: 'power2.out', force3D: false }, .68);

          this.heroRevealTimeline = gsap.timeline()
            // The black stage opens full-screen first, then pulls back centrally to its contained frame.
            .to(hero, { borderRadius: 38, duration: 2.3, ease: 'power2.out', scale: 1 }, .05)
            .set(heroCopy, { autoAlpha: 1 }, .62)
            .to(headingLetters, { autoAlpha: 1, duration: .76, ease: 'power4.out', y: 0 }, .7)
            .to(copyDetails, { autoAlpha: 1, duration: .65, ease: 'sine.out', y: 0 }, 1.2)
            .to(topbar, { autoAlpha: 1, duration: .85, ease: 'sine.out' }, 1.55)
            .call(() => this.cardTimeline?.play(), [], 1.55)
            .set(hero, { clearProps: 'borderRadius,scale,transformOrigin' });
        });
      });
    });
    // Lower-section reveals must not prevent the independent hero entrance.
    this.initLowerSections();
  }

  ngOnDestroy(): void {
    if (this.firstAnimationFrame !== undefined) window.cancelAnimationFrame(this.firstAnimationFrame);
    if (this.secondAnimationFrame !== undefined) window.cancelAnimationFrame(this.secondAnimationFrame);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.progressTween?.kill();
    for (const trigger of this.scrollTriggers) trigger.kill();
    this.scrollTriggers.length = 0;
    this.cardTimeline?.kill();
    this.cardInertia?.kill();
    this.heroRevealTimeline?.kill();
  }

  updateCardTilt(event: PointerEvent): void {
    const canvas = this.heroArt?.nativeElement;
    if (!canvas || event.pointerType === 'touch' || this.reducedMotion) return;
    canvas.classList.remove('is-settling');
    this.cardInertia?.kill();

    const bounds = canvas.getBoundingClientRect();
    const horizontal = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1) - .5;
    const vertical = .5 - Math.min(Math.max((event.clientY - bounds.top) / bounds.height, 0), 1);
    const pointerX = (horizontal + .5) * 100;
    const pointerY = (.5 - vertical) * 100;
    const tiltX = vertical * 10;
    const tiltY = horizontal * 13;
    const roll = horizontal * 3 - vertical * 2;
    const now = performance.now();
    const elapsed = this.lastPointerTime ? Math.max(8, Math.min(80, now - this.lastPointerTime)) : 16;
    const velocityScale = Math.min(3, Math.max(.7, 22 / elapsed));
    this.lastPointerTime = now;

    this.tiltVelocity.x = Math.max(-6, Math.min(6, this.tiltVelocity.x * .45 + (tiltX - this.currentTilt.x) * velocityScale));
    this.tiltVelocity.y = Math.max(-7, Math.min(7, this.tiltVelocity.y * .45 + (tiltY - this.currentTilt.y) * velocityScale));
    this.tiltVelocity.roll = Math.max(-2.5, Math.min(2.5, this.tiltVelocity.roll * .45 + (roll - this.currentTilt.roll) * velocityScale));
    this.applyCardTilt(tiltX, tiltY, roll, pointerX, pointerY);
  }

  resetCardTilt(): void {
    const floatingTilt = {
      x: Math.max(-16, Math.min(16, this.currentTilt.x + this.tiltVelocity.x * 2.7)),
      y: Math.max(-19, Math.min(19, this.currentTilt.y + this.tiltVelocity.y * 2.7)),
      roll: Math.max(-5, Math.min(5, this.currentTilt.roll + this.tiltVelocity.roll * 2.8)),
      glareX: Math.max(0, Math.min(100, this.currentTilt.glareX + this.tiltVelocity.y * .7)),
      glareY: Math.max(0, Math.min(100, this.currentTilt.glareY - this.tiltVelocity.x * .7)),
    };

    const motion = { ...this.currentTilt };
    this.cardInertia?.kill();
    this.cardInertia = gsap.timeline()
      .to(motion, {
        ...floatingTilt,
        duration: .82,
        ease: 'back.out(1.45)',
        onUpdate: () => this.applyCardTilt(motion.x, motion.y, motion.roll, motion.glareX, motion.glareY),
      })
      .to(motion, {
        x: floatingTilt.x * .78,
        y: floatingTilt.y * .78,
        roll: floatingTilt.roll * .78,
        duration: 2.1,
        ease: 'sine.inOut',
        onUpdate: () => this.applyCardTilt(motion.x, motion.y, motion.roll, motion.glareX, motion.glareY),
      })
      .to(motion, {
        x: floatingTilt.x * .78 + 1.4,
        y: floatingTilt.y * .78 - 1.8,
        roll: floatingTilt.roll * .78 + .65,
        duration: 4.4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        onUpdate: () => this.applyCardTilt(motion.x, motion.y, motion.roll, motion.glareX, motion.glareY),
      });
  }

  private applyCardTilt(tiltX: number, tiltY: number, roll: number, glareX: number, glareY: number): void {
    this.currentTilt.x = tiltX;
    this.currentTilt.y = tiltY;
    this.currentTilt.roll = roll;
    this.currentTilt.glareX = glareX;
    this.currentTilt.glareY = glareY;
    const dragX = tiltY * .62;
    const dragY = -tiltX * .45;
    this.frontCardTransform.set(`perspective(1100px) translate3d(${dragX.toFixed(2)}px, ${dragY.toFixed(2)}px, 0) rotateX(${(25 + tiltX).toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) rotateZ(${(8 + roll).toFixed(2)}deg)`);
    this.backCardTransform.set(`perspective(1100px) translate3d(${(dragX * .42).toFixed(2)}px, ${(dragY * .42).toFixed(2)}px, 0) rotateX(${(tiltX * .55).toFixed(2)}deg) rotateY(${(tiltY * .55).toFixed(2)}deg) rotateZ(${(-7 + roll * .55).toFixed(2)}deg)`);
    this.cardGlare.set(`radial-gradient(ellipse 158% 210% at ${glareX.toFixed(2)}% ${glareY.toFixed(2)}%, rgba(255, 255, 255, .17) 0%, rgba(255, 255, 255, .05) 42%, transparent 78%), linear-gradient(${(125 + (glareX - 50) * .2).toFixed(1)}deg, transparent 28%, rgba(255, 255, 255, .03) 50%, transparent 72%)`);
  }

  private initLowerSections(): void {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.initScrollReveals();
    if (!this.reducedMotion) {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.startAutoplay();
    }
  }

  private get autoplayEnabled(): boolean {
    return !this.reducedMotion && !this.carouselPaused && this.slides.length > 1;
  }

  private advanceSlide(): void {
    this.activeSlide.update((i) => (i + 1) % this.slides.length);
  }

  // The progress bar drives the rotation, so pausing it pauses the carousel with no drift.
  private startAutoplay(): void {
    if (!this.autoplayEnabled) return;
    const bar = this.carouselProgressBar?.nativeElement;
    if (!bar) return;
    gsap.set(bar, { scaleX: 0, transformOrigin: 'left center' });
    this.progressTween = gsap.to(bar, {
      scaleX: 1,
      duration: this.autoplayMs / 1000,
      ease: 'none',
      onComplete: () => {
        this.advanceSlide();
        this.startAutoplay();
      },
    });
  }

  private restartAutoplay(): void {
    this.progressTween?.kill();
    this.progressTween = undefined;
    this.startAutoplay();
  }

  private animateFaqAnswer(index: number, open: boolean): void {
    const answer = document.getElementById(`faq-answer-${index}`);
    if (!answer) return;
    gsap.killTweensOf(answer);
    if (open) {
      gsap.fromTo(answer, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: .5, ease: 'power3.out' });
    } else {
      gsap.to(answer, { height: 0, opacity: 0, duration: .38, ease: 'power2.inOut' });
    }
  }

  private initScrollReveals(): void {
    if (this.reducedMotion) return;
    gsap.registerPlugin(ScrollTrigger);

    const reveal = (target: gsap.TweenTarget | null, trigger: Element, vars: gsap.TweenVars = {}): void => {
      if (!target) return;
      const tween = gsap.from(target, {
        autoAlpha: 0,
        y: 28,
        duration: .8,
        ease: 'power3.out',
        stagger: .085,
        scrollTrigger: { trigger, start: 'top 84%', once: true },
        ...vars,
      });
      if (tween.scrollTrigger) this.scrollTriggers.push(tween.scrollTrigger);
    };

    const revealIn = (root: Element | null, targets: string, vars: gsap.TweenVars = {}): void => {
      if (!root) return;
      reveal(root.querySelectorAll(targets.startsWith('>') ? `:scope ${targets}` : targets), root, vars);
    };

    const section = (selector: string): HTMLElement | null => document.querySelector<HTMLElement>(selector);
    const child = (root: Element | null, selector: string): HTMLElement | null => root?.querySelector<HTMLElement>(selector) ?? null;

    const showcase = section('.showcase');
    revealIn(showcase, '.showcase-copy > :not(.showcase-steps), .text-link');
    const phoneScene = child(showcase, '.phone-scene');
    if (phoneScene) reveal(phoneScene, phoneScene, { y: 46, scale: .965, duration: 1, stagger: 0 });
    revealIn(child(showcase, '.showcase-steps'), 'li', { y: 16, duration: .6, stagger: .07 });

    const carousel = section('.carousel');
    revealIn(child(carousel, '.carousel-head'), '.carousel-heading > *, .carousel-nav', { y: 20 });
    revealIn(child(carousel, '.carousel-body'), '.carousel-copy, .carousel-stage', { y: 40, duration: .95, stagger: .1 });
    revealIn(child(carousel, '.carousel-foot'), '.carousel-dots, .carousel-track', { y: 14, duration: .6, stagger: .08 });

    const products = section('.products');
    revealIn(child(products, '.section-intro'), '> *');
    revealIn(child(products, '.product-grid'), 'article', { y: 40, stagger: .1 });

    const security = section('.security');
    revealIn(child(security, '.security-main'), '.security-main > div', { y: 24, stagger: .1 });
    revealIn(child(security, '.security-list'), 'li', { y: 28, stagger: .09 });

    const help = section('.help');
    revealIn(child(help, '.help-copy'), '> *');
    revealIn(child(help, '.faq-list'), 'article', { y: 22, stagger: .08 });

    const ready = section('.ready');
    revealIn(ready, '.eyebrow, h2, .light', { y: 24, stagger: .1 });
  }

  private splitHeadingIntoLetters(heading: HTMLElement): HTMLElement[] {
    if (heading.dataset['animatedLetters'] === 'true') {
      return Array.from(heading.querySelectorAll<HTMLElement>('.hero-letter'));
    }

    heading.setAttribute('aria-label', heading.textContent?.trim() ?? '');
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) textNodes.push(node as Text);

    const letters: HTMLElement[] = [];
    for (const textNode of textNodes) {
      const fragment = document.createDocumentFragment();
      // Cada palabra va en un contenedor nowrap: los letters son inline-block, asi que
      // sin esto el navegador parte palabras a mitad de linea. Los espacios quedan sueltos
      // para que la palabra que no cabe baje entera en vez de romperse.
      for (const chunk of (textNode.textContent ?? '').split(/(\s+)/)) {
        if (!chunk) continue;
        if (!chunk.trim()) {
          fragment.append(document.createTextNode(' '));
          continue;
        }
        const word = document.createElement('span');
        word.className = 'hero-word';
        word.setAttribute('aria-hidden', 'true');
        for (const character of chunk) {
          const letter = document.createElement('span');
          letter.className = 'hero-letter';
          letter.setAttribute('aria-hidden', 'true');
          letter.textContent = character;
          word.append(letter);
          letters.push(letter);
        }
        fragment.append(word);
      }
      textNode.replaceWith(fragment);
    }

    heading.dataset['animatedLetters'] = 'true';
    return letters;
  }

}
