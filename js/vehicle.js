import { CONFIG } from './config.js';

export class Vehicle {
    constructor(scene, physicsWorld, position = { x: 0, y: 5, z: 0 }) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.chassisMesh = null;
        this.wheelMeshes = [];
        this.vehicle = null;
        this.chassisBody = null;
        this.currentSteering = 0;
        this.currentSpeed = 0;
        this.isLoaded = false;
        
        this.init(position);
    }
    
    init(position) {
        this.createChassis(position);
        this.createVehicle();
        this.createWheels();
        this.setupStabilization();
        
        // デバッグ：初期位置を確認
        console.log('Vehicle initial position:', position);
        console.log('Chassis body position:', this.chassisBody.position);
    }
    
    createChassis(position) {
        // 複合ボディ用の空のボディを作成（形状は後で追加）
        this.chassisBody = new CANNON.Body({
            mass: CONFIG.VEHICLE.MASS
        });
        this.chassisBody.position.set(position.x, position.y, position.z);
        
        // 視覚的な車体用の空のグループ
        this.chassisMesh = new THREE.Group();
        this.scene.add(this.chassisMesh);
        
        // コリジョンボックスの配列
        this.collisionBoxes = [];
        
        // デバッグ用のヘルパー
        this.debugHelpers = [];
        this.showDebugCollision = false;
        
        this.loadCarModel();
    }
    
    loadCarModel() {
        const loader = new THREE.GLTFLoader();
        loader.load('assets/Cars/RX7_Savanna.glb', (gltf) => {
            try {
                const model = gltf.scene;
                console.log('=== RX7_Savanna.glb loaded, applying final scale and hierarchy fix ===');

                const visualMeshes = [];
                const collisionMeshes = [];
                let visualMeshParentGroup = null;

                // ステップ1: モデルを走査し、メッシュを分類、親グループを特定
                model.traverse((child) => {
                    if (child.isMesh) {
                        if (child.name.includes('CollisionBox')) {
                            collisionMeshes.push(child);
                        } else {
                            visualMeshes.push(child);
                            // すべての表示メッシュは同じ親を持つと仮定
                            if (!visualMeshParentGroup) {
                                visualMeshParentGroup = child.parent;
                            }
                        }
                    }
                });

                // ステップ2: 親グループからスケールを取得
                const scale = visualMeshParentGroup ? visualMeshParentGroup.scale.clone() : new THREE.Vector3(1, 1, 1);
                console.log(`[SCALE] Detected scale from parent group '${visualMeshParentGroup.name}':`, scale);

                // ステップ3: 表示用メッシュをchassisMeshに直接追加し、スケールを適用
                console.log('[REPARENT & RESCALE] Moving visual meshes and applying correct scale.');
                visualMeshes.forEach(mesh => {
                    // ワールド座標系での変換行列を取得
                    mesh.updateWorldMatrix(true, false);
                    const worldMatrix = mesh.matrixWorld.clone();

                    // 親からデタッチ
                    visualMeshParentGroup.remove(mesh);
                    // chassisMeshにアタッチ
                    this.chassisMesh.add(mesh);

                    // ローカルの変換をリセット
                    mesh.position.set(0, 0, 0);
                    mesh.quaternion.set(0, 0, 0, 1);
                    mesh.scale.set(1, 1, 1);

                    // 元のワールド変換を適用
                    mesh.applyMatrix4(worldMatrix);

                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                });

                // ステップ4: 衝突判定用メッシュを非表示にする
                console.log('[VISIBILITY] Hiding collision meshes.');
                collisionMeshes.forEach(mesh => {
                    mesh.visible = false;
                });

                // ステップ5: 衝突判定用メッシュから物理ボディを生成する
                if (collisionMeshes.length > 0) {
                    console.log(`[PHYSICS] Creating compound physics body with ${collisionMeshes.length} shapes.`);
                    collisionMeshes.forEach(mesh => {
                        mesh.updateMatrixWorld(true);
                        const box = new THREE.Box3().setFromObject(mesh);
                        const size = box.getSize(new THREE.Vector3());
                        const center = box.getCenter(new THREE.Vector3());
                        const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
                        const shapePosition = new CANNON.Vec3(center.x, center.y, center.z);
                        this.chassisBody.addShape(shape, shapePosition);
                    });
                    this.chassisBody.updateMassProperties();
                } else {
                    console.warn('[PHYSICS] No collision boxes found. Using default chassis shape.');
                    const chassisShape = new CANNON.Box(new CANNON.Vec3(CONFIG.VEHICLE.CHASSIS_SIZE.x / 2, CONFIG.VEHICLE.CHASSIS_SIZE.y / 2, CONFIG.VEHICLE.CHASSIS_SIZE.z / 2));
                    this.chassisBody.addShape(chassisShape);
                }

                this.physicsWorld.world.addBody(this.chassisBody);
                console.log('[PHYSICS] Chassis body added to the world.');

                this.isLoaded = true;
                const loadingElement = document.getElementById('loading');
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
                console.log('Vehicle setup complete.');

            } catch (loadError) {
                console.error('An error occurred during vehicle setup:', loadError);
            }
        }, undefined, (error) => {
            console.error('Error loading car model:', error);
        });
    }
    
    createVehicle() {
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexRightAxis: 0,
            indexForwardAxis: 2,
            indexUpAxis: 1
        });
        
        const wheelOptions = {
            radius: CONFIG.VEHICLE.WHEEL_RADIUS,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: CONFIG.VEHICLE.WHEEL_SUSPENSION_STIFFNESS,
            suspensionRestLength: CONFIG.VEHICLE.WHEEL_SUSPENSION_REST_LENGTH,
            frictionSlip: CONFIG.VEHICLE.WHEEL_FRICTION_SLIP,
            dampingRelaxation: CONFIG.VEHICLE.WHEEL_SUSPENSION_DAMPING,
            dampingCompression: CONFIG.VEHICLE.WHEEL_SUSPENSION_COMPRESSION,
            maxSuspensionForce: CONFIG.VEHICLE.WHEEL_MAX_SUSPENSION_FORCE,
            rollInfluence: 0.05,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
            maxSuspensionTravel: CONFIG.VEHICLE.WHEEL_MAX_SUSPENSION_TRAVEL,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };
        
        const axisWidth = CONFIG.VEHICLE.CHASSIS_SIZE.x * 0.42;
        const wheelPositions = [
            { x: -axisWidth, y: 0, z: CONFIG.VEHICLE.CHASSIS_SIZE.z * 0.4 },
            { x: axisWidth, y: 0, z: CONFIG.VEHICLE.CHASSIS_SIZE.z * 0.4 },
            { x: -axisWidth, y: 0, z: -CONFIG.VEHICLE.CHASSIS_SIZE.z * 0.4 },
            { x: axisWidth, y: 0, z: -CONFIG.VEHICLE.CHASSIS_SIZE.z * 0.4 }
        ];
        
        wheelPositions.forEach((pos, index) => {
            // フロントタイヤ（index 0, 1）とリアタイヤ（index 2, 3）で異なるグリップ値を使用
            const isFront = index < 2;
            wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(pos.x, pos.y, pos.z);
            wheelOptions.frictionSlip = isFront ? CONFIG.VEHICLE.WHEEL_FRONT_FRICTION_SLIP : CONFIG.VEHICLE.WHEEL_REAR_FRICTION_SLIP;
            this.vehicle.addWheel(wheelOptions);
        });
        
        this.vehicle.addToWorld(this.physicsWorld.world);
    }
    
    createWheels() {
        const wheelGeometry = new THREE.CylinderGeometry(
            CONFIG.VEHICLE.WHEEL_RADIUS,
            CONFIG.VEHICLE.WHEEL_RADIUS,
            CONFIG.VEHICLE.WHEEL_WIDTH,
            32
        );
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.2,
            roughness: 0.7,
            visible: false
        });
        
        this.vehicle.wheelInfos.forEach(() => {
            const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheelMesh.rotation.z = Math.PI / 2;
            wheelMesh.castShadow = true;
            wheelMesh.receiveShadow = true;
            this.scene.add(wheelMesh);
            this.wheelMeshes.push(wheelMesh);
        });
    }
    
    setupStabilization() {
        this.chassisBody.angularDamping = CONFIG.VEHICLE.STABILIZATION.ANGULAR_DAMPING;
        this.chassisBody.linearDamping = CONFIG.VEHICLE.STABILIZATION.LINEAR_DAMPING;
    }
    
    update(input) {
        if (!this.vehicle) return;
        
        // デバッグ：車の位置を定期的に確認
        if (Math.random() < 0.01) { // 1%の確率でログ出力（頻度を抑える）
            console.log('Vehicle Y position:', this.chassisBody.position.y.toFixed(2));
            if (this.chassisBody.position.y < -5) {
                console.warn('Vehicle has fallen through the ground!');
            }
        }
        
        const maxSteerVal = CONFIG.VEHICLE.MAX_STEERING_VALUE;
        const steerIncrement = CONFIG.VEHICLE.STEERING_INCREMENT;
        
        if (input.steering !== 0) {
            this.currentSteering += steerIncrement * input.steering;
            this.currentSteering = Math.max(-maxSteerVal, Math.min(maxSteerVal, this.currentSteering));
        } else {
            this.currentSteering *= 0.9;
        }
        
        this.vehicle.setSteeringValue(this.currentSteering, 0);
        this.vehicle.setSteeringValue(this.currentSteering, 1);
        
        let engineForce = 0;
        if (input.brake) {
            this.vehicle.setBrake(CONFIG.VEHICLE.BRAKE_FORCE, 0);
            this.vehicle.setBrake(CONFIG.VEHICLE.BRAKE_FORCE, 1);
            this.vehicle.setBrake(CONFIG.VEHICLE.BRAKE_FORCE, 2);
            this.vehicle.setBrake(CONFIG.VEHICLE.BRAKE_FORCE, 3);
        } else {
            this.vehicle.setBrake(0, 0);
            this.vehicle.setBrake(0, 1);
            this.vehicle.setBrake(0, 2);
            this.vehicle.setBrake(0, 3);
            
            if (input.throttle !== 0) {
                engineForce = CONFIG.VEHICLE.ENGINE_FORCE * -input.throttle;
                if (input.turbo) {
                    engineForce *= CONFIG.VEHICLE.TURBO_MULTIPLIER;
                }
            }
        }
        
        const speed = this.chassisBody.velocity.length();
        const maxSpeed = CONFIG.VEHICLE.MAX_SPEED / 3.6;
        
        if (speed < maxSpeed || input.throttle < 0) {
            this.vehicle.applyEngineForce(engineForce, 0);
            this.vehicle.applyEngineForce(engineForce, 1);
            this.vehicle.applyEngineForce(engineForce, 2);
            this.vehicle.applyEngineForce(engineForce, 3);
        }
        
        const downForce = CONFIG.VEHICLE.STABILIZATION.DOWN_FORCE * speed * 0.1;
        this.chassisBody.applyForce(
            new CANNON.Vec3(0, -downForce, 0),
            this.chassisBody.position
        );
        
        this.currentSpeed = speed * 3.6;
        
        this.updateVisuals();
    }
    
    updateVisuals() {
        if (this.chassisMesh && this.chassisBody) {
            this.chassisMesh.position.copy(this.chassisBody.position);
            this.chassisMesh.quaternion.copy(this.chassisBody.quaternion);
        }
        
        this.vehicle.wheelInfos.forEach((wheel, index) => {
            if (this.wheelMeshes[index]) {
                this.vehicle.updateWheelTransform(index);
                const transform = wheel.worldTransform;
                this.wheelMeshes[index].position.copy(transform.position);
                this.wheelMeshes[index].quaternion.copy(transform.quaternion);
            }
        });
    }
    
    getPosition() {
        return this.chassisBody ? this.chassisBody.position : new CANNON.Vec3();
    }
    
    getRotation() {
        if (!this.chassisBody) return 0;
        
        const forward = new CANNON.Vec3(0, 0, 1);
        this.chassisBody.quaternion.vmult(forward, forward);
        return Math.atan2(forward.x, forward.z);
    }
    
    getSpeed() {
        return this.currentSpeed;
    }
    
    resetPosition(position) {
        if (this.chassisBody) {
            this.chassisBody.position.set(position.x, position.y, position.z);
            this.chassisBody.velocity.set(0, 0, 0);
            this.chassisBody.angularVelocity.set(0, 0, 0);
            this.chassisBody.quaternion.set(0, 0, 0, 1);
        }
    }
    
    // 動的パラメータ更新メソッド
    updateMass(mass) {
        CONFIG.VEHICLE.MASS = mass;
        if (this.chassisBody) {
            this.chassisBody.mass = mass;
            this.chassisBody.updateMassProperties();
        }
    }
    
    updateMaxSpeed(speed) {
        CONFIG.VEHICLE.MAX_SPEED = speed;
    }
    
    updateEngineForce(force) {
        CONFIG.VEHICLE.ENGINE_FORCE = force;
    }
    
    updateTurboMultiplier(multiplier) {
        CONFIG.VEHICLE.TURBO_MULTIPLIER = multiplier;
    }
    
    updateBrakeForce(force) {
        CONFIG.VEHICLE.BRAKE_FORCE = force;
    }
    
    updateSteeringIncrement(increment) {
        CONFIG.VEHICLE.STEERING_INCREMENT = increment;
    }
    
    updateMaxSteering(value) {
        CONFIG.VEHICLE.MAX_STEERING_VALUE = value;
    }
    
    updateWheelRadius(radius) {
        CONFIG.VEHICLE.WHEEL_RADIUS = radius;
        // ホイールのメッシュを更新
        if (this.wheelMeshes.length > 0) {
            const wheelGeometry = new THREE.CylinderGeometry(
                radius,
                radius,
                CONFIG.VEHICLE.WHEEL_WIDTH,
                32
            );
            this.wheelMeshes.forEach(mesh => {
                mesh.geometry.dispose();
                mesh.geometry = wheelGeometry;
            });
        }
    }
    
    updateWheelWidth(width) {
        CONFIG.VEHICLE.WHEEL_WIDTH = width;
        // ホイールのメッシュを更新
        if (this.wheelMeshes.length > 0) {
            const wheelGeometry = new THREE.CylinderGeometry(
                CONFIG.VEHICLE.WHEEL_RADIUS,
                CONFIG.VEHICLE.WHEEL_RADIUS,
                width,
                32
            );
            this.wheelMeshes.forEach(mesh => {
                mesh.geometry.dispose();
                mesh.geometry = wheelGeometry;
            });
        }
    }
    
    updateSuspensionStiffness(stiffness) {
        CONFIG.VEHICLE.WHEEL_SUSPENSION_STIFFNESS = stiffness;
        if (this.vehicle) {
            this.vehicle.wheelInfos.forEach(wheel => {
                wheel.suspensionStiffness = stiffness;
            });
        }
    }
    
    updateSuspensionDamping(damping) {
        CONFIG.VEHICLE.WHEEL_SUSPENSION_DAMPING = damping;
        if (this.vehicle) {
            this.vehicle.wheelInfos.forEach(wheel => {
                wheel.dampingRelaxation = damping;
            });
        }
    }
    
    updateSuspensionCompression(compression) {
        CONFIG.VEHICLE.WHEEL_SUSPENSION_COMPRESSION = compression;
        if (this.vehicle) {
            this.vehicle.wheelInfos.forEach(wheel => {
                wheel.dampingCompression = compression;
            });
        }
    }
    
    updateSuspensionRestLength(length) {
        CONFIG.VEHICLE.WHEEL_SUSPENSION_REST_LENGTH = length;
        if (this.vehicle) {
            this.vehicle.wheelInfos.forEach(wheel => {
                wheel.suspensionRestLength = length;
            });
        }
    }
    
    updateWheelFriction(friction) {
        CONFIG.VEHICLE.WHEEL_FRICTION_SLIP = friction;
        if (this.vehicle) {
            this.vehicle.wheelInfos.forEach(wheel => {
                wheel.frictionSlip = friction;
            });
        }
    }
    
    updateChassisWidth(width) {
        CONFIG.VEHICLE.CHASSIS_SIZE.x = width;
        // ホイール位置の調整
        if (this.vehicle) {
            const axisWidth = width * 0.42;
            this.vehicle.wheelInfos[0].chassisConnectionPointLocal.x = -axisWidth;
            this.vehicle.wheelInfos[1].chassisConnectionPointLocal.x = axisWidth;
            this.vehicle.wheelInfos[2].chassisConnectionPointLocal.x = -axisWidth;
            this.vehicle.wheelInfos[3].chassisConnectionPointLocal.x = axisWidth;
        }
    }
    
    updateChassisHeight(height) {
        CONFIG.VEHICLE.CHASSIS_SIZE.y = height;
        // 物理ボディは複雑なため更新しない（再作成が必要）
    }
    
    updateChassisLength(length) {
        CONFIG.VEHICLE.CHASSIS_SIZE.z = length;
        // ホイール位置の調整
        if (this.vehicle) {
            this.vehicle.wheelInfos[0].chassisConnectionPointLocal.z = length * 0.4;
            this.vehicle.wheelInfos[1].chassisConnectionPointLocal.z = length * 0.4;
            this.vehicle.wheelInfos[2].chassisConnectionPointLocal.z = -length * 0.4;
            this.vehicle.wheelInfos[3].chassisConnectionPointLocal.z = -length * 0.4;
        }
    }
    
    updateDownForce(force) {
        CONFIG.VEHICLE.STABILIZATION.DOWN_FORCE = force;
    }
    
    updateAngularDamping(damping) {
        CONFIG.VEHICLE.STABILIZATION.ANGULAR_DAMPING = damping;
        if (this.chassisBody) {
            this.chassisBody.angularDamping = damping;
        }
    }
    
    updateFrontWheelFriction(friction) {
        CONFIG.VEHICLE.WHEEL_FRONT_FRICTION_SLIP = friction;
        // フロントタイヤ（index 0, 1）のみ更新
        if (this.vehicle && this.vehicle.wheelInfos.length >= 2) {
            this.vehicle.wheelInfos[0].frictionSlip = friction;
            this.vehicle.wheelInfos[1].frictionSlip = friction;
        }
    }
    
    updateRearWheelFriction(friction) {
        CONFIG.VEHICLE.WHEEL_REAR_FRICTION_SLIP = friction;
        // リアタイヤ（index 2, 3）のみ更新
        if (this.vehicle && this.vehicle.wheelInfos.length >= 4) {
            this.vehicle.wheelInfos[2].frictionSlip = friction;
            this.vehicle.wheelInfos[3].frictionSlip = friction;
        }
    }
    
    // デバッグ表示の切り替え
    toggleDebugCollision() {
        this.showDebugCollision = !this.showDebugCollision;
        this.debugHelpers.forEach(helper => {
            helper.visible = this.showDebugCollision;
        });
        console.log(`Debug collision visualization: ${this.showDebugCollision ? 'ON' : 'OFF'}`);
        return this.showDebugCollision;
    }
}