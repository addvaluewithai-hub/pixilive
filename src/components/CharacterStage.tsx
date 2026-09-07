import { Application, Container, Graphics, type Ticker } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { MiloCharacter } from '../character/MiloCharacter';
import type { Emotion, MouthPose } from '../character/types';

interface CharacterStageProps {
  emotion: Emotion;
  mouth: MouthPose;
  speaking: boolean;
  reactionNonce: number;
}

export function CharacterStage({ emotion, mouth, speaking, reactionNonce }: CharacterStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const characterRef = useRef<MiloCharacter | null>(null);

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

      const dust: Array<{ graphic: Graphics; speed: number; phase: number }> = [];
      for (let index = 0; index < 18; index += 1) {
        const graphic = new Graphics()
          .circle(0, 0, Math.random() * 1.45 + 0.45)
          .fill({ color: 0xf7f5ef, alpha: Math.random() * 0.1 + 0.025 });
        world.addChild(graphic);
        dust.push({ graphic, speed: 0.06 + Math.random() * 0.14, phase: Math.random() * Math.PI * 2 });
      }

      const character = new MiloCharacter();
      characterRef.current = character;
      world.addChild(character.view);

      const layout = () => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        character.view.position.set(width * 0.51, height * 0.49);
        character.view.scale.set(Math.max(0.6, Math.min(width / 650, height / 690, 1.22)));
        for (const particle of dust) {
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
        character.lookAt(
          ((event.clientX - rect.left) / rect.width - 0.5) * 2,
          ((event.clientY - rect.top) / rect.height - 0.47) * 2,
        );
      };
      pointerDown = () => character.react();
      host.addEventListener('pointermove', pointerMove);
      host.addEventListener('pointerdown', pointerDown);

      nextApp.ticker.add((ticker: Ticker) => {
        character.update(ticker);
        const height = host.clientHeight;
        const dt = Math.min(0.033, ticker.deltaMS / 1000);
        for (const particle of dust) {
          particle.graphic.y -= particle.speed * 14 * dt;
          particle.graphic.x += Math.sin(performance.now() * 0.0002 + particle.phase) * particle.speed * 0.12;
          if (particle.graphic.y < -10) particle.graphic.y = height + 10;
        }
      });
    })();

    return () => {
      disposed = true;
      characterRef.current = null;
      resizeObserver?.disconnect();
      if (pointerMove) host.removeEventListener('pointermove', pointerMove);
      if (pointerDown) host.removeEventListener('pointerdown', pointerDown);
      app?.destroy(true, { children: true });
      host.replaceChildren();
    };
  }, []);

  useEffect(() => characterRef.current?.setEmotion(emotion), [emotion]);
  useEffect(() => {
    if (speaking) characterRef.current?.setMouth(mouth, true);
    else characterRef.current?.settleMouth();
  }, [mouth, speaking]);
  useEffect(() => {
    if (reactionNonce > 0) characterRef.current?.react();
  }, [reactionNonce]);

  return <div className="character-stage" ref={hostRef} aria-label="Milo animated character" />;
}
