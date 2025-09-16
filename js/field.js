import { CONFIG } from './config.js';

export class FieldManager {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.fieldGroup = null;
        this.colliderBodies = [];
        this.floorBodies = [];
        this.floorSurfaceY = undefined;
        this.floorDetectionInfo = null;
        this.spawnInfo = null;
        this.loaded = false;

        if (CONFIG.FIELD && CONFIG.FIELD.ENABLED) {
            this.load();
        }
    }

    load() {
        const loader = new THREE.GLTFLoader();
        const file = CONFIG.FIELD.GLB_FILE || 'Field/FJ_CIRCUIT_Revised.glb';

        // assets/ と Asset/ を順に試行
        const candidates = [
            `assets/${file}`,
            `Asset/${file}`
        ];

        const tryLoad = (index = 0) => {
            if (index >= candidates.length) {
                console.error('Field GLB の読み込みに失敗しました。パスを確認してください:', candidates);
                return;
            }

            const url = candidates[index];
            loader.load(
                url,
                (gltf) => this.onLoaded(gltf),
                undefined,
                (err) => {
                    console.warn(`フィールド読み込み失敗: ${url}`, err);
                    tryLoad(index + 1);
                }
            );
        };

        tryLoad(0);
    }

    onLoaded(gltf) {
        const group = gltf.scene;
        this.fieldGroup = group;

        // 影設定
        group.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    child.material.needsUpdate = true;
                }
            }
        });

        // 追加
        this.scene.add(group);

        // 初期トランスフォーム適用＋コライダー生成
        this.applyTransformFromConfig();

        this.loaded = true;
        console.log('[Field] 読み込み完了: メッシュ数 =', this._countMeshes(group));
    }

    _countMeshes(root) {
        let c = 0;
        root.traverse((ch) => { if (ch.isMesh) c++; });
        return c;
    }

    _createTrimeshShapeFromMesh(mesh) {
        if (!mesh || !mesh.geometry || !mesh.geometry.attributes) return null;
        const positionAttr = mesh.geometry.attributes.position;
        if (!positionAttr || positionAttr.count === 0) return null;

        const vertexCount = positionAttr.count;
        const vertices = new Float32Array(vertexCount * 3);
        const v = new THREE.Vector3();

        for (let i = 0; i < vertexCount; i++) {
            v.fromBufferAttribute(positionAttr, i);
            v.applyMatrix4(mesh.matrixWorld);
            const idx = i * 3;
            vertices[idx] = v.x;
            vertices[idx + 1] = v.y;
            vertices[idx + 2] = v.z;
        }

        let indices;
        if (mesh.geometry.index && mesh.geometry.index.count > 0) {
            indices = Uint32Array.from(mesh.geometry.index.array);
        } else {
            indices = new Uint32Array(vertexCount);
            for (let i = 0; i < vertexCount; i++) {
                indices[i] = i;
            }
        }

        if (indices.length < 3) return null;

        if (!CANNON.Trimesh) {
            console.warn('[Field] CANNON.Trimesh が利用できないため、メッシュコライダーを生成できません');
            return null;
        }

        return new CANNON.Trimesh(vertices, indices);
    }

    _collectMeshesByNameHints(root, hints) {
        if (!root || !hints || !hints.length) return [];
        const normalizedHints = hints
            .map(h => (typeof h === 'string' ? h.trim() : ''))
            .filter(Boolean)
            .map(h => h.toLowerCase());
        if (!normalizedHints.length) return [];

        const matches = [];
        const nameMatches = (name) => {
            if (!name) return false;
            const normalized = name.toLowerCase();
            return normalizedHints.some((hint) => {
                const idx = normalized.indexOf(hint);
                if (idx === -1) return false;
                const before = idx === 0 ? '' : normalized[idx - 1];
                const afterIdx = idx + hint.length;
                const after = afterIdx >= normalized.length ? '' : normalized[afterIdx];
                const beforeOk = !before || !/[a-z0-9]/.test(before);
                const afterOk = !after || !/[a-z0-9]/.test(after);
                return beforeOk && afterOk;
            });
        };

        root.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            let current = child;
            while (current) {
                if (nameMatches(current.name || '')) {
                    if (!matches.includes(child)) {
                        matches.push(child);
                    }
                    break;
                }
                current = current.parent;
            }
        });

        return matches;
    }

    createNamedGroundColliders(root) {
        const configHints = (CONFIG.FIELD.GROUND_NAME_HINTS || []).filter(Boolean);
        if (!configHints.length) return false;

        const matchedMeshes = this._collectMeshesByNameHints(root, configHints);
        if (!matchedMeshes.length) {
            return false;
        }

        const mat = this.physicsWorld.groundMaterial || new CANNON.Material('field-ground');
        const combinedBox = new THREE.Box3();
        let hasBounds = false;
        const createdBodies = [];

        matchedMeshes.forEach((mesh) => {
            const shape = this._createTrimeshShapeFromMesh(mesh);
            if (!shape) return;

            const body = new CANNON.Body({
                mass: 0,
                material: mat,
                type: CANNON.Body.STATIC
            });
            body.addShape(shape);
            body.userData = { tag: 'field-ground', meshName: mesh.name };

            this.physicsWorld.world.addBody(body);
            this.colliderBodies.push(body);
            this.floorBodies.push(body);
            createdBodies.push(body);

            mesh.geometry.computeBoundingBox();
            const meshBox = mesh.geometry.boundingBox.clone();
            meshBox.applyMatrix4(mesh.matrixWorld);
            if (!hasBounds) {
                combinedBox.copy(meshBox);
                hasBounds = true;
            } else {
                combinedBox.union(meshBox);
            }
        });

        if (!createdBodies.length) {
            console.warn('[Field] Ground 名称ヒントに一致するメッシュから有効なコライダーを生成できませんでした');
            return false;
        }

        if (CONFIG.FIELD.USE_AS_GROUND && this.physicsWorld.removeGround) {
            this.physicsWorld.removeGround();
        }

        this.floorSurfaceY = combinedBox.max.y;
        this.floorDetectionInfo = {
            method: 'namedMeshes',
            hints: configHints,
            meshCount: createdBodies.length,
            aabbMin: { x: combinedBox.min.x, y: combinedBox.min.y, z: combinedBox.min.z },
            aabbMax: { x: combinedBox.max.x, y: combinedBox.max.y, z: combinedBox.max.z },
            surfaceY: this.floorSurfaceY
        };

        console.log('[Field] Ground 名称からコライダーを生成:', {
            meshCount: createdBodies.length,
            hints: configHints
        });

        return true;
    }

    createSidewallColliders(root) {
        const configHints = (CONFIG.FIELD.SIDEWALL_NAME_HINTS || []).filter(Boolean);
        if (!configHints.length) return 0;

        const matchedMeshes = this._collectMeshesByNameHints(root, configHints);
        if (!matchedMeshes.length) return 0;

        const mat = this.physicsWorld.groundMaterial || new CANNON.Material('field-sidewall');
        if (!this.physicsWorld.groundMaterial) {
            mat.friction = 0.8;
            mat.restitution = 0.05;
        }

        let created = 0;
        matchedMeshes.forEach((mesh) => {
            const shape = this._createTrimeshShapeFromMesh(mesh);
            if (!shape) return;

            const body = new CANNON.Body({
                mass: 0,
                material: mat,
                type: CANNON.Body.STATIC
            });
            body.addShape(shape);
            body.userData = { tag: 'field-sidewall', meshName: mesh.name };

            this.physicsWorld.world.addBody(body);
            this.colliderBodies.push(body);
            created++;
        });

        if (created) {
            console.log('[Field] Sidewall コライダーを追加:', {
                meshCount: created,
                hints: configHints
            });
        }

        return created;
    }

    createPillarColliders(root) {
        const det = CONFIG.FIELD.PILLAR_DETECTION || {};
        const nameHints = det.NAME_HINTS || [];
        const ratio = det.HEIGHT_RATIO ?? 3.0;
        const maxDia = det.MAX_DIAMETER ?? 3.0;
        const shrink = det.COLLIDER_SHRINK ?? 0.9;

        // 共通マテリアル（環境）
        const mat = new CANNON.Material('field');
        // それなりの摩擦・低反発
        mat.friction = 0.7;
        mat.restitution = 0.1;

        const pillars = [];

        root.updateMatrixWorld(true);
        root.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;

            // 名前ヒント一致
            const name = (child.name || '') + '|' + ((child.parent && child.parent.name) || '');
            const hintHit = nameHints.some(h => name.includes(h));

            // バウンディングボックス（ワールド）
            child.geometry.computeBoundingBox();
            const localBox = child.geometry.boundingBox.clone();
            const worldBox = localBox.clone();
            worldBox.applyMatrix4(child.matrixWorld);

            const size = new THREE.Vector3();
            worldBox.getSize(size);
            const center = new THREE.Vector3();
            worldBox.getCenter(center);

            // 柱の形: 縦長・細い
            const w = size.x;
            const h = size.y;
            const d = size.z;
            const dia = Math.max(w, d);
            const isTall = h > ratio * Math.max(0.0001, Math.min(w, d));
            const isThin = dia <= maxDia;

            if (hintHit || (isTall && isThin)) {
                pillars.push({ child, size, center });
            }
        });

        console.log(`[Field] 柱候補: ${pillars.length} 個`);

        // コライダー生成
        pillars.forEach((p, i) => {
            const { child, size, center } = p;

            // 少し小さめにして遊びを作る
            const hx = Math.max(0.01, (size.x * shrink) / 2);
            const hy = Math.max(0.01, (size.y * shrink) / 2);
            const hz = Math.max(0.01, (size.z * shrink) / 2);

            const shape = new CANNON.Box(new CANNON.Vec3(hx, hy, hz));
            const body = new CANNON.Body({
                mass: 0,
                material: mat,
                shape
            });

            // 位置（ワールド基準）
            body.position.set(center.x, center.y, center.z);
            // AABBベースのサイズを使用するため、回転は適用しない（ワールド軸揃え）

            // 参照リンク
            body.userData = { mesh: child };

            this.physicsWorld.world.addBody(body);
            this.colliderBodies.push(body);
        });

        console.log('[Field] 柱コライダー追加:', this.colliderBodies.length);
    }

    clearColliders() {
        this.colliderBodies.forEach(b => {
            try { this.physicsWorld.world.removeBody(b); } catch (_) {}
        });
        this.colliderBodies = [];
        this.floorBodies = [];
        this.floorSurfaceY = undefined;
        this.floorDetectionInfo = null;
        this.spawnInfo = null;
    }

    rebuildColliders() {
        if (!this.fieldGroup) return;
        this.clearColliders();
        this.fieldGroup.updateMatrixWorld(true);
        // まず Ground 指定メッシュから地面コライダーを生成
        const hasNamedGround = this.createNamedGroundColliders(this.fieldGroup);
        // 対象が見つからなければ従来のAABBベースで床を作成
        if (!hasNamedGround) {
            this.ensureFloorCollider();
        }
        // サイドウォールの当たり判定
        this.createSidewallColliders(this.fieldGroup);
        // 次に柱などのコライダー
        this.createPillarColliders(this.fieldGroup);
        // リスポーン位置の検出
        this.detectSpawnPoint();
    }

    detectSpawnPoint() {
        if (!this.fieldGroup) return;
        const spawnConfig = CONFIG.FIELD.SPAWN || {};
        const hints = (spawnConfig.NAME_HINTS || []).filter(Boolean);

        let anchor = null;
        if (hints.length) {
            const matches = this._collectMeshesByNameHints(this.fieldGroup, hints);
            if (matches.length) {
                let best = null;
                let bestArea = -Infinity;
                matches.forEach((mesh) => {
                    if (!mesh.geometry) return;
                    mesh.geometry.computeBoundingBox();
                    const box = mesh.geometry.boundingBox.clone();
                    box.applyMatrix4(mesh.matrixWorld);
                    const size = new THREE.Vector3();
                    box.getSize(size);
                    const area = Math.abs(size.x * size.z);
                    if (area > bestArea) {
                        const center = new THREE.Vector3();
                        box.getCenter(center);
                        bestArea = area;
                        best = { mesh, box, size, center };
                    }
                });
                if (best) {
                    anchor = best;
                }
            }
        }

        const floorInfo = this.floorDetectionInfo;
        let basePos;
        if (anchor) {
            basePos = { x: anchor.center.x, y: anchor.box.max.y, z: anchor.center.z };
        } else if (floorInfo) {
            const cx = (floorInfo.aabbMin.x + floorInfo.aabbMax.x) / 2;
            const cz = (floorInfo.aabbMin.z + floorInfo.aabbMax.z) / 2;
            basePos = { x: cx, y: floorInfo.aabbMax.y, z: cz };
        } else {
            basePos = { x: 0, y: 0, z: 0 };
        }

        const surfaceY = (typeof this.floorSurfaceY === 'number') ? this.floorSurfaceY : basePos.y;
        const offset = spawnConfig.POSITION_OFFSET || {};
        const spawnPosition = {
            x: basePos.x + (offset.x ?? 0),
            y: surfaceY + (offset.y ?? 2.0),
            z: basePos.z + (offset.z ?? 0)
        };

        const aiOffset = spawnConfig.AI_OFFSET || {};
        const aiPosition = {
            x: spawnPosition.x + (aiOffset.x ?? 0),
            y: spawnPosition.y + (aiOffset.y ?? 0),
            z: spawnPosition.z + (aiOffset.z ?? 0)
        };

        const rotDeg = spawnConfig.ROTATE_Y_DEG ?? 0;
        const rotRad = rotDeg * Math.PI / 180;

        this.spawnInfo = {
            anchorName: anchor?.mesh?.name || null,
            anchorSize: anchor?.size ? { x: anchor.size.x, y: anchor.size.y, z: anchor.size.z } : null,
            basePosition: basePos,
            position: spawnPosition,
            aiPosition,
            rotationYDeg: rotDeg,
            rotationYRad: rotRad
        };

        console.log('[Field] リスポーン位置を設定:', {
            anchor: this.spawnInfo.anchorName,
            position: this.spawnInfo.position,
            aiPosition: this.spawnInfo.aiPosition,
            rotationYDeg: this.spawnInfo.rotationYDeg
        });
    }

    getSpawnInfo() {
        if (!this.spawnInfo) {
            this.detectSpawnPoint();
        }
        return this.spawnInfo;
    }

    applyTransformFromConfig() {
        if (!this.fieldGroup) return;
        const group = this.fieldGroup;
        const s = CONFIG.FIELD.SCALE ?? 1.0;
        group.scale.set(s, s, s);
        const rotY = (CONFIG.FIELD.ROTATE_Y_DEG || 0) * Math.PI / 180;
        group.rotation.set(0, rotY, 0);
        const pos = CONFIG.FIELD.POSITION || { x: 0, y: 0, z: 0 };
        group.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
        group.updateMatrixWorld(true);
        this.rebuildColliders();
    }

    setScale(scale) {
        CONFIG.FIELD.SCALE = scale;
        if (this.loaded) this.applyTransformFromConfig();
    }

    setRotationY(deg) {
        CONFIG.FIELD.ROTATE_Y_DEG = deg;
        if (this.loaded) this.applyTransformFromConfig();
    }

    setPosition(x, y, z) {
        CONFIG.FIELD.POSITION = { x, y, z };
        if (this.loaded) this.applyTransformFromConfig();
    }

    // 床の当たり判定（フィールドモデル基準）
    ensureFloorCollider() {
        if (!this.fieldGroup) return;

        // 既存の床ボディがあれば削除
        if (this.floorBodies.length) {
            const prevBodies = this.floorBodies.slice();
            const bodySet = new Set(prevBodies);
            prevBodies.forEach((body) => {
                try { this.physicsWorld.world.removeBody(body); } catch (_) {}
            });
            this.floorBodies = [];
            if (this.colliderBodies.length) {
                this.colliderBodies = this.colliderBodies.filter(b => !bodySet.has(b));
            }
        }

        const defaultHints = ['floor','Floor','ground','Ground','road','Road','track','Track','asphalt','Asphalt','地面','路面'];
        const configHints = (CONFIG.FIELD.GROUND_NAME_HINTS || []).filter(Boolean);
        const hintSet = new Set([...defaultHints, ...configHints]);
        const hints = Array.from(hintSet);

        // 候補探索
        let best = null; // { box, size, center, area, method, name }
        this.fieldGroup.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            const name = (child.name || '') + '|' + ((child.parent && child.parent.name) || '');
            // バウンディングボックス（ワールド）
            child.geometry.computeBoundingBox();
            const box = child.geometry.boundingBox.clone();
            box.applyMatrix4(child.matrixWorld);
            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);

            const isWideThin = size.y < 1.0 && size.x > 5 && size.z > 5; // 薄く広い
            const hasHint = hints.some(h => name.includes(h));
            if (hasHint || isWideThin) {
                const area = size.x * size.z;
                const method = hasHint ? 'nameHint' : 'wideThin';
                if (!best || area > best.area) {
                    best = { box, size, center, area, method, name };
                }
            }
        });

        // 候補がなければフィールド全体のXZ範囲で代用
        if (!best) {
            const whole = this.computeWorldAABB(this.fieldGroup);
            const size = new THREE.Vector3(); whole.getSize(size);
            const center = new THREE.Vector3(); whole.getCenter(center);
            best = { box: whole, size, center, area: size.x * size.z, method: 'fallbackAABB', name: 'WORLD_AABB' };
        }

        if (!best) return;

        const shrink = 0.98; // わずかに小さく
        const wx = Math.max(1, best.size.x * shrink);
        const wz = Math.max(1, best.size.z * shrink);
        // 厚み: 既存厚みがあれば使用、なければ 0.4m
        const thickness = Math.max(0.2, Math.min(best.size.y || 0.4, 1.0));
        const hx = wx / 2;
        const hy = thickness / 2;
        const hz = wz / 2;

        const shape = new CANNON.Box(new CANNON.Vec3(hx, hy, hz));
        const body = new CANNON.Body({ mass: 0, shape, type: CANNON.Body.STATIC });
        // 高さはボックス下端に合わせる
        const y = best.box.min.y + hy;
        body.position.set(best.center.x, y, best.center.z);
        // 物理の地面マテリアルに合わせる（可能なら）
        if (this.physicsWorld.groundMaterial) {
            body.material = this.physicsWorld.groundMaterial;
        }
        body.userData = { tag: 'field-floor' };

        // 既定の地面と入れ替え（設定で有効化されている場合）
        if (CONFIG.FIELD.USE_AS_GROUND && this.physicsWorld.removeGround) {
            this.physicsWorld.removeGround();
        }
        this.physicsWorld.world.addBody(body);
        this.floorBodies.push(body);
        this.colliderBodies.push(body);
        // 床の表面Y（メッシュの上面）
        this.floorSurfaceY = best.box.max.y;
        this.floorDetectionInfo = {
            method: best.method,
            sourceName: best.name,
            size: { x: wx, y: thickness, z: wz },
            aabbMin: { x: best.box.min.x, y: best.box.min.y, z: best.box.min.z },
            aabbMax: { x: best.box.max.x, y: best.box.max.y, z: best.box.max.z },
            surfaceY: this.floorSurfaceY
        };
        console.log('[Field] 床コライダーを追加:', {
            method: best.method,
            source: best.name,
            size: { x: wx.toFixed(2), y: thickness.toFixed(2), z: wz.toFixed(2) },
            y: y.toFixed(2)
        });
    }

    getFloorDetectionInfo() {
        return this.floorDetectionInfo;
    }

    computeWorldAABB(root) {
        const box = new THREE.Box3();
        let initialized = false;
        root.updateMatrixWorld(true);
        root.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            child.geometry.computeBoundingBox();
            const cb = child.geometry.boundingBox.clone();
            cb.applyMatrix4(child.matrixWorld);
            if (!initialized) { box.copy(cb); initialized = true; }
            else { box.union(cb); }
        });
        return box;
    }

    clear() {
        if (this.fieldGroup) {
            this.scene.remove(this.fieldGroup);
        }
        this.clearColliders();
        this.loaded = false;
    }
}
