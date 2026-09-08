import type { Container } from 'pixi.js';
import type { Rig2D } from './Rig2D';

export interface PixiBoneBinding {
  bone: string;
  view: Container;
  x?: number;
  y?: number;
  rotation?: number;
  followRotation?: boolean;
}

/**
 * Optional Pixi adapter for code-authored art. Rig2D itself stays renderer-light;
 * this class maps solved bones to ordinary Pixi containers/graphics.
 */
export class PixiRigBinding {
  constructor(private readonly rig: Rig2D, private readonly bindings: PixiBoneBinding[]) {}

  update() {
    for (const binding of this.bindings) {
      const bone = this.rig.getBone(binding.bone);
      binding.view.position.set(bone.start.x + (binding.x ?? 0), bone.start.y + (binding.y ?? 0));
      if (binding.followRotation !== false) binding.view.rotation = bone.worldRotation + (binding.rotation ?? 0);
    }
  }
}
