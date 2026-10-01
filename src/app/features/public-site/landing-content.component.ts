import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LandingIconComponent } from './landing-icon.component';

@Component({
  selector: 'app-landing-content',
  imports: [LandingIconComponent],
  templateUrl: './landing-content.component.html',
})
export class LandingContentComponent implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private context?: gsap.Context;
  private timer?: ReturnType<typeof setInterval>;
  private paused = false;
  private inView = false;
  private observer?: IntersectionObserver;
  private readonly onVisibility = (): void => {
    if (document.hidden) this.stopTimer();
    else this.startTimer();
  };
  readonly activeTab = signal(0);
  readonly openFaq = signal<number | null>(null);
  readonly tour = [
    {
      label: 'Tus cuentas',
      title: 'Todo claro. Desde el primer vistazo.',
      description:
        'Encuentra tus cuentas, saldos y últimos movimientos en un espacio pensado para ti.',
      points: [
        'Saldos y productos juntos',
        'Movimientos fáciles de consultar',
        'El detalle que necesitas, a un clic',
      ],
      icon: 'wallet' as const,
    },
    {
      label: 'Transferencias',
      title: 'De tu cuenta a sus planes.',
      description:
        'Elige la cuenta, revisa los datos y confirma. Un recorrido claro para mover tu dinero.',
      points: [
        'Cuentas propias y de terceros',
        'Revisión antes de confirmar',
        'Constancia de cada operación',
      ],
      icon: 'transfer' as const,
    },
    {
      label: 'Tus tarjetas',
      title: 'El control también está en tus manos.',
      description: 'Consulta tu tarjeta y encuentra sus controles sin perderte entre menús.',
      points: [
        'Información de tu tarjeta',
        'Movimientos en un solo lugar',
        'Configuración a tu alcance',
      ],
      icon: 'card' as const,
    },
    {
      label: 'Tus metas',
      title: 'Dale un lugar a lo que viene.',
      description:
        'Organiza tus objetivos y visualiza tu avance. Tus próximos planes empiezan con una visión clara.',
      points: [
        'Objetivos que puedes seguir',
        'Progreso fácil de entender',
        'Una visión de tus finanzas',
      ],
      icon: 'target' as const,
    },
  ];
  readonly faqs = [
    {
      question: '¿Cómo ingreso a mi banca Azzu?',
      answer:
        'Usa el botón “Ingresar” de esta página para acceder a banca.azzu.tech. Comprueba siempre el dominio antes de continuar.',
    },
    {
      question: '¿Puedo usar Azzu desde mi celular?',
      answer:
        'La banca web se adapta a tu celular, tablet o computadora. Accede desde tu navegador y mantén tu dispositivo actualizado.',
    },
    {
      question: '¿Qué puedo encontrar en mi banca?',
      answer:
        'Un espacio para consultar cuentas y movimientos, acceder a transferencias, revisar tarjetas y organizar tus finanzas. La disponibilidad de cada operación se muestra dentro de tu banca.',
    },
    {
      question: '¿Cómo reconozco una comunicación segura?',
      answer:
        'Nunca compartas tu clave digital ni códigos de verificación por llamadas, correos o mensajes. Ante una duda, accede directamente a nuestros canales y verifica la dirección del sitio.',
    },
    {
      question: '¿Dónde puedo resolver una duda?',
      answer:
        'Escríbenos a contacto@azzu.tech. Describe tu consulta sin incluir claves, códigos, números completos de tarjeta ni información sensible.',
    },
  ];

  selectTab(index: number): void {
    this.activeTab.set(index);
    this.restartTimer();
  }
  changeTab(direction: number): void {
    this.selectTab((this.activeTab() + direction + this.tour.length) % this.tour.length);
  }
  moveTab(index: number, event: Event): void {
    event.preventDefault();
    this.selectTab(index);
    this.element.nativeElement.querySelector<HTMLElement>(`#tour-tab-${index}`)?.focus();
  }
  pauseTour(): void {
    this.paused = true;
    this.stopTimer();
  }
  resumeTour(): void {
    this.paused = false;
    this.startTimer();
  }
  toggleFaq(index: number): void {
    this.openFaq.update((current) => (current === index ? null : index));
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);
      const root = this.element.nativeElement;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.context = gsap.context(() => {
        if (reduced) return;
        root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((target) => {
          gsap.from(target, {
            autoAlpha: 0,
            y: 32,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: { trigger: target, start: 'top 90%', once: true },
          });
        });
        const mock = root.querySelector('.bank-preview');
        if (mock)
          gsap.fromTo(
            mock,
            { y: 18 },
            {
              y: -18,
              ease: 'none',
              scrollTrigger: {
                trigger: '.experience',
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1.4,
              },
            },
          );
      }, root);
      const tour = root.querySelector('.tour');
      if (tour) {
        this.observer = new IntersectionObserver(
          (entries) => {
            this.inView = entries[0].isIntersecting;
            this.inView ? this.startTimer() : this.stopTimer();
          },
          { threshold: 0.35 },
        );
        this.observer.observe(tour);
      }
      document.addEventListener('visibilitychange', this.onVisibility);
    });
  }

  private startTimer(): void {
    if (
      this.timer ||
      this.paused ||
      !this.inView ||
      document.hidden ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    this.timer = setInterval(
      () => this.activeTab.update((index) => (index + 1) % this.tour.length),
      7000,
    );
  }
  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  private restartTimer(): void {
    this.stopTimer();
    this.startTimer();
  }
  ngOnDestroy(): void {
    this.stopTimer();
    this.observer?.disconnect();
    this.context?.revert();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
