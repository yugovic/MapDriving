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
        this.clock = new THREE.Clock();
        
        this.init();
    }
    
    init() {
        this.sceneManager = new SceneManager();
        this.physicsWorld = new PhysicsWorld();
        this.mapManager = new MapManager(this.sceneManager.scene);
        this.inputManager = new InputManager();
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
        
        if (this.mapManager.checkBounds(vehiclePosition)) {
            this.vehicle.resetPosition({ x: 0, y: 3, z: 0 });
        }

        const aiPosition = this.aiVehicle.getPosition();
        if (this.mapManager.checkBounds(aiPosition)) {
            this.aiVehicle.resetPosition({ x: 12, y: 3, z: -10 });
        }
        
        if (this.vehicle.chassisBody) {
            const adjustments = this.sceneManager.camera.userData.adjustments || CONFIG.CAMERA.ADJUSTMENTS;
            this.sceneManager.updateCameraPosition(this.vehicle.chassisBody, adjustments);
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
        
        this.inputManager.setDebugCallback(() => {
            debugModal.style.display = debugModal.style.display === 'block' ? 'none' : 'block';
        });
        
        this.inputManager.setCameraCallback(() => {
            this.sceneManager.toggleCameraMode();
        });

        // リセット（初期位置へ戻す）
        this.inputManager.setResetCallback(() => {
            this.vehicle.resetPosition({ x: 0, y: 3, z: 0 });
        });
        
        // マップサイズ
        sliders.mapSize.slider.addEventListener('input', (e) => {
            const scale = parseFloat(e.target.value);
            sliders.mapSize.value.textContent = `${scale.toFixed(2)}x`;
            this.mapManager.updateMapSize(scale);
            this.assetsManager.updateScale(scale);
        });
        
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
    new Game();
});
