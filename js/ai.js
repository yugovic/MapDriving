export class AIController {
    constructor(aiVehicle, getTargetState, params = {}) {
        this.ai = aiVehicle;
        this.getTargetState = getTargetState; // () => { position: CANNON.Vec3 }
        this.params = Object.assign({
            steeringKp: 1.2,        // 角度誤差 -> ステア入力
            steeringClamp: 1.0,
            desiredDist: 8.0,       // 目標追従距離（m）
            accelDist: 14.0,        // この距離を超えると強く加速
            brakeDist: 5.0,         // この距離未満でブレーキ
            maxThrottle: 1.0,
            minThrottle: 0.2,
            useTurbo: false
        }, params);
        this._steer = 0;
    }

    update(dt = 1/60) {
        if (!this.ai || !this.ai.chassisBody) return { throttle: 0, steering: 0, brake: false, turbo: false };

        // 目標（プレイヤー）とAI位置
        const target = this.getTargetState();
        const aiPos = this.ai.getPosition();
        if (!target || !target.position) return { throttle: 0, steering: 0, brake: false, turbo: false };

        // 目標方向のヨー角
        const dx = target.position.x - aiPos.x;
        const dz = target.position.z - aiPos.z;
        const desiredYaw = Math.atan2(dx, dz);
        const currentYaw = this.ai.getRotation();
        let yawErr = desiredYaw - currentYaw;
        // -PI..PI に正規化
        while (yawErr > Math.PI) yawErr -= Math.PI * 2;
        while (yawErr < -Math.PI) yawErr += Math.PI * 2;

        // ステア入力（比例制御＋クランプ）
        const steerCmd = Math.max(-this.params.steeringClamp, Math.min(this.params.steeringClamp, this.params.steeringKp * yawErr));
        // なめらかに
        this._steer = this._steer + (steerCmd - this._steer) * Math.min(1, dt * 10);

        // 距離に応じたスロットル/ブレーキ
        const dist = Math.hypot(dx, dz);
        let throttle = 0;
        let brake = false;
        if (dist > this.params.accelDist) {
            throttle = this.params.maxThrottle;
        } else if (dist > this.params.desiredDist) {
            const t = (dist - this.params.desiredDist) / Math.max(1, (this.params.accelDist - this.params.desiredDist));
            throttle = this.params.minThrottle + (this.params.maxThrottle - this.params.minThrottle) * t;
        } else if (dist < this.params.brakeDist) {
            brake = true;
            throttle = 0;
        } else {
            throttle = this.params.minThrottle * 0.6;
        }

        // 目標に対し向きが大きくズレていれば少し減速
        if (Math.abs(yawErr) > Math.PI * 0.45) {
            throttle *= 0.4;
        }

        return {
            throttle: Math.max(-1, Math.min(1, throttle)),
            steering: Math.max(-1, Math.min(1, this._steer)),
            brake,
            turbo: !!this.params.useTurbo
        };
    }
}

