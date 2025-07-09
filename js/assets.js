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
        if (config.cones) {
            console.log(`コーンを${config.cones.length}個作成`);
            this.createConesFromData(config.cones);
        }
        if (config.tireBarriers) {
            console.log(`タイヤバリアを${config.tireBarriers.length}個作成`);
            this.createTireBarriersFromData(config.tireBarriers);
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
    
    createStartFinishLine() {
        const lineGeometry = new THREE.PlaneGeometry(10, 0.5);
        const lineMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.2
        });
        
        const startLine = new THREE.Mesh(lineGeometry, lineMaterial);
        startLine.rotation.x = -Math.PI / 2;
        startLine.position.set(0, 0.01, 0);
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
                    checker.position.set(i * checkerSize + checkerSize / 2, 0.02, j * checkerSize - 0.25);
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
                mesh.position.copy(body.position);
                mesh.quaternion.copy(body.quaternion);
            }
        });
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
        console.log('シーン内のオブジェクト一覧:');
        this.assets.forEach((asset, index) => {
            console.log(`  ${index}: type=${asset.userData.type || 'unknown'}, position=(${asset.position.x}, ${asset.position.z})`);
        });
    }
    
    clearAllAssets() {
        console.log('既存アセットをクリア中...');
        console.log('削除前のアセット数:', this.assets.length);
        console.log('削除前の物理ボディ数:', this.physicsBodies.length);
        
        // スタートライン以外のThree.jsメッシュを削除
        const assetsToRemove = this.assets.filter(asset => 
            asset.userData.type === 'cone' || asset.userData.type === 'tire'
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