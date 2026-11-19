export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass?: number;
}

export class Spring {
  value: number;
  target: number;
  velocity = 0;
  constructor(value: number, private config: SpringConfig) {
    this.value = value;
    this.target = value;
  }
  step(dt: number) {
    const { stiffness, damping, mass = 1 } = this.config;
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const force = -stiffness * (this.value - this.target) - damping * this.velocity;
      this.velocity += (force / mass) * h;
      this.value += this.velocity * h;
    }
  }
  get settled() {
    return Math.abs(this.velocity) < 0.001 && Math.abs(this.value - this.target) < 0.0005;
  }
  snap() {
    this.value = this.target;
    this.velocity = 0;
  }
}

const easingCache = new Map<string, { easing: string; duration: number }>();

export function springEasing(config: SpringConfig, from = 0, velocity = 0): { easing: string; duration: number } {
  const key = `${config.stiffness}:${config.damping}:${config.mass ?? 1}:${from}:${velocity}`;
  const cached = easingCache.get(key);
  if (cached) return cached;
  const spring = new Spring(from, config);
  spring.target = 1;
  spring.velocity = velocity;
  const dt = 1 / 120;
  const samples: number[] = [from];
  let t = 0;
  while (t < 4) {
    spring.step(dt);
    t += dt;
    samples.push(spring.value);
    if (spring.settled) break;
  }
  samples[samples.length - 1] = 1;
  const stride = Math.max(1, Math.round(samples.length / 64));
  const points = samples.filter((_, i) => i % stride === 0 || i === samples.length - 1);
  const result = {
    easing: `linear(${points.map(v => +v.toFixed(4)).join(", ")})`,
    duration: Math.round(t * 1000),
  };
  easingCache.set(key, result);
  return result;
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
