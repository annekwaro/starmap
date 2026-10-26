import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, NgZone, viewChild } from '@angular/core';

interface Dot {
  x: number;
  y: number;
  r: number;
  /** Parallax depth, 0 (far) to 1 (near). */
  z: number;
  base: number;
  phase: number;
  speed: number;
  warm: boolean;
}

const DENSITY = 1 / 5200; // stars per square CSS pixel
const PARALLAX = 22; // px of travel for the nearest stars

/**
 * A fixed, full-screen canvas of faint twinkling stars that drifts with the
 * pointer. Runs outside Angular so it never triggers change detection, pauses
 * with the tab, and draws once without motion when reduced motion is preferred.
 */
@Component({
  selector: 'app-starfield',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class StarfieldComponent {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => zone.runOutsideAngular(() => destroyRef.onDestroy(this.start())));
  }

  /** Starts drawing; returns the teardown. */
  private start(): () => void {
    const canvas = this.canvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dots: Dot[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    const target = { x: 0, y: 0 };
    const offset = { x: 0, y: 0 };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(width * height * DENSITY);
      dots = Array.from({ length: count }, () => {
        const z = Math.random() ** 2;
        return {
          x: Math.random() * (width + PARALLAX * 2) - PARALLAX,
          y: Math.random() * (height + PARALLAX * 2) - PARALLAX,
          r: 0.35 + z * 0.9,
          z,
          base: 0.15 + Math.random() * 0.45,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 1.4,
          warm: Math.random() < 0.12,
        };
      });
      if (still) draw(0);
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = time / 1000;
      for (const d of dots) {
        const twinkle = still ? 1 : 0.65 + 0.35 * Math.sin(t * d.speed + d.phase);
        ctx.globalAlpha = d.base * twinkle;
        ctx.fillStyle = d.warm ? '#ffe2b0' : '#e6ecff';
        ctx.beginPath();
        ctx.arc(d.x + offset.x * d.z, d.y + offset.y * d.z, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (time: number) => {
      // Ease towards the pointer so the drift feels weighty.
      offset.x += (target.x - offset.x) * 0.05;
      offset.y += (target.y - offset.y) * 0.05;
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    const onPointer = (event: PointerEvent) => {
      target.x = -(event.clientX / width - 0.5) * 2 * PARALLAX;
      target.y = -(event.clientY / height - 0.5) * 2 * PARALLAX;
    };

    resize();
    window.addEventListener('resize', resize);
    if (!still) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
    };
  }
}
