import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { gsap } from 'gsap';
import { LandingContentComponent } from './landing-content.component';

@Component({
  selector: 'app-public-site',
  imports: [LandingContentComponent],
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
  readonly frontCardTransform = signal('perspective(1100px) rotateX(25deg) rotateY(0deg) rotateZ(8deg)');
  readonly backCardTransform = signal('perspective(1100px) rotateX(0deg) rotateY(0deg) rotateZ(-7deg)');
  readonly cardGlare = signal('radial-gradient(ellipse 112% 150% at 50% 50%, rgba(255, 255, 255, .07) 0%, transparent 70%)');

  toggleMenu(): void { this.menuOpen.update((open) => !open); }
  closeMenu(): void { this.menuOpen.set(false); }

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
  }

  ngOnDestroy(): void {
    if (this.firstAnimationFrame !== undefined) window.cancelAnimationFrame(this.firstAnimationFrame);
    if (this.secondAnimationFrame !== undefined) window.cancelAnimationFrame(this.secondAnimationFrame);
    this.cardTimeline?.kill();
    this.cardInertia?.kill();
    this.heroRevealTimeline?.kill();
  }

  updateCardTilt(event: PointerEvent): void {
    const canvas = this.heroArt?.nativeElement;
    if (!canvas || event.pointerType === 'touch') return;
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

}
