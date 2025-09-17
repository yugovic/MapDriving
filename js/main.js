import { CONFIG } from './config.js';
import { SceneManager } from './scene.js';
import { PhysicsWorld } from './physics.js';
import { Vehicle } from './vehicle.js';
import { MapManager } from './map.js';
import { InputManager } from './input.js';
import { AssetsManager } from './assets.js';
import { PhysicsDebugRenderer } from './physics-debug.js';
import { AIController } from './ai.js';
import { AudioManager } from './audio.js';
import { FieldManager } from './field.js';

class Game {
    constructor() {
        this.sceneManager = null;
        this.physicsWorld = null;
        this.vehicle = null;
        this.aiVehicle = null;
        this.mapManager = null;
        this.inputManager = null;
        this.assetsManager = null;
        this.physicsDebugRenderer = null;
        this.audio = null;
        this.aiController = null;
        this.fieldManager = null;
        this.clock = new THREE.Clock();
        this._occlusionTarget = new THREE.Vector3();
        
        this.init();
    }
    
    init() {
        this.sceneManager = new SceneManager();
        this.physicsWorld = new PhysicsWorld();
        this.mapManager = new MapManager(this.sceneManager.scene);
        this.inputManager = new InputManager();
        // フィールド（GLB）
        this.fieldManager = new FieldManager(this.sceneManager.scene, this.physicsWorld);
        this.assetsManager = new AssetsManager(this.sceneManager.scene, this.physicsWorld);
        this.audio = new AudioManager();
        
        this.vehicle = new Vehicle(
            this.sceneManager.scene,
            this.physicsWorld,
            { x: 0, y: 3, z: 0 }
        );

        // AI車両を生成（初期位置は少し離す）
        this.aiVehicle = new Vehicle(
            this.sceneManager.scene,
            this.physicsWorld,
            { x: 12, y: 3, z: -10 }
        );

        // AI制御器（プレイヤー追跡）
        this.aiController = new AIController(
            this.aiVehicle,
            () => ({ position: this.vehicle.getPosition() }),
            { desiredDist: 8, accelDist: 16, brakeDist: 4, useTurbo: false }
        );
        
        // 物理デバッグレンダラーを初期化
        this.physicsDebugRenderer = new PhysicsDebugRenderer(
            this.sceneManager.scene,
            this.physicsWorld
        );
        
        this.setupDebugMenu();
        this.setupAudioHooks();
        this.animate();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();

        const input = this.inputManager.getInput();
        // フィールドの床が用意されたら、初回だけ車両を床上に移動
        if (!this._floorSpawnApplied && this.fieldManager && typeof this.fieldManager.floorSurfaceY === 'number') {
            const spawn = this.getSpawnSettings();
            this.vehicle.resetPosition(spawn.player, spawn.rotationY);
            this.aiVehicle.resetPosition(spawn.ai, spawn.rotationY);
            this._floorSpawnApplied = true;
        }
        this.vehicle.update(input);

        // AI更新（低コスト）
        const aiInput = this.aiController.update(deltaTime);
        this.aiVehicle.update(aiInput);

        // Audio update (engine, turbo, screech, brake)
        if (this.audio && this.vehicle) {
            const speedKmh = this.vehicle.getSpeed();
            this.audio.updateEngine(speedKmh, input.throttle, CONFIG.VEHICLE.MAX_SPEED);
            this.audio.setTurbo(!!input.turbo);

            // 簡易スリップ判定: 速度が出ていて強いステア or ブレーキ
            if (speedKmh > 25 && (Math.abs(input.steering) > 0.6 || input.brake)) {
                this.audio.playScreech(Math.min(1, (Math.abs(input.steering) + (input.brake ? 0.7 : 0))));
            }
            // ブレーキ短音（立ち上がり時）
            if (!this._prevBrake && input.brake && speedKmh > 8) {
                this.audio.playBrake(Math.min(1, speedKmh / 80));
            }
            this._prevBrake = input.brake;
        }
        
        this.physicsWorld.update(deltaTime);
        
        // アセットの物理更新
        this.assetsManager.update();
        
        // 物理デバッグの更新
        this.physicsDebugRenderer.update();
        
        const vehiclePosition = this.vehicle.getPosition();
        const aiPosition = this.aiVehicle.getPosition();
        
        if (this.vehicle.chassisBody) {
            const adjustments = this.sceneManager.camera.userData.adjustments || CONFIG.CAMERA.ADJUSTMENTS;
            this.sceneManager.updateCameraPosition(this.vehicle.chassisBody, adjustments);
            this._occlusionTarget.set(
                this.vehicle.chassisBody.position.x,
                this.vehicle.chassisBody.position.y + CONFIG.CAMERA.FOLLOW_MODE.LOOK_AT_HEIGHT,
                this.vehicle.chassisBody.position.z
            );
            this.sceneManager.updateCameraOcclusion(this._occlusionTarget);
        }
        
        this.mapManager.updateCarIndicator(vehiclePosition);
        this.mapManager.updateAIIndicator(aiPosition);

        // HUD更新（速度・コンパス・バッジ）
        this.updateHUD(
            this.vehicle.getSpeed(),
            this.vehicle.getRotation(),
            input
        );
        
        this.sceneManager.render();
    }
    
    updateHUD(speed, rotationRad, input) {
        const speedEl = document.getElementById('speedValue');
        const speedBar = document.getElementById('speedBar');
        const turboBadge = document.getElementById('turboBadge');
        const brakeBadge = document.getElementById('brakeBadge');
        const speedometer = document.getElementById('speedometer');
        const compassNeedle = document.getElementById('compassNeedle');

        if (speedEl) speedEl.textContent = Math.round(speed);

        // スピードバー（0〜MAX_SPEED）
        const maxSpeed = CONFIG.VEHICLE.MAX_SPEED;
        const ratio = Math.max(0, Math.min(1, speed / Math.max(1, maxSpeed)));
        if (speedBar) speedBar.style.width = `${Math.round(ratio * 100)}%`;

        // ターボ/ブレーキ表示
        if (turboBadge) turboBadge.classList.toggle('show', !!input?.turbo);
        if (brakeBadge) brakeBadge.classList.toggle('show', !!input?.brake);
        if (speedometer) speedometer.classList.toggle('turbo', !!input?.turbo);

        // コンパス（北=+Zを0°、時計回り）
        if (compassNeedle && typeof rotationRad === 'number') {
            const deg = (rotationRad * 180 / Math.PI) % 360;
            compassNeedle.style.transform = `rotate(${-deg}deg)`; // 時計回りにするため符号反転
        }
    }
    
    setupDebugMenu() {
        const debugModal = document.getElementById('debugModal');
        const closeDebugBtn = document.getElementById('closeDebug');
        const reloadBtn = document.getElementById('reloadBtn');
        
        // スライダー要素を取得
        const sliders = {
            mapSize: { slider: document.getElementById('mapSizeSlider'), value: document.getElementById('mapSizeValue') },
            mass: { slider: document.getElementById('massSlider'), value: document.getElementById('massValue') },
            maxSpeed: { slider: document.getElementById('maxSpeedSlider'), value: document.getElementById('maxSpeedValue') },
            engineForce: { slider: document.getElementById('engineForceSlider'), value: document.getElementById('engineForceValue') },
            turbo: { slider: document.getElementById('turboSlider'), value: document.getElementById('turboValue') },
            brakeForce: { slider: document.getElementById('brakeForceSlider'), value: document.getElementById('brakeForceValue') },
            cameraFov: { slider: document.getElementById('cameraFovSlider'), value: document.getElementById('cameraFovValue') },
            cameraDistance: { slider: document.getElementById('cameraDistanceSlider'), value: document.getElementById('cameraDistanceValue') },
            cameraHeight: { slider: document.getElementById('cameraHeightSlider'), value: document.getElementById('cameraHeightValue') },
            cameraSideOffset: { slider: document.getElementById('cameraSideOffsetSlider'), value: document.getElementById('cameraSideOffsetValue') },
            followDistance: { slider: document.getElementById('followDistanceSlider'), value: document.getElementById('followDistanceValue') },
            followHeight: { slider: document.getElementById('followHeightSlider'), value: document.getElementById('followHeightValue') },
            followLookHeight: { slider: document.getElementById('followLookHeightSlider'), value: document.getElementById('followLookHeightValue') },
            steeringIncrement: { slider: document.getElementById('steeringIncrementSlider'), value: document.getElementById('steeringIncrementValue') },
            maxSteering: { slider: document.getElementById('maxSteeringSlider'), value: document.getElementById('maxSteeringValue') },
            wheelRadius: { slider: document.getElementById('wheelRadiusSlider'), value: document.getElementById('wheelRadiusValue') },
            wheelWidth: { slider: document.getElementById('wheelWidthSlider'), value: document.getElementById('wheelWidthValue') },
            suspensionStiffness: { slider: document.getElementById('suspensionStiffnessSlider'), value: document.getElementById('suspensionStiffnessValue') },
            suspensionDamping: { slider: document.getElementById('suspensionDampingSlider'), value: document.getElementById('suspensionDampingValue') },
            suspensionCompression: { slider: document.getElementById('suspensionCompressionSlider'), value: document.getElementById('suspensionCompressionValue') },
            suspensionRestLength: { slider: document.getElementById('suspensionRestLengthSlider'), value: document.getElementById('suspensionRestLengthValue') },
            frictionSlip: { slider: document.getElementById('frictionSlipSlider'), value: document.getElementById('frictionSlipValue') },
            chassisWidth: { slider: document.getElementById('chassisWidthSlider'), value: document.getElementById('chassisWidthValue') },
            chassisHeight: { slider: document.getElementById('chassisHeightSlider'), value: document.getElementById('chassisHeightValue') },
            chassisLength: { slider: document.getElementById('chassisLengthSlider'), value: document.getElementById('chassisLengthValue') },
            downForce: { slider: document.getElementById('downForceSlider'), value: document.getElementById('downForceValue') },
            angularDamping: { slider: document.getElementById('angularDampingSlider'), value: document.getElementById('angularDampingValue') },
            frontFriction: { slider: document.getElementById('frontFrictionSlider'), value: document.getElementById('frontFrictionValue') },
            rearFriction: { slider: document.getElementById('rearFrictionSlider'), value: document.getElementById('rearFrictionValue') }
        };

        const setSliderFromConfig = (key, rawValue, formatter = (v) => `${v}`) => {
            const target = sliders[key];
            if (!target || !target.slider) return;
            if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) return;
            target.slider.value = rawValue;
            if (target.value) {
                target.value.textContent = formatter(rawValue);
            }
        };

        const vehicleCfg = CONFIG.VEHICLE || {};
        const stabilizationCfg = vehicleCfg.STABILIZATION || {};

        setSliderFromConfig('mapSize', CONFIG.MAP?.SCALE, (v) => `${v.toFixed(2)}x`);
        setSliderFromConfig('mass', vehicleCfg.MASS);
        setSliderFromConfig('maxSpeed', vehicleCfg.MAX_SPEED);
        setSliderFromConfig('engineForce', vehicleCfg.ENGINE_FORCE);
        setSliderFromConfig('turbo', vehicleCfg.TURBO_MULTIPLIER, (v) => v.toFixed(1));
        setSliderFromConfig('brakeForce', vehicleCfg.BRAKE_FORCE);
        setSliderFromConfig('cameraFov', CONFIG.CAMERA?.FOV, (v) => `${v.toFixed(1)}°`);
        setSliderFromConfig('cameraDistance', CONFIG.CAMERA?.ADJUSTMENTS?.DISTANCE, (v) => `${v.toFixed(1)}m`);
        setSliderFromConfig('cameraHeight', CONFIG.CAMERA?.ADJUSTMENTS?.HEIGHT, (v) => `${v.toFixed(1)}m`);
        setSliderFromConfig('cameraSideOffset', CONFIG.CAMERA?.ADJUSTMENTS?.SIDE_OFFSET, (v) => `${v.toFixed(1)}m`);
        setSliderFromConfig('followDistance', CONFIG.CAMERA?.FOLLOW_MODE?.DISTANCE, (v) => `${v.toFixed(1)}m`);
        setSliderFromConfig('followHeight', CONFIG.CAMERA?.FOLLOW_MODE?.HEIGHT, (v) => `${v.toFixed(1)}m`);
        setSliderFromConfig('followLookHeight', CONFIG.CAMERA?.FOLLOW_MODE?.LOOK_AT_HEIGHT, (v) => `${v.toFixed(1)}m`);
        setSliderFromConfig('steeringIncrement', vehicleCfg.STEERING_INCREMENT, (v) => v.toFixed(3));
        setSliderFromConfig('maxSteering', vehicleCfg.MAX_STEERING_VALUE, (v) => v.toFixed(2));
        setSliderFromConfig('wheelRadius', vehicleCfg.WHEEL_RADIUS, (v) => v.toFixed(2));
        setSliderFromConfig('wheelWidth', vehicleCfg.WHEEL_WIDTH, (v) => v.toFixed(2));
        setSliderFromConfig('suspensionStiffness', vehicleCfg.WHEEL_SUSPENSION_STIFFNESS);
        setSliderFromConfig('suspensionDamping', vehicleCfg.WHEEL_SUSPENSION_DAMPING);
        setSliderFromConfig('suspensionCompression', vehicleCfg.WHEEL_SUSPENSION_COMPRESSION, (v) => v.toFixed(1));
        setSliderFromConfig('suspensionRestLength', vehicleCfg.WHEEL_SUSPENSION_REST_LENGTH, (v) => v.toFixed(2));
        setSliderFromConfig('frictionSlip', vehicleCfg.WHEEL_FRICTION_SLIP);
        setSliderFromConfig('chassisWidth', vehicleCfg.CHASSIS_SIZE?.x, (v) => v.toFixed(1));
        setSliderFromConfig('chassisHeight', vehicleCfg.CHASSIS_SIZE?.y, (v) => v.toFixed(2));
        setSliderFromConfig('chassisLength', vehicleCfg.CHASSIS_SIZE?.z, (v) => v.toFixed(1));
        setSliderFromConfig('downForce', stabilizationCfg.DOWN_FORCE);
        setSliderFromConfig('angularDamping', stabilizationCfg.ANGULAR_DAMPING, (v) => v.toFixed(1));
        setSliderFromConfig('frontFriction', vehicleCfg.WHEEL_FRONT_FRICTION_SLIP, (v) => v.toFixed(1));
        setSliderFromConfig('rearFriction', vehicleCfg.WHEEL_REAR_FRICTION_SLIP, (v) => v.toFixed(1));

        this.inputManager.setDebugCallback(() => {
            debugModal.style.display = debugModal.style.display === 'block' ? 'none' : 'block';
        });
        
        this.inputManager.setCameraCallback(() => {
            this.sceneManager.toggleCameraMode();
        });

        // リセット（初期位置へ戻す）
        this.inputManager.setResetCallback(() => {
            const spawn = this.getSpawnSettings();
            this.vehicle.resetPosition(spawn.player, spawn.rotationY);
            this.aiVehicle.resetPosition(spawn.ai, spawn.rotationY);
        });

        // マップサイズ
        sliders.mapSize.slider.addEventListener('input', (e) => {
            const scale = parseFloat(e.target.value);
            sliders.mapSize.value.textContent = `${scale.toFixed(2)}x`;
            this.mapManager.updateMapSize(scale);
            this.assetsManager.updateScale(scale);
        });

        // フィールド（GLB）トランスフォーム
        const fieldScaleSlider = document.getElementById('fieldScaleSlider');
        const fieldScaleValue = document.getElementById('fieldScaleValue');
        const fieldRotateYSlider = document.getElementById('fieldRotateYSlider');
        const fieldRotateYValue = document.getElementById('fieldRotateYValue');
        const fieldPosXSlider = document.getElementById('fieldPosXSlider');
        const fieldPosXValue = document.getElementById('fieldPosXValue');
        const fieldPosYSlider = document.getElementById('fieldPosYSlider');
        const fieldPosYValue = document.getElementById('fieldPosYValue');
        const fieldPosZSlider = document.getElementById('fieldPosZSlider');
        const fieldPosZValue = document.getElementById('fieldPosZValue');

        // 初期値を設定（CONFIG から）
        try {
            if (fieldScaleSlider && fieldScaleValue) {
                const s = CONFIG.FIELD?.SCALE ?? 1.0;
                fieldScaleSlider.value = s;
                fieldScaleValue.textContent = s.toFixed(2);
            }
            if (fieldRotateYSlider && fieldRotateYValue) {
                const r = CONFIG.FIELD?.ROTATE_Y_DEG ?? 0;
                fieldRotateYSlider.value = r;
                fieldRotateYValue.textContent = `${Math.round(r)}°`;
            }
            if (fieldPosXSlider && fieldPosXValue && fieldPosYSlider && fieldPosYValue && fieldPosZSlider && fieldPosZValue) {
                const p = CONFIG.FIELD?.POSITION || { x: 0, y: 0, z: 0 };
                fieldPosXSlider.value = p.x || 0;
                fieldPosXValue.textContent = `${Number(p.x || 0)}`;
                fieldPosYSlider.value = p.y || 0;
                fieldPosYValue.textContent = `${Number(p.y || 0).toFixed(1)}`;
                fieldPosZSlider.value = p.z || 0;
                fieldPosZValue.textContent = `${Number(p.z || 0)}`;
            }
        } catch (_) {}

        const applyFieldPosition = () => {
            const x = parseFloat(fieldPosXSlider.value);
            const y = parseFloat(fieldPosYSlider.value);
            const z = parseFloat(fieldPosZSlider.value);
            fieldPosXValue.textContent = `${x}`;
            fieldPosYValue.textContent = `${y.toFixed(1)}`;
            fieldPosZValue.textContent = `${z}`;
            if (this.fieldManager) this.fieldManager.setPosition(x, y, z);
        };

        if (sliders.cameraFov.slider) {
            sliders.cameraFov.slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                sliders.cameraFov.value.textContent = `${value.toFixed(1)}°`;
                CONFIG.CAMERA.FOV = value;
                if (this.sceneManager) this.sceneManager.setCameraFov(value);
            });
        }

        const syncCameraAdjustments = () => {
            if (this.sceneManager && this.sceneManager.camera) {
                this.sceneManager.camera.userData.adjustments = CONFIG.CAMERA.ADJUSTMENTS;
            }
        };

        if (sliders.cameraDistance.slider) {
            sliders.cameraDistance.slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                CONFIG.CAMERA.ADJUSTMENTS.DISTANCE = value;
                sliders.cameraDistance.value.textContent = `${value.toFixed(1)}m`;
                syncCameraAdjustments();
            });
        }
        if (sliders.cameraHeight.slider) {
            sliders.cameraHeight.slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                CONFIG.CAMERA.ADJUSTMENTS.HEIGHT = value;
                sliders.cameraHeight.value.textContent = `${value.toFixed(1)}m`;
                syncCameraAdjustments();
            });
        }
        if (sliders.cameraSideOffset.slider) {
            sliders.cameraSideOffset.slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                CONFIG.CAMERA.ADJUSTMENTS.SIDE_OFFSET = value;
                sliders.cameraSideOffset.value.textContent = `${value.toFixed(1)}m`;
                syncCameraAdjustments();
            });
        }

        if (sliders.followDistance.slider) {
            sliders.followDistance.slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                CONFIG.CAMERA.FOLLOW_MODE.DISTANCE = value;
                sliders.followDistance.value.textContent = `${value.toFixed(1)}m`;
            });
        }
        if (sliders.followHeight.slider) {
            sliders.followHeight.slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                CONFIG.CAMERA.FOLLOW_MODE.HEIGHT = value;
                sliders.followHeight.value.textContent = `${value.toFixed(1)}m`;
            });
        }
        if (sliders.followLookHeight.slider) {
            sliders.followLookHeight.slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                CONFIG.CAMERA.FOLLOW_MODE.LOOK_AT_HEIGHT = value;
                sliders.followLookHeight.value.textContent = `${value.toFixed(1)}m`;
            });
        }

        if (fieldScaleSlider) {
            fieldScaleSlider.addEventListener('input', (e) => {
                const s = parseFloat(e.target.value);
                fieldScaleValue.textContent = s.toFixed(2);
                if (this.fieldManager) this.fieldManager.setScale(s);
            });
        }
        if (fieldRotateYSlider) {
            fieldRotateYSlider.addEventListener('input', (e) => {
                const r = parseFloat(e.target.value);
                fieldRotateYValue.textContent = `${Math.round(r)}°`;
                if (this.fieldManager) this.fieldManager.setRotationY(r);
            });
        }
        if (fieldPosXSlider) fieldPosXSlider.addEventListener('input', applyFieldPosition);
        if (fieldPosYSlider) fieldPosYSlider.addEventListener('input', applyFieldPosition);
        if (fieldPosZSlider) fieldPosZSlider.addEventListener('input', applyFieldPosition);
        
        // 車両質量
        sliders.mass.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.mass.value.textContent = value;
            this.vehicle.updateMass(value);
        });
        
        // 最高速度
        sliders.maxSpeed.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.maxSpeed.value.textContent = value;
            this.vehicle.updateMaxSpeed(value);
        });
        
        // エンジン出力
        sliders.engineForce.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.engineForce.value.textContent = value;
            this.vehicle.updateEngineForce(value);
        });
        
        // ターボ倍率
        sliders.turbo.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.turbo.value.textContent = value.toFixed(1);
            this.vehicle.updateTurboMultiplier(value);
        });
        
        // ブレーキ力
        sliders.brakeForce.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.brakeForce.value.textContent = value;
            this.vehicle.updateBrakeForce(value);
        });
        
        // ステアリング反応速度
        sliders.steeringIncrement.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.steeringIncrement.value.textContent = value.toFixed(3);
            this.vehicle.updateSteeringIncrement(value);
        });
        
        // ステアリング最大角度
        sliders.maxSteering.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.maxSteering.value.textContent = value.toFixed(2);
            this.vehicle.updateMaxSteering(value);
        });
        
        // ホイール半径
        sliders.wheelRadius.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.wheelRadius.value.textContent = value.toFixed(2);
            this.vehicle.updateWheelRadius(value);
        });
        
        // ホイール幅
        sliders.wheelWidth.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.wheelWidth.value.textContent = value.toFixed(2);
            this.vehicle.updateWheelWidth(value);
        });
        
        // サスペンション硬さ
        sliders.suspensionStiffness.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.suspensionStiffness.value.textContent = value;
            this.vehicle.updateSuspensionStiffness(value);
        });
        
        // サスペンションダンピング
        sliders.suspensionDamping.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.suspensionDamping.value.textContent = value;
            this.vehicle.updateSuspensionDamping(value);
        });
        
        // サスペンション圧縮
        sliders.suspensionCompression.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.suspensionCompression.value.textContent = value.toFixed(1);
            this.vehicle.updateSuspensionCompression(value);
        });
        
        // サスペンション長
        sliders.suspensionRestLength.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.suspensionRestLength.value.textContent = value.toFixed(2);
            this.vehicle.updateSuspensionRestLength(value);
        });
        
        // ホイール摩擦
        sliders.frictionSlip.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.frictionSlip.value.textContent = value;
            this.vehicle.updateWheelFriction(value);
        });
        
        // 車体の幅
        sliders.chassisWidth.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.chassisWidth.value.textContent = value.toFixed(1);
            this.vehicle.updateChassisWidth(value);
        });
        
        // 車体の高さ
        sliders.chassisHeight.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.chassisHeight.value.textContent = value.toFixed(2);
            this.vehicle.updateChassisHeight(value);
        });
        
        // 車体の長さ
        sliders.chassisLength.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.chassisLength.value.textContent = value.toFixed(1);
            this.vehicle.updateChassisLength(value);
        });
        
        // ダウンフォース
        sliders.downForce.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.downForce.value.textContent = value;
            this.vehicle.updateDownForce(value);
        });
        
        // 角度ダンピング
        sliders.angularDamping.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.angularDamping.value.textContent = value.toFixed(1);
            this.vehicle.updateAngularDamping(value);
        });
        
        // フロントタイヤグリップ
        sliders.frontFriction.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.frontFriction.value.textContent = value.toFixed(1);
            this.vehicle.updateFrontWheelFriction(value);
        });
        
        // リアタイヤグリップ
        sliders.rearFriction.slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            sliders.rearFriction.value.textContent = value.toFixed(1);
            this.vehicle.updateRearWheelFriction(value);
        });
        
        // コリジョンボックス表示切り替え
        const showCollisionCheckbox = document.getElementById('showCollisionBoxes');
        const collisionStatus = document.getElementById('collisionStatus');
        
        showCollisionCheckbox.addEventListener('change', (e) => {
            const isShowing = this.vehicle.toggleDebugCollision();
            collisionStatus.textContent = isShowing ? '表示中' : '非表示';
            collisionStatus.style.color = isShowing ? '#4ecdc4' : '#888';
        });
        
        // 物理デバッグ表示切り替え
        const showPhysicsDebugCheckbox = document.getElementById('showPhysicsDebug');
        const physicsDebugStatus = document.getElementById('physicsDebugStatus');
        
        showPhysicsDebugCheckbox.addEventListener('change', (e) => {
            const isShowing = this.physicsDebugRenderer.toggle();
            physicsDebugStatus.textContent = isShowing ? '表示中' : '非表示';
            physicsDebugStatus.style.color = isShowing ? '#4ecdc4' : '#888';
        });

        // マップ削除ボタン
        const removeMapBtn = document.getElementById('removeMapBtn');
        const removeMapStatus = document.getElementById('removeMapStatus');
        if (removeMapBtn) {
            removeMapBtn.addEventListener('click', () => {
                this.mapManager.removeMap();
                removeMapStatus.textContent = 'マップを削除しました';
                removeMapStatus.style.color = '#ff6b6b';
                setTimeout(() => { removeMapStatus.textContent = ''; }, 2000);
            });
        }
        
        closeDebugBtn.addEventListener('click', () => {
            debugModal.style.display = 'none';
        });
        
        debugModal.addEventListener('click', (e) => {
            if (e.target === debugModal) {
                debugModal.style.display = 'none';
            }
        });
        
        // エディターから再読み込みボタン
        reloadBtn.addEventListener('click', () => {
            this.assetsManager.reloadFromEditor();
            
            // ボタンの表示を一時的に変更
            const originalText = reloadBtn.textContent;
            reloadBtn.textContent = '再読み込みしました！';
            reloadBtn.style.backgroundColor = '#ff6b6b';
            
            setTimeout(() => {
                reloadBtn.textContent = originalText;
                reloadBtn.style.backgroundColor = '#4ecdc4';
            }, 2000);
        });
    }

    getSpawnSettings() {
        const defaultFloorY = (this.fieldManager && typeof this.fieldManager.floorSurfaceY === 'number')
            ? this.fieldManager.floorSurfaceY
            : 0;
        const spawnInfo = (this.fieldManager && typeof this.fieldManager.getSpawnInfo === 'function')
            ? this.fieldManager.getSpawnInfo()
            : null;

        const player = spawnInfo?.position
            ? { ...spawnInfo.position }
            : { x: 0, y: defaultFloorY + 2.0, z: 0 };

        const ai = spawnInfo?.aiPosition
            ? { ...spawnInfo.aiPosition }
            : { x: 12, y: defaultFloorY + 2.0, z: -10 };

        const rotationY = spawnInfo?.rotationYRad ?? 0;

        return {
            player,
            ai,
            rotationY
        };
    }

    setupAudioHooks() {
        if (!this.audio || !this.vehicle || !this.vehicle.chassisBody) return;
        try {
            this.vehicle.chassisBody.addEventListener('collide', (e) => {
                if (!this.audio) return;
                // 衝突強度の簡易推定: 車速に比例
                const v = Math.min(1, this.vehicle.getSpeed() / 120);
                this.audio.playCollision(0.4 + v * 0.8);
            });
        } catch (_) {}
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const g = new Game();
    try { window.game = g; } catch (_) {}
});
