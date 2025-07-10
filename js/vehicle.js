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
    }
    
    createChassis(position) {
        const chassisShape = new CANNON.Box(new CANNON.Vec3(
            CONFIG.VEHICLE.CHASSIS_SIZE.x / 2,
            CONFIG.VEHICLE.CHASSIS_SIZE.y / 2,
            CONFIG.VEHICLE.CHASSIS_SIZE.z / 2
        ));
        
        this.chassisBody = new CANNON.Body({
            mass: CONFIG.VEHICLE.MASS,
            shape: chassisShape
        });
        this.chassisBody.position.set(position.x, position.y, position.z);
        
        const geometry = new THREE.BoxGeometry(
            CONFIG.VEHICLE.CHASSIS_SIZE.x,
            CONFIG.VEHICLE.CHASSIS_SIZE.y,
            CONFIG.VEHICLE.CHASSIS_SIZE.z
        );
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            metalness: 0.6,
            roughness: 0.4,
            visible: false
        });
        
        this.chassisMesh = new THREE.Mesh(geometry, material);
        this.chassisMesh.castShadow = false;
        this.chassisMesh.receiveShadow = false;
        this.scene.add(this.chassisMesh);
        
        this.loadCarModel();
    }
    
    loadCarModel() {
        const loader = new THREE.GLTFLoader();
        loader.load('assets/Cars/rx7_sabana.glb', (gltf) => {
            const model = gltf.scene;
            model.scale.set(0.02, 0.02, 0.02);
            model.position.set(0, -0.3, 0);
            
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            this.chassisMesh.add(model);
            this.isLoaded = true;
            document.getElementById('loading').style.display = 'none';
        }, (progress) => {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
        }, (error) => {
            console.error('Error loading model:', error);
            this.isLoaded = true;
            document.getElementById('loading').style.display = 'none';
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
}