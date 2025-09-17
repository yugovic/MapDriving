export class CameraOcclusionHelper {
    constructor() {
        this.raycaster = new THREE.Raycaster();
        this.tmpDir = new THREE.Vector3();
        this.originalMaterialState = new WeakMap();
        this.activeMeshes = new Set();
        this.opacity = 0.2;
        this.fadeInSpeed = 0.1;
        this.fadeOutSpeed = 0.2;
        this.cameraNearOffset = 1.0;
        this.enabled = true;
        this._cloneMarker = Symbol('cameraOcclusionCloned');
    }

    update(scene, camera, targetPosition) {
        if (!this.enabled || !scene || !camera || !targetPosition) return;

        const origin = camera.position.clone();
        const direction = this.tmpDir.copy(targetPosition).sub(origin).normalize();
        const rayLength = origin.distanceTo(targetPosition);
        this.raycaster.set(origin, direction);
        this.raycaster.far = rayLength - this.cameraNearOffset;

        if (rayLength <= this.cameraNearOffset) return;

        const hits = this.raycaster.intersectObjects(scene.children, true);
        const newlyActive = new Set();

        for (const hit of hits) {
            const mesh = hit.object;
            if (!mesh.isMesh || !mesh.material) continue;
            if (mesh.material.depthTest === false) continue;
            if (!this.originalMaterialState.has(mesh)) {
                this._ensurePerMeshMaterials(mesh);
                const materialArray = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                this.originalMaterialState.set(mesh, materialArray.map(mat => ({
                    transparent: mat.transparent,
                    opacity: mat.opacity,
                    depthWrite: mat.depthWrite
                })));
            }
            this.applyTransparency(mesh);
            newlyActive.add(mesh);
        }

        for (const mesh of Array.from(this.activeMeshes)) {
            if (!newlyActive.has(mesh)) {
                const done = this.restoreMaterial(mesh);
                if (done) {
                    this.activeMeshes.delete(mesh);
                }
            } else {
                newlyActive.delete(mesh);
            }
        }

        for (const mesh of newlyActive) {
            this.activeMeshes.add(mesh);
        }
    }

    applyTransparency(mesh) {
        const states = this.originalMaterialState.get(mesh);
        if (!states) return;

        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat, idx) => this._fadeMaterial(mat, states[idx]));
        } else {
            this._fadeMaterial(mesh.material, states[0]);
        }
    }

    restoreMaterial(mesh) {
        const states = this.originalMaterialState.get(mesh);
        if (!states) return true;

        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat, idx) => this._restoreMaterial(mat, states[idx]));
        } else {
            this._restoreMaterial(mesh.material, states[0]);
        }

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const allRestored = materials.every((mat, idx) => Math.abs(mat.opacity - states[idx].opacity) < 1e-2);
        if (allRestored) {
            this.originalMaterialState.delete(mesh);
        }
        return allRestored;
    }

    _fadeMaterial(material, state) {
        if (!state) return;
        material.transparent = true;
        material.depthWrite = false;
        const targetOpacity = Math.min(this.opacity, state.opacity);
        material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, this.fadeOutSpeed);
        material.needsUpdate = true;
    }

    _restoreMaterial(material, state) {
        if (!state) return;
        material.opacity = THREE.MathUtils.lerp(material.opacity, state.opacity, this.fadeInSpeed);
        if (Math.abs(material.opacity - state.opacity) < 1e-2) {
            material.opacity = state.opacity;
            material.transparent = state.transparent;
            material.depthWrite = state.depthWrite;
        }
        material.needsUpdate = true;
    }

    _ensurePerMeshMaterials(mesh) {
        if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((mat) => this._cloneMaterialIfNeeded(mat));
        } else {
            mesh.material = this._cloneMaterialIfNeeded(mesh.material);
        }
    }

    _cloneMaterialIfNeeded(material) {
        if (!material || material[this._cloneMarker]) {
            return material;
        }
        const cloned = material.clone();
        cloned[this._cloneMarker] = true;
        return cloned;
    }
}
