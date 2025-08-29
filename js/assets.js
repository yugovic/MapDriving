import { CONFIG } from './config.js';
import { ASSETS_CONFIG } from './assets-config.js';

export class AssetsManager {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.assets = [];
        this.physicsBodies = [];
        this.init();
    }
    
    init() {
        console.log('=== AssetsManager初期化開始 ===');
        
        // localStorageの内容を確認
        console.log('localStorage全体の内容:');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            console.log(`  ${key}: ${localStorage.getItem(key)?.substring(0, 100)}...`);
        }
        
        // localStorageから設定を読み込み
        const savedConfig = this.loadFromLocalStorage();
        if (savedConfig) {
            console.log('エディターの設定を使用します');
            this.createFromConfig(savedConfig);
        } else {
            console.log('デフォルト設定を使用します');
            this.createFromConfig(ASSETS_CONFIG);
        }
        this.createStartFinishLine();
        
        console.log('=== AssetsManager初期化完了 ===');
    }
    
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('mapDrivingAssets');
            if (saved) {
                const config = JSON.parse(saved);
                console.log('エディターから設定を読み込みました:', config);
                return config;
            }
        } catch (e) {
            console.error('設定の読み込みエラー:', e);
        }
        return null;
    }
    
    createFromConfig(config) {
        console.log('設定からアセットを作成中...');
        console.log('設定内容:', config);
        
        if (config.cones) {
            console.log(`コーンを${config.cones.length}個作成`);
            this.createConesFromData(config.cones);
        }
        if (config.tireBarriers) {
            console.log(`タイヤバリアを${config.tireBarriers.length}個作成`);
            this.createTireBarriersFromData(config.tireBarriers);
        }
        if (config.cubeStacks) {
            console.log(`積み重ねキューブを${config.cubeStacks.length}個作成`);
            this.createCubeStacksFromData(config.cubeStacks);
        }
        if (config.objects3d) {
            console.log(`3Dオブジェクトを${config.objects3d.length}個作成`);
            this.create3DObjectsFromData(config.objects3d);
        }
    }
    
    createConesFromData(conesData) {
        console.log(`コーン作成開始: ${conesData.length}個`);
        
        const coneGeometry = new THREE.ConeGeometry(0.3, 1, 8);
        const coneMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff6600,
            metalness: 0.2,
            roughness: 0.8
        });
        
        conesData.forEach((pos, index) => {
            console.log(`コーン${index}を作成: position=(${pos.x}, ${pos.z}), rotation=${pos.rotation || 0}`);
            
            // Three.jsメッシュ
            const cone = new THREE.Mesh(coneGeometry, coneMaterial);
            cone.position.set(pos.x, 0.5, pos.z);
            if (pos.rotation) {
                cone.rotation.y = (pos.rotation * Math.PI) / 180;
            }
            cone.castShadow = true;
            cone.receiveShadow = true;
            cone.userData.type = 'cone';
            cone.userData.index = index;
            this.scene.add(cone);
            this.assets.push(cone);
            
            console.log(`コーン${index}をシーンに追加しました`);
            
            // CANNON.js物理ボディ
            const coneShape = new CANNON.Box(new CANNON.Vec3(0.3, 0.5, 0.3));
            const coneBody = new CANNON.Body({
                mass: ASSETS_CONFIG.physics.cone.mass,
                shape: coneShape,
                position: new CANNON.Vec3(pos.x, 0.5, pos.z)
            });
            
            // 回転を物理ボディにも適用
            if (pos.rotation) {
                const quaternion = new CANNON.Quaternion();
                quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), (pos.rotation * Math.PI) / 180);
                coneBody.quaternion = quaternion;
            }
            
            coneBody.material = new CANNON.Material({
                friction: ASSETS_CONFIG.physics.cone.friction,
                restitution: ASSETS_CONFIG.physics.cone.restitution
            });
            
            // メッシュとボディを関連付け
            cone.userData.body = coneBody;
            coneBody.userData = { mesh: cone };
            
            this.physicsWorld.world.addBody(coneBody);
            this.physicsBodies.push(coneBody);
            
            console.log(`コーン${index}の物理ボディを追加しました`);
        });
        
        console.log(`コーン作成完了: ${this.assets.filter(a => a.userData.type === 'cone').length}個のコーンがシーンに存在`);
    }
    
    createTireBarriersFromData(tireData) {
        console.log(`タイヤバリア作成開始: ${tireData.length}個`);
        
        const tireGeometry = new THREE.TorusGeometry(0.5, 0.3, 8, 16);
        const tireMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            metalness: 0.1,
            roughness: 0.9
        });
        
        tireData.forEach((pos, index) => {
            console.log(`タイヤ${index}を作成: position=(${pos.x}, ${pos.z}), rotation=${pos.rotation || 0}`);
            
            // Three.jsメッシュ
            const tire = new THREE.Mesh(tireGeometry, tireMaterial);
            tire.position.set(pos.x, 0.3, pos.z);
            tire.rotation.z = Math.PI / 2;
            if (pos.rotation) {
                tire.rotation.y = (pos.rotation * Math.PI) / 180;
            }
            tire.castShadow = true;
            tire.receiveShadow = true;
            tire.userData.type = 'tire';
            tire.userData.index = index;
            this.scene.add(tire);
            this.assets.push(tire);
            
            console.log(`タイヤ${index}をシーンに追加しました`);
            
            // CANNON.js物理ボディ（円筒形）
            const tireShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
            const tireBody = new CANNON.Body({
                mass: ASSETS_CONFIG.physics.tire.mass,
                shape: tireShape,
                position: new CANNON.Vec3(pos.x, 0.5, pos.z)
            });
            tireBody.material = new CANNON.Material({
                friction: ASSETS_CONFIG.physics.tire.friction,
                restitution: ASSETS_CONFIG.physics.tire.restitution
            });
            
            // 初期回転を設定
            const quaternion = new CANNON.Quaternion();
            quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);
            tireBody.quaternion = quaternion;
            
            // メッシュとボディを関連付け
            tire.userData.body = tireBody;
            tireBody.userData = { mesh: tire };
            
            this.physicsWorld.world.addBody(tireBody);
            this.physicsBodies.push(tireBody);
            
            console.log(`タイヤ${index}の物理ボディを追加しました`);
        });
        
        console.log(`タイヤバリア作成完了: ${this.assets.filter(a => a.userData.type === 'tire').length}個のタイヤがシーンに存在`);
    }
    
    createCubeStacksFromData(cubeStackData) {
        console.log(`積み重ねキューブ作成開始: ${cubeStackData.length}個のスタック`);
        
        const cubeSize = ASSETS_CONFIG.physics.cube.size || 1.5;
        const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const cubeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4488cc,
            metalness: 0.3,
            roughness: 0.7
        });
        
        cubeStackData.forEach((stack, stackIndex) => {
            const count = stack.count || 3;
            console.log(`スタック${stackIndex}を作成: position=(${stack.x}, ${stack.z}), count=${count}`);
            
            for (let i = 0; i < count; i++) {
                // Three.jsメッシュ
                const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
                const yPos = cubeSize * 0.5 + i * cubeSize;
                cube.position.set(stack.x, yPos, stack.z);
                if (stack.rotation) {
                    cube.rotation.y = (stack.rotation * Math.PI) / 180;
                }
                cube.castShadow = true;
                cube.receiveShadow = true;
                cube.userData.type = 'cubeStack';
                cube.userData.stackIndex = stackIndex;
                cube.userData.level = i;
                this.scene.add(cube);
                this.assets.push(cube);
                
                // Cannon.js物理ボディ
                const cubeShape = new CANNON.Box(new CANNON.Vec3(cubeSize/2, cubeSize/2, cubeSize/2));
                const cubeBody = new CANNON.Body({
                    mass: ASSETS_CONFIG.physics.cube.mass,
                    shape: cubeShape,
                    position: new CANNON.Vec3(stack.x, yPos, stack.z)
                });
                
                if (stack.rotation) {
                    const quaternion = new CANNON.Quaternion();
                    quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), (stack.rotation * Math.PI) / 180);
                    cubeBody.quaternion = quaternion;
                }
                
                cubeBody.material = new CANNON.Material({
                    friction: ASSETS_CONFIG.physics.cube.friction,
                    restitution: ASSETS_CONFIG.physics.cube.restitution
                });
                
                // メッシュとボディを関連付け
                cube.userData.body = cubeBody;
                cubeBody.userData = { mesh: cube };
                
                this.physicsWorld.world.addBody(cubeBody);
                this.physicsBodies.push(cubeBody);
            }
        });
        
        console.log(`積み重ねキューブ作成完了: ${this.assets.filter(a => a.userData.type === 'cubeStack').length}個のキューブがシーンに存在`);
    }
    
    create3DObjectsFromData(objects3dData) {
        console.log(`3Dオブジェクト作成開始: ${objects3dData.length}個`);
        
        const loader = new THREE.GLTFLoader();
        const scale = ASSETS_CONFIG.physics.object3d.scale || 1.0;
        
        objects3dData.forEach((obj, index) => {
            const modelPath = this.getModelPath(obj.type);
            if (!modelPath) {
                console.warn(`不明なオブジェクトタイプ: ${obj.type}`);
                return;
            }
            
            loader.load(modelPath, (gltf) => {
                const model = gltf.scene;
                
                // スケール調整を先に適用
                const objectScale = this.getObjectScale(obj.type);
                model.scale.set(objectScale, objectScale, objectScale);
                
                // 全ての変換行列を更新
                model.updateMatrixWorld(true);
                
                // モデルの各メッシュのバウンディングボックスを計算してマージ
                const box = new THREE.Box3();
                let firstBox = true;
                
                model.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        // ジオメトリのバウンディングボックスを計算
                        child.geometry.computeBoundingBox();
                        const meshBox = child.geometry.boundingBox.clone();
                        
                        // メッシュのワールド変換を適用
                        meshBox.applyMatrix4(child.matrixWorld);
                        
                        if (firstBox) {
                            box.copy(meshBox);
                            firstBox = false;
                        } else {
                            box.union(meshBox);
                        }
                    }
                });
                
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                // モデルを地面に接地させる
                const groundOffset = -box.min.y;
                model.position.set(obj.x, groundOffset, obj.z);
                
                if (obj.rotation) {
                    model.rotation.y = (obj.rotation * Math.PI) / 180;
                }
                
                // 影の設定
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                model.userData.type = 'object3d';
                model.userData.subType = obj.type;
                model.userData.index = index;
                model.userData.boundingBox = box;
                model.userData.size = size;
                model.userData.groundOffset = groundOffset; // 地面からのオフセットを保存
                this.scene.add(model);
                this.assets.push(model);
                
                // 物理ボディの追加（実際のバウンディングボックスに基づく）
                this.createPhysicsBodyFor3DObjectWithBox(model, obj.type, obj.x, obj.z, size, groundOffset);
                
                console.log(`3Dオブジェクト「${obj.type}」を読み込みました`);
                console.log(`  位置: (${obj.x}, ${groundOffset.toFixed(2)}, ${obj.z})`);
                console.log(`  スケール: ${objectScale}`);
                console.log(`  実際のサイズ: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
                console.log(`  バウンディングボックス: min(${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}) max(${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)}`);
                console.log(`  地面オフセット: ${groundOffset.toFixed(2)}`);
            }, (progress) => {
                // 読み込み進捗
            }, (error) => {
                console.error(`3Dオブジェクト「${obj.type}」の読み込みエラー:`, error);
            });
        });
        
        console.log(`3Dオブジェクト作成完了`);
    }
    
    getModelPath(type) {
        const modelPaths = {
            'bigRoadSign': 'assets/Object/BigRoadSign.glb',
            'newsPaperStand': 'assets/Object/NewsPaperStand.glb',
            'roadBlock': 'assets/Object/RoadBlock.glb',
            'toyDuck': 'assets/Object/ToyDuck.glb',
            'tramStop': 'assets/Object/TramStop.glb',
            'tree': 'assets/Object/Tree.glb'
        };
        return modelPaths[type];
    }
    
    getObjectScale(type) {
        // 各オブジェクトのスケール調整
        const scales = {
            'bigRoadSign': 0.5,
            'newsPaperStand': 0.8,
            'roadBlock': 1.0,
            'toyDuck': 0.3,
            'tramStop': 0.6,
            'tree': 1.5
        };
        return scales[type] || 1.0;
    }
    
    createPhysicsBodyFor3DObject(model, type, x, z) {
        // 簡易的なボックスコライダーを作成
        const sizes = {
            'bigRoadSign': { x: 4, y: 5, z: 0.5 },
            'newsPaperStand': { x: 1, y: 1.5, z: 1 },
            'roadBlock': { x: 2, y: 1, z: 0.5 },
            'toyDuck': { x: 1, y: 1, z: 1 },
            'tramStop': { x: 3, y: 3, z: 1 },
            'tree': { x: 1, y: 5, z: 1 }
        };
        
        const size = sizes[type] || { x: 1, y: 1, z: 1 };
        const shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
        const body = new CANNON.Body({
            mass: 0, // 静的オブジェクト
            shape: shape,
            position: new CANNON.Vec3(x, size.y/2, z)
        });
        
        model.userData.body = body;
        body.userData = { mesh: model };
        
        this.physicsWorld.world.addBody(body);
        this.physicsBodies.push(body);
    }
    
    createPhysicsBodyFor3DObjectWithBox(model, type, x, z, actualSize, groundOffset) {
        // 物理ボディ用のサイズ（実際のサイズより少し小さめに設定することも可能）
        const physicsSize = {
            x: actualSize.x * 0.9,  // 少し小さめにして、見た目より当たり判定を控えめに
            y: actualSize.y * 0.95,
            z: actualSize.z * 0.9
        };
        
        const shape = new CANNON.Box(new CANNON.Vec3(
            physicsSize.x/2,
            physicsSize.y/2,
            physicsSize.z/2
        ));
        
        // 物理ボディの位置を調整（地面オフセットを考慮）
        const body = new CANNON.Body({
            mass: 0, // 静的オブジェクト
            shape: shape,
            position: new CANNON.Vec3(x, groundOffset + physicsSize.y/2, z)
        });
        
        model.userData.body = body;
        model.userData.physicsHalfHeight = physicsSize.y / 2; // 物理ボディの半分の高さを保存
        body.userData = { mesh: model };
        
        this.physicsWorld.world.addBody(body);
        this.physicsBodies.push(body);
        
        console.log(`物理ボディを作成: ${type}`);
        console.log(`  物理ボディ位置: Y=${(groundOffset + physicsSize.y/2).toFixed(2)}`);
        console.log(`  物理サイズ: ${physicsSize.x.toFixed(2)} x ${physicsSize.y.toFixed(2)} x ${physicsSize.z.toFixed(2)}`);
    }
    
    createStartFinishLine() {
        console.log('スタートラインを作成（物理ボディなし）');
        
        const lineGeometry = new THREE.PlaneGeometry(10, 0.5);
        const lineMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.2,
            side: THREE.DoubleSide  // 両面表示
        });
        
        const startLine = new THREE.Mesh(lineGeometry, lineMaterial);
        startLine.rotation.x = -Math.PI / 2;
        startLine.position.set(0, -0.01, 0);  // 地面より少し下に配置
        startLine.userData.type = 'startLine';
        startLine.receiveShadow = true;  // 影を受ける設定
        this.scene.add(startLine);
        this.assets.push(startLine);
        
        // チェッカーパターン
        const checkerSize = 0.5;
        for (let i = -5; i < 5; i++) {
            for (let j = 0; j < 1; j++) {
                if ((i + j) % 2 === 0) {
                    const checkerGeometry = new THREE.PlaneGeometry(checkerSize, checkerSize);
                    const checkerMaterial = new THREE.MeshStandardMaterial({ 
                        color: 0x000000
                    });
                    const checker = new THREE.Mesh(checkerGeometry, checkerMaterial);
                    checker.rotation.x = -Math.PI / 2;
                    checker.position.set(i * checkerSize + checkerSize / 2, -0.005, j * checkerSize - 0.25);  // 地面とほぼ同じ高さ
                    checker.userData.type = 'checker';
                    checker.receiveShadow = true;
                    this.scene.add(checker);
                    this.assets.push(checker);
                }
            }
        }
    }
    
    update() {
        // 物理ボディの位置と回転をメッシュに反映
        this.physicsBodies.forEach(body => {
            if (body.userData && body.userData.mesh) {
                const mesh = body.userData.mesh;
                
                // 3Dオブジェクトの場合、地面オフセットを考慮
                if (mesh.userData.type === 'object3d' && mesh.userData.groundOffset !== undefined && mesh.userData.physicsHalfHeight !== undefined) {
                    // 物理ボディの位置から視覚モデルの正しい位置を計算
                    mesh.position.x = body.position.x;
                    mesh.position.y = body.position.y - mesh.userData.physicsHalfHeight + mesh.userData.groundOffset;
                    mesh.position.z = body.position.z;
                } else {
                    // その他のオブジェクトは通常通り
                    mesh.position.copy(body.position);
                }
                
                mesh.quaternion.copy(body.quaternion);
            }
        });
        
        // デバッグ: キューブスタックの表示状態を確認（一度だけ）
        if (!this._cubeStackDebugLogged) {
            const cubeStacks = this.assets.filter(a => a.userData.type === 'cubeStack');
            if (cubeStacks.length > 0) {
                console.log('キューブスタックの状態:');
                cubeStacks.forEach((cube, i) => {
                    console.log(`  キューブ${i}: visible=${cube.visible}, position=(${Math.round(cube.position.x)}, ${Math.round(cube.position.y)}, ${Math.round(cube.position.z)}), スタックID=${cube.userData.stackIndex}, レベル=${cube.userData.level}`);
                });
                this._cubeStackDebugLogged = true;
            }
        }
    }
    
    updateScale(scale) {
        // マップのスケールに合わせてアセットの位置も調整
        this.assets.forEach((asset, index) => {
            if (asset.userData.originalPosition) {
                asset.position.x = asset.userData.originalPosition.x * scale;
                asset.position.z = asset.userData.originalPosition.z * scale;
            } else {
                asset.userData.originalPosition = {
                    x: asset.position.x,
                    z: asset.position.z
                };
            }
            
            // 物理ボディの位置も更新
            if (asset.userData.body) {
                asset.userData.body.position.x = asset.position.x;
                asset.userData.body.position.z = asset.position.z;
            }
        });
    }
    
    // カスタムアセット追加メソッド（将来の拡張用）
    addCustomAsset(type, position) {
        if (type === 'cone') {
            // 既存のcreateConesメソッドのロジックを使用
            // 単一のコーンを追加
        } else if (type === 'tire') {
            // 既存のcreateTireBarriersメソッドのロジックを使用
            // 単一のタイヤを追加
        }
    }
    
    // エディターから設定を再読み込み
    reloadFromEditor() {
        console.log('=== エディターから再読み込み開始 ===');
        
        // localStorageから直接読み込み（clearAllAssetsの前に）
        let savedConfig = null;
        try {
            console.log('localStorageキーをチェック中...');
            const savedData = localStorage.getItem('mapDrivingAssets');
            console.log('localStorage.getItem結果:', savedData ? `データあり(${savedData.length}文字)` : 'データなし');
            
            if (savedData) {
                savedConfig = JSON.parse(savedData);
                console.log('パース成功:', savedConfig);
                console.log('  - コーン数:', savedConfig.cones ? savedConfig.cones.length : 0);
                console.log('  - タイヤバリア数:', savedConfig.tireBarriers ? savedConfig.tireBarriers.length : 0);
                console.log('  - 積み重ねキューブ数:', savedConfig.cubeStacks ? savedConfig.cubeStacks.length : 0);
                console.log('  - スケール:', savedConfig.scale);
                console.log('  - タイムスタンプ:', new Date(savedConfig.timestamp).toLocaleString());
            }
        } catch (e) {
            console.error('localStorage読み込みエラー:', e);
        }
        
        // 既存のアセットをクリア
        this.clearAllAssets();
        
        // 読み込んだ設定で再作成
        if (savedConfig) {
            console.log('エディターの設定を適用します');
            this.createFromConfig(savedConfig);
            
            // スタートラインを再作成（clearAllAssetsで削除された場合）
            const hasStartLine = this.assets.some(asset => 
                !asset.userData || (!asset.userData.type || 
                (asset.userData.type !== 'cone' && asset.userData.type !== 'tire'))
            );
            if (!hasStartLine) {
                console.log('スタートラインを再作成します');
                this.createStartFinishLine();
            }
            
            alert('エディターから設定を再読み込みしました');
        } else {
            console.log('localStorageに設定が見つかりません。デフォルト設定を使用します。');
            this.createFromConfig(ASSETS_CONFIG);
            alert('エディターの設定が見つかりません。デフォルト設定を使用しました。');
        }
        
        console.log('=== エディターから再読み込み完了 ===');
        console.log('最終的なアセット数:', this.assets.length);
        console.log('最終的な物理ボディ数:', this.physicsBodies.length);
        
        // アセットの種類ごとの詳細
        const assetCounts = {};
        const physicsAssets = [];
        const noPhysicsAssets = [];
        
        this.assets.forEach((asset, index) => {
            const type = asset.userData.type || 'unknown';
            assetCounts[type] = (assetCounts[type] || 0) + 1;
            
            if (asset.userData.body) {
                physicsAssets.push(`${type} at (${Math.round(asset.position.x)}, ${Math.round(asset.position.z)})`);
            } else {
                noPhysicsAssets.push(`${type} at (${Math.round(asset.position.x)}, ${Math.round(asset.position.z)})`);
            }
        });
        
        console.log('アセットの種類別カウント:');
        Object.entries(assetCounts).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}個`);
        });
        
        console.log('物理ボディを持つアセット:', physicsAssets.length);
        console.log('物理ボディを持たないアセット:', noPhysicsAssets.length);
        if (noPhysicsAssets.length > 0) {
            console.log('物理ボディなし:', noPhysicsAssets);
        }
    }
    
    clearAllAssets() {
        console.log('既存アセットをクリア中...');
        console.log('削除前のアセット数:', this.assets.length);
        console.log('削除前の物理ボディ数:', this.physicsBodies.length);
        
        // スタートライン以外のThree.jsメッシュを削除
        const assetsToRemove = this.assets.filter(asset => 
            asset.userData.type === 'cone' || asset.userData.type === 'tire' || asset.userData.type === 'cubeStack'
        );
        
        console.log('削除対象のアセット数:', assetsToRemove.length);
        
        assetsToRemove.forEach(asset => {
            console.log(`削除中: ${asset.userData.type} at (${asset.position.x}, ${asset.position.z})`);
            this.scene.remove(asset);
            if (asset.geometry) asset.geometry.dispose();
            if (asset.material) asset.material.dispose();
            // userDataのクリア
            if (asset.userData.body) {
                asset.userData.body = null;
            }
        });
        
        // スタートライン以外を削除
        this.assets = this.assets.filter(asset => 
            asset.userData.type !== 'cone' && asset.userData.type !== 'tire'
        );
        
        // 物理ボディを削除
        console.log('物理ボディを削除中...');
        this.physicsBodies.forEach(body => {
            console.log(`物理ボディ削除: position=(${body.position.x}, ${body.position.z})`);
            // userDataのクリア
            if (body.userData) {
                body.userData.mesh = null;
                body.userData = null;
            }
            this.physicsWorld.world.removeBody(body);
        });
        this.physicsBodies = [];
        
        console.log('削除後のアセット数:', this.assets.length);
        console.log('削除後の物理ボディ数:', this.physicsBodies.length);
        console.log('シーンの子要素数:', this.scene.children.length);
    }
}