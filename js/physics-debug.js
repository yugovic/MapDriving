export class PhysicsDebugRenderer {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.debugMeshes = [];
        this.bodyMeshMap = new Map(); // ボディとメッシュの対応関係を保存
        this.enabled = false;
        
        // 地面のデバッグメッシュ
        this.groundHelper = null;
        this.createGroundHelper();
    }
    
    createGroundHelper() {
        // グリッドヘルパーで地面を可視化
        const gridSize = 200;
        const gridDivisions = 40;
        this.groundHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x00ff00, 0x444444);
        this.groundHelper.position.y = 0;
        this.groundHelper.visible = false;
        this.scene.add(this.groundHelper);
    }
    
    toggle() {
        this.enabled = !this.enabled;
        this.groundHelper.visible = this.enabled;
        
        // 物理ボディのデバッグ表示も切り替え
        this.updateDebugMeshes();
        
        return this.enabled;
    }
    
    updateDebugMeshes() {
        // 既存のデバッグメッシュをクリア
        this.debugMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.debugMeshes = [];
        this.bodyMeshMap.clear();
        
        if (!this.enabled) return;
        
        // 全ての物理ボディをワイヤーフレームで表示
        this.physicsWorld.world.bodies.forEach((body, bodyIndex) => {
            const bodyMeshes = [];
            
            if (body.shapes.length > 0) {
                body.shapes.forEach((shape, shapeIndex) => {
                    const mesh = this.createDebugMesh(shape, body);
                    if (mesh) {
                        // このメッシュをボディと関連付け
                        mesh.userData = { 
                            body: body, 
                            shapeIndex: shapeIndex,
                            shapeOffset: body.shapeOffsets ? body.shapeOffsets[shapeIndex] : null
                        };
                        
                        this.scene.add(mesh);
                        this.debugMeshes.push(mesh);
                        bodyMeshes.push(mesh);
                    }
                });
            }
            
            // ボディとそのメッシュの関連を保存
            if (bodyMeshes.length > 0) {
                this.bodyMeshMap.set(body, bodyMeshes);
            }
        });
        
        // 初回の位置更新
        this.updateMeshPositions();
    }
    
    createDebugMesh(shape, body) {
        let geometry;
        const material = new THREE.MeshBasicMaterial({
            color: body.type === CANNON.Body.STATIC ? 0x0000ff : 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.5
        });
        
        if (shape instanceof CANNON.Box) {
            const halfExtents = shape.halfExtents;
            geometry = new THREE.BoxGeometry(
                halfExtents.x * 2,
                halfExtents.y * 2,
                halfExtents.z * 2
            );
        } else if (shape instanceof CANNON.Sphere) {
            geometry = new THREE.SphereGeometry(shape.radius, 16, 16);
        } else if (shape instanceof CANNON.Plane) {
            // 平面は大きなボックスで表現
            geometry = new THREE.BoxGeometry(200, 0.1, 200);
        } else if (shape instanceof CANNON.Cylinder) {
            // シリンダーの場合
            geometry = new THREE.CylinderGeometry(shape.radiusTop, shape.radiusBottom, shape.height, 16);
        } else {
            return null;
        }
        
        return new THREE.Mesh(geometry, material);
    }
    
    updateMeshPositions() {
        // 各メッシュの位置を対応するボディに合わせて更新
        this.debugMeshes.forEach(mesh => {
            const userData = mesh.userData;
            if (userData && userData.body) {
                const body = userData.body;
                
                // ボディの位置と回転を適用
                mesh.position.copy(body.position);
                mesh.quaternion.copy(body.quaternion);
                
                // シェイプのオフセットがある場合、ローカル座標として適用
                if (userData.shapeOffset) {
                    const offset = userData.shapeOffset;
                    // オフセットをワールド座標に変換
                    const worldOffset = new THREE.Vector3(offset.x, offset.y, offset.z);
                    worldOffset.applyQuaternion(mesh.quaternion);
                    mesh.position.add(worldOffset);
                }
            }
        });
    }
    
    update() {
        if (!this.enabled) return;
        
        // 全てのメッシュの位置を更新
        this.updateMeshPositions();
    }
}