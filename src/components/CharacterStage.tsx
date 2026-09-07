import { Application, Container, Graphics, type Ticker } from 'pixi.js';
import { useEffect, useRef } from 'react';
import type { CharacterDefinition, CharacterRuntime } from '../character/runtime';
import type { Emotion, MouthPose } from '../character/types';

interface CharacterStageProps {
  character: CharacterDefinition;
  emotion: Emotion;
  mouth: MouthPose;
  speaking: boolean;
}

export function CharacterStage({ character, emotion, mouth, speaking }: CharacterStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<CharacterRuntime | null>(null);

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
      const { ambient, framing } = character;
      for (let index = 0; index < ambient.count; index += 1) {
        const radius = ambient.radiusMin + Math.random() * (ambient.radiusMax - ambient.radiusMin);
        const alpha = ambient.alphaMin + Math.random() * (ambient.alphaMax - ambient.alphaMin);
        const graphic = new Graphics().circle(0, 0, radius).fill({ color: ambient.color, alpha });
        world.addChild(graphic);
        particles.push({ graphic, speed: 0.06 + Math.random() * 0.16, phase: Math.random() * Math.PI * 2 });
      }

      const runtime = character.create();
      runtimeRef.current = runtime;
      world.addChild(runtime.view);
      runtime.setEmotion(emotion);
      if (speaking) runtime.setMouth(mouth, true);
      else runtime.settleMouth();

      const layout = () => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        runtime.view.position.set(width * framing.x, height * framing.y);
        runtime.view.scale.set(
          Math.max(
            framing.minScale,
            Math.min(width / framing.widthReference, height / framing.heightReference, framing.maxScale),
          ),
        );
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
        runtime.lookAt(
          ((event.clientX - rect.left) / rect.width - 0.5) * 2,
          ((event.clientY - rect.top) / rect.height - framing.y) * 2,
        );
      };
      pointerDown = () => runtime.react();
      host.addEventListener('pointermove', pointerMove);
      host.addEventListener('pointerdown', pointerDown);

      nextApp.ticker.add((ticker: Ticker) => {
        runtime.update(ticker);
        const height = host.clientHeight;
        const dt = Math.min(0.033, ticker.deltaMS / 1000);
        for (const particle of particles) {
          particle.graphic.y -= particle.speed * 14 * dt;
          particle.graphic.x += Math.sin(performance.now() * 0.0002 + particle.phase) * particle.speed * 0.12;
          if (particle.graphic.y < -10) particle.graphic.y = height + 10;
        }
      });
    })();

    return () => {
      disposed = true;
      runtimeRef.current = null;
      resizeObserver?.disconnect();
      if (pointerMove) host.removeEventListener('pointermove', pointerMove);
      if (pointerDown) host.removeEventListener('pointerdown', pointerDown);
      app?.destroy(true, { children: true });
      host.replaceChildren();
    };
  }, [character]);

  useEffect(() => runtimeRef.current?.setEmotion(emotion), [character, emotion]);
  useEffect(() => {
    if (speaking) runtimeRef.current?.setMouth(mouth, true);
    else runtimeRef.current?.settleMouth();
  }, [character, mouth, speaking]);

  return <div className="character-stage" ref={hostRef} aria-label={`${character.name} animated character`} />;
}
