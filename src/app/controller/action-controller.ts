import {
  Camera3D,
  clamp,
  ComponentBase,
  Engine3D,
  KeyCode,
  KeyEvent,
  Object3D,
  PointerEvent3D,
  Time,
  Vector3,
} from '@orillusion/core';
import {planeHalfSize} from '../consts';
import {Enemy} from "../objects/enemy";
import {Wall} from "../objects/wall";

const internal = (target: number, current: number, t: number): number =>
  (current - target) * t;

export class ActionController extends ComponentBase {
  public target: Object3D;
  public distance: number;
  public moveSpeed: number;
  public canvas: HTMLCanvasElement;
  public walls: Set<Wall>;
  public clickTarget?: CallableFunction;

  public enemies?: Set<Enemy>;
  private targetEnemy?: Enemy;

  private camera: Camera3D;
  private moveState: Record<'front' | 'back' | 'left' | 'right', number> = {
    front: 0,
    back: 0,
    left: 0,
    right: 0,
  };

  constructor() {
    super();
  }

  public start(): void {
    this.camera = this.object3D.getOrAddComponent(Camera3D);

    if (!this.enemies) {
      Engine3D.inputSystem.addEventListener(
        PointerEvent3D.POINTER_MOVE,
        this.mouseMove,
        this,
      );
    }

    Engine3D.inputSystem.addEventListener(
      PointerEvent3D.POINTER_CLICK,
      this.click,
      this,
    );
    Engine3D.inputSystem.addEventListener(KeyEvent.KEY_UP, this.keyUp, this);
    Engine3D.inputSystem.addEventListener(
      KeyEvent.KEY_DOWN,
      this.keyDown,
      this,
    );
  }

  private click(e: PointerEvent3D): void {
    this.canvas.requestPointerLock();
    this.clickTarget?.(e);
  }

  private mouseMove(e: PointerEvent3D): void {
    const temp = this.transform.localRotation;
    temp.y -= e.movementX * 0.1;
    temp.x = clamp(temp.x + e.movementY * 0.1, -89, 89);

    this.transform.localRotation = temp;
  }

  private requestFullscreen(): void {
    this.canvas.requestPointerLock();

    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  private keyUp(e: KeyEvent): void {
    switch (e.keyCode) {
      case KeyCode.Key_W:
        this.moveState.front = 0;
        break;
      case KeyCode.Key_S:
        this.moveState.back = 0;
        break;
      case KeyCode.Key_A:
        this.moveState.left = 0;
        break;
      case KeyCode.Key_D:
        this.moveState.right = 0;
        break;
      case KeyCode.Key_Enter:
        this.requestFullscreen();
        break;
    }
  }

  private keyDown(e: KeyEvent): void {
    switch (e.keyCode) {
      case KeyCode.Key_W:
        this.moveState.front = this.moveSpeed;
        break;
      case KeyCode.Key_S:
        this.moveState.back = this.moveSpeed;
        break;
      case KeyCode.Key_A:
        this.moveState.left = this.moveSpeed;
        break;
      case KeyCode.Key_D:
        this.moveState.right = this.moveSpeed;
        break;
    }
  }

  public onUpdate(): void {
    const vec = new Vector3();
    const cameraTransform = this.camera.transform;
    const {forward, left} = cameraTransform;

    forward.scaleToRef(this.distance, vec);
    cameraTransform.localPosition = this.target.transform.worldPosition;

    const leftDist = (left.x ** 2 + left.z ** 2) ** 0.5,
      forwardDist = (forward.x ** 2 + forward.z ** 2) ** 0.5;

    if (
      (this.moveState.back ||
        this.moveState.front ||
        this.moveState.left ||
        this.moveState.right) &&
      leftDist &&
      forwardDist
    ) {
      const targetTransform = this.target.transform;
      const dt = clamp(Time.delta, 0, 0.016) * 1.5;

      const x = clamp(
        targetTransform.x +
          internal(
            targetTransform.x +
              (forward.x / forwardDist) *
                (this.moveState.back - this.moveState.front) +
              (left.x / leftDist) *
                (this.moveState.left - this.moveState.right),
            targetTransform.x,
            dt,
          ),
        -planeHalfSize,
        planeHalfSize,
      );
      const z = clamp(
        targetTransform.z +
          internal(
            targetTransform.z +
              (forward.z / forwardDist) *
                (this.moveState.back - this.moveState.front) +
              (left.z / leftDist) *
                (this.moveState.left - this.moveState.right),
            targetTransform.z,
            dt,
          ),
        -planeHalfSize,
        planeHalfSize,
      );

      let canMove = true;
      for (const wall of this.walls) {
        if (
          x <= wall.x + wall.width &&
          x >= wall.x - wall.width &&
          z <= wall.z + wall.depth &&
          z >= wall.z - wall.depth
        ) {
          canMove = false;
          break;
        }
      }

      if (canMove) {
        targetTransform.x = x;
        targetTransform.z = z;
      }
    }

    if (this.enemies) {
      if (!this.enemies.has(this.targetEnemy!)) {
        this.targetEnemy = undefined;
      }

      if (!this.targetEnemy) {
        let minDistance: undefined | number;

        for (const enemy of this.enemies) {
          const distance = Vector3.distance(enemy.localPosition, this.target.localPosition);
          minDistance ??= distance;
          this.targetEnemy ??= enemy;

          if (distance < minDistance) {
            minDistance = distance;
            this.targetEnemy = enemy;
          }
        }
      }

      if (this.targetEnemy) {
        const
          x = this.targetEnemy.localPosition.x - this.target.localPosition.x,
          z = this.targetEnemy.localPosition.z - this.target.localPosition.z;
        const length = (x*x + z*z) ** 0.5;

        const temp = this.transform.localRotation;
        temp.y = 0.5 * temp.y + 0.5 * Math.acos(z / length) * Math.sign(Math.asin(x / length)) * 180 / Math.PI;
        this.transform.localRotation = temp;
      }
    }

  }

  public destroy(force?: boolean): void {
    if (!this.enemies) {
      Engine3D.inputSystem.removeEventListener(
        PointerEvent3D.POINTER_MOVE,
        this.mouseMove,
        this,
      );
    }

    Engine3D.inputSystem.removeEventListener(
      PointerEvent3D.POINTER_CLICK,
      this.click,
      this,
    );
    Engine3D.inputSystem.removeEventListener(KeyEvent.KEY_UP, this.keyUp, this);
    Engine3D.inputSystem.removeEventListener(
      KeyEvent.KEY_DOWN,
      this.keyDown,
      this,
    );
    super.destroy(force);
  }
}
