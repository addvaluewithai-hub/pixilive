import { Application, Container, Graphics, type Ticker } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { NovaCharacter } from '../character/NovaCharacter';
import type { Emotion, MouthPose } from '../character/types';

interface CharacterStageProps {
  emotion: Emotion;
  mouth: MouthPose;
  speaking: boolean;
  reactionNonce: number;
}

export function CharacterStage({ emotion, mouth, speaking, reactionNonce }: CharacterStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const novaRef = useRef<NovaCharacter | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let app: Application | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let pointerMove: ((event: PointerEvent) => void) | null = null;
    let pointerDown: (() => void) | null = null;

    void (async () => {
      const nextApp = new Application();
      app = nextApp;
      await nextApp.init({
        resizeTo: host,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        backgroundAlpha: 0,
      });

      if (disposed) {
        nextApp.destroy(true);
        return;
      }

      host.appendChild(nextApp.canvas);
      const world = new Container();
      nextApp.stage.addChild(world);

      const particles: Array<{ graphic: Graphics; speed: number; phase: number }> = [];
      for (let index = 0; index < 28; index += 1) {
        const graphic = new Graphics().circle(0, 0, Math.random() * 2 + 0.7).fill({
          color: index % 3 === 0 ? 0x6de8f2 : 0x9c8cff,
          alpha: Math.random() * 0.28 + 0.05,
        });
        world.addChild(graphic);
        particles.push({ graphic, speed: 0.08 + Math.random() * 0.22, phase: Math.random() * Math.PI * 2 });
      }

      const nova = new NovaCharacter();
      novaRef.current = nova;
      world.addChild(nova.view);

      const layout = () => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        nova.view.position.set(width * 0.5, height * 0.48);
        nova.view.scale.set(Math.max(0.62, Math.min(width / 620, height / 650, 1.2)));
        for (const particle of particles) {
          if (particle.graphic.x === 0 && particle.graphic.y === 0) {
            particle.graphic.position.set(Math.random() * width, Math.random() * height);
          }
        }
      };

      layout();
      resizeObserver = new ResizeObserver(layout);
      resizeObserver.observe(host);

      pointerMove = (event: PointerEvent) => {
        const rect = host.getBoundingClientRect();
        nova.lookAt(
          ((event.clientX - rect.left) / rect.width - 0.5) * 2,
          ((event.clientY - rect.top) / rect.height - 0.47) * 2,
        );
      };
      pointerDown = () => nova.react();
      host.addEventListener('pointermove', pointerMove);
      host.addEventListener('pointerdown', pointerDown);

      nextApp.ticker.add((ticker: Ticker) => {
        nova.update(ticker);
        const height = host.clientHeight;
        for (const particle of particles) {
          particle.graphic.y -= particle.speed * 20 * Math.min(0.033, ticker.deltaMS / 1000);
          particle.graphic.x += Math.sin(performance.now() * 0.00025 + particle.phase) * particle.speed * 0.18;
          if (particle.graphic.y < -10) particle.graphic.y = height + 10;
        }
      });
    })();

    return () => {
      disposed = true;
      novaRef.current = null;
      resizeObserver?.disconnect();
      if (pointerMove) host.removeEventListener('pointermove', pointerMove);
      if (pointerDown) host.removeEventListener('pointerdown', pointerDown);
      app?.destroy(true, { children: true });
      host.replaceChildren();
    };
  }, []);

  useEffect(() => novaRef.current?.setEmotion(emotion), [emotion]);
  useEffect(() => {
    if (speaking) novaRef.current?.setMouth(mouth, true);
    else novaRef.current?.settleMouth();
  }, [mouth, speaking]);
  useEffect(() => {
    if (reactionNonce > 0) novaRef.current?.react();
  }, [reactionNonce]);

  return <div className="character-stage" ref={hostRef} aria-label="Nova animated character" />;
}
